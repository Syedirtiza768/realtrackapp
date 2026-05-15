import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export interface PresignedUploadResult {
  uploadUrl: string;
  s3Key: string;
  assetId: string;
}

/** Result of mirroring a remote image into this app's S3 bucket. */
export interface MirroredRemoteImage {
  /** Public URL (CDN or bucket URL) written to listing PicURL columns. */
  url: string;
  /** Object key in the bucket (includes optional AWS_S3_PREFIX), or null if not mirrored. */
  s3Key: string | null;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  /** Normalized key prefix, e.g. `mhn/` for s3://bucket/mhn/ — empty if unset */
  private readonly keyPrefix: string;
  private readonly cdnDomain: string;
  private readonly signedUrlExpiry: number;

  constructor(private readonly config: ConfigService) {
    this.bucket =
      this.config.get<string>('AWS_S3_BUCKET')?.trim() ||
      this.config.get<string>('S3_BUCKET')?.trim() ||
      'realtrack-images';
    this.keyPrefix = this.normalizeKeyPrefix(
      this.config.get<string>('AWS_S3_PREFIX') ||
        this.config.get<string>('S3_PREFIX', ''),
    );
    this.cdnDomain = this.config.get<string>('AWS_CLOUDFRONT_DOMAIN', '');
    this.signedUrlExpiry = Number(
      this.config.get<string>('S3_SIGNED_URL_EXPIRY', '300'),
    ); // 5 min default

    const region =
      this.config.get<string>('AWS_S3_REGION')?.trim() ||
      this.config.get<string>('S3_REGION')?.trim() ||
      'us-east-1';

    const accessKey = this.config.get<string>('AWS_ACCESS_KEY_ID')?.trim();
    const secretKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY')?.trim();
    // Omit credentials → AWS SDK uses default chain (env, profile, EC2/ECS IAM role).
    this.s3 = new S3Client({
      region,
      ...(accessKey && secretKey
        ? {
            credentials: {
              accessKeyId: accessKey,
              secretAccessKey: secretKey,
            },
          }
        : {}),
    });
  }

  getBucket(): string {
    return this.bucket;
  }

  /** True if the object lives under the logical `temp/` folder (supports optional root prefix). */
  isTempKey(s3Key: string): boolean {
    return this.relativeKey(s3Key).startsWith('temp/');
  }

  /**
   * Generate a pre-signed PUT URL for direct browser upload to S3.
   */
  async generateUploadUrl(
    filename: string,
    mimeType: string,
    listingId?: string,
  ): Promise<PresignedUploadResult> {
    const assetId = randomUUID();
    const ext = this.sanitizeExtension(filename);
    const pathPrefix = listingId ? `originals/${listingId}` : 'temp';
    const s3Key = this.withKeyPrefix(`${pathPrefix}/${assetId}${ext}`);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: this.signedUrlExpiry,
    });

    this.logger.debug(`Generated upload URL for key=${s3Key}`);
    return { uploadUrl, s3Key, assetId };
  }

  /**
   * Generate multiple pre-signed upload URLs in one call.
   */
  async generateBulkUploadUrls(
    files: Array<{ filename: string; mimeType: string }>,
    listingId?: string,
  ): Promise<PresignedUploadResult[]> {
    return Promise.all(
      files.map((f) =>
        this.generateUploadUrl(f.filename, f.mimeType, listingId),
      ),
    );
  }

  /**
   * Fetch an object from S3 as a Buffer.
   */
  async getObjectBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const response = await this.s3.send(command);
    const stream = response.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Put a processed buffer back to S3.
   */
  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    });
    await this.s3.send(command);
    this.logger.debug(`Uploaded object key=${key} size=${body.length}`);
  }

  /**
   * Soft-delete by removing from S3.
   */
  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.s3.send(command);
    this.logger.debug(`Deleted object key=${key}`);
  }

  /**
   * Build a public CDN URL from an S3 key.
   */
  getCdnUrl(s3Key: string): string {
    if (this.cdnDomain) {
      return `https://${this.cdnDomain}/${s3Key}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${s3Key}`;
  }

  /**
   * Download remote image URLs and store under catalog-import prefix.
   * Returns public HTTPS URLs (same shape as getCdnUrl). Failed URLs keep the original link.
   * @param parallel max concurrent HTTP fetches (default 1 = sequential).
   */
  async mirrorRemoteImageUrls(
    urls: string[],
    namespace: string,
    parallel = 1,
  ): Promise<string[]> {
    const mirrored = await this.mirrorRemoteImages(urls, namespace, parallel);
    return mirrored.map((m, i) => m.url || urls[i]?.trim() || '');
  }

  /**
   * Download remote image URLs and store under catalog-import / pipeline prefix.
   * Returns public URLs plus S3 object keys for audit columns in export files.
   */
  async mirrorRemoteImages(
    urls: string[],
    namespace: string,
    parallel = 1,
  ): Promise<MirroredRemoteImage[]> {
    const sanitizedNs = namespace.replace(/[^a-zA-Z0-9/_-]/g, '_').replace(/\/+/g, '/');
    const out: MirroredRemoteImage[] = new Array(urls.length);
    const conc = Math.max(1, Math.min(16, parallel));

    const mirrorOne = async (i: number): Promise<void> => {
      const raw = urls[i];
      const u = raw?.trim();
      if (!u) {
        out[i] = { url: '', s3Key: null };
        return;
      }
      if (!/^https?:\/\//i.test(u)) {
        out[i] = { url: u, s3Key: null };
        return;
      }
      if (this.urlLooksLikeOurBucket(u)) {
        out[i] = { url: u, s3Key: this.tryKeyFromOurUrl(u) };
        return;
      }
      try {
        const res = await fetch(u, {
          redirect: 'follow',
          signal: AbortSignal.timeout(120_000),
          headers: {
            'User-Agent':
              'RealTrackApp-catalog-import/1.0 (image mirror; by sku)',
          },
        });
        if (!res.ok) {
          this.logger.warn(`mirrorRemoteImages: HTTP ${res.status} for ${u.slice(0, 80)}`);
          out[i] = { url: u, s3Key: null };
          return;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        const contentType =
          res.headers.get('content-type')?.split(';')[0]?.trim() ||
          'application/octet-stream';
        const ext = this.extFromUrlOrMime(u, contentType);
        const key = this.withKeyPrefix(
          `catalog-images/${sanitizedNs}/${String(i).padStart(3, '0')}${ext}`,
        );
        await this.putObject(key, buf, contentType);
        out[i] = { url: this.getCdnUrl(key), s3Key: key };
      } catch (e) {
        this.logger.warn(
          `mirrorRemoteImages failed for ${u.slice(0, 96)}: ${e instanceof Error ? e.message : e}`,
        );
        out[i] = { url: u, s3Key: null };
      }
    };

    for (let start = 0; start < urls.length; start += conc) {
      const slice = Array.from(
        { length: Math.min(conc, urls.length - start) },
        (_, j) => start + j,
      );
      await Promise.all(slice.map((idx) => mirrorOne(idx)));
    }

    return out.map((v, i) => {
      if (v) return v;
      const fallback = urls[i]?.trim() ?? '';
      return { url: fallback, s3Key: null };
    });
  }

  private tryKeyFromOurUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (this.cdnDomain && host === this.cdnDomain.toLowerCase()) {
        return parsed.pathname.replace(/^\//, '');
      }
      const bucketHost = `${this.bucket.toLowerCase()}.s3`;
      if (host.includes(bucketHost)) {
        return parsed.pathname.replace(/^\//, '');
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  private urlLooksLikeOurBucket(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes(`${this.bucket.toLowerCase()}.s3`)) return true;
      if (this.cdnDomain && host === this.cdnDomain.toLowerCase()) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  private extFromUrlOrMime(url: string, mime: string): string {
    try {
      const path = new URL(url).pathname;
      const m = path.match(/\.([a-zA-Z0-9]+)$/);
      if (m && m[1]) {
        const e = `.${m[1].toLowerCase()}`;
        if (
          ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic'].includes(e)
        ) {
          return e;
        }
      }
    } catch {
      /* ignore */
    }
    const mt = mime.toLowerCase();
    if (mt.includes('jpeg')) return '.jpg';
    if (mt.includes('png')) return '.png';
    if (mt.includes('webp')) return '.webp';
    if (mt.includes('gif')) return '.gif';
    if (mt.includes('heic')) return '.heic';
    return '.jpg';
  }

  /**
   * Move an object from temp/ to originals/ when confirmed.
   */
  async confirmUpload(
    tempKey: string,
    listingId: string,
    assetId: string,
  ): Promise<string> {
    const ext = tempKey.substring(tempKey.lastIndexOf('.'));
    const finalKey = this.withKeyPrefix(
      `originals/${listingId}/${assetId}${ext}`,
    );

    // Copy + delete (S3 has no rename)
    const buffer = await this.getObjectBuffer(tempKey);
    const mimeType = this.mimeFromExt(ext);
    await this.putObject(finalKey, buffer, mimeType);
    await this.deleteObject(tempKey);

    this.logger.log(`Confirmed upload: ${tempKey} → ${finalKey}`);
    return finalKey;
  }

  private normalizeKeyPrefix(raw: string): string {
    const t = raw?.trim();
    if (!t) return '';
    let p = t.replace(/^\/+/, '');
    if (!p.endsWith('/')) p += '/';
    return p;
  }

  private withKeyPrefix(relativeKey: string): string {
    if (!this.keyPrefix) return relativeKey;
    return `${this.keyPrefix}${relativeKey}`;
  }

  private relativeKey(fullKey: string): string {
    if (!this.keyPrefix) return fullKey;
    if (fullKey.startsWith(this.keyPrefix)) {
      return fullKey.slice(this.keyPrefix.length);
    }
    return fullKey;
  }

  private sanitizeExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot < 0) return '.webp';
    const ext = filename.substring(lastDot).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
    return allowed.includes(ext) ? ext : '.webp';
  }

  private mimeFromExt(ext: string): string {
    const map: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.heic': 'image/heic',
    };
    return map[ext] ?? 'image/webp';
  }
}
