import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'crypto';
import type { CatalogVariantJobData, DriveVariantJobData } from './processors/thumbnail.processor.js';

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

  constructor(
    private readonly config: ConfigService,
    @InjectQueue('storage-thumbnails')
    private readonly thumbnailQueue: Queue<CatalogVariantJobData | DriveVariantJobData>,
  ) {
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
   * Stream an object from S3. Returns the response metadata + readable stream.
   * Caller is responsible for piping the stream and destroying on error.
   */
  async getObjectStream(key: string): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string;
    contentLength: number | undefined;
    etag: string | undefined;
  }> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const response = await this.s3.send(command);
    return {
      stream: response.Body as NodeJS.ReadableStream,
      contentType: response.ContentType ?? 'application/octet-stream',
      contentLength: response.ContentLength,
      etag: response.ETag,
    };
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
   * Lightweight existence check (HEAD, no body transfer). Used to skip
   * re-downloading + re-uploading images already mirrored on a prior run.
   */
  async objectExists(key: string): Promise<boolean> {
    try {
      await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Copy an object within the same bucket (S3 has no rename).
   */
  async copyObject(sourceKey: string, destKey: string): Promise<void> {
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destKey,
      CacheControl: 'public, max-age=31536000, immutable',
    });
    await this.s3.send(command);
    this.logger.debug(`Copied object ${sourceKey} → ${destKey}`);
  }

  /**
   * Move an object (copy + delete source). Used for folder renames.
   */
  async moveObject(sourceKey: string, destKey: string): Promise<void> {
    await this.copyObject(sourceKey, destKey);
    await this.deleteObject(sourceKey);
    this.logger.debug(`Moved object ${sourceKey} → ${destKey}`);
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
    const sanitizedNs = namespace
      .replace(/[^a-zA-Z0-9/_-]/g, '_')
      .replace(/\/+/g, '/');
    const out: MirroredRemoteImage[] = new Array(urls.length);
    const conc = Math.max(1, Math.min(16, parallel));
    // Idempotency: on a re-run the same (namespace, source URL) maps to the
    // same deterministic key, so skip the re-download + re-upload when the
    // object is already present. Keys are hashed from the *source identity*,
    // not the array index — index-based keys caused corrected inventory /
    // catalog photo updates to overwrite the same CDN URL, then get dropped
    // by URL dedupe (`if (!merged.includes(url))`). Disable with
    // PIPELINE_MIRROR_SKIP_EXISTING=false.
    const skipExisting = !/^(0|false|no|off)$/i.test(
      String(
        this.config.get<string>('PIPELINE_MIRROR_SKIP_EXISTING', 'true'),
      ).trim(),
    );

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
        const existingKey = this.tryKeyFromOurUrl(u);
        // Permanent keys (catalog-images/, originals/, …) are already durable —
        // reference them as-is. But `temp/` keys are ephemeral: they get purged
        // after upload confirmation / temp cleanup, which would leave the catalog
        // row pointing at a dead object (403). Copy those into the durable
        // catalog-images/ prefix now, while the temp object still exists.
        if (existingKey && this.isTempKey(existingKey)) {
          // Uploads are often processed to .webp (with the original .jpg/.png
          // removed), so the referenced key can be gone while a variant
          // survives. Try the referenced key first, then a .webp fallback.
          const candidates = [existingKey];
          const webpVariant = existingKey.replace(/\.[a-z0-9]+$/i, '.webp');
          if (webpVariant !== existingKey) candidates.push(webpVariant);

          for (const srcKey of candidates) {
            try {
              const buf = await this.getObjectBuffer(srcKey);
              const ext =
                srcKey.slice(srcKey.lastIndexOf('.')).toLowerCase() || '.jpg';
              // Hash the temp source key so a corrected re-upload (new temp
              // object at the same array index) gets a distinct durable URL.
              const key = this.mirroredObjectKey(sanitizedNs, srcKey, ext);
              await this.putObject(key, buf, this.mimeFromExt(ext));
              out[i] = { url: this.getCdnUrl(key), s3Key: key };
              return;
            } catch {
              // Object missing under this key — try the next candidate.
            }
          }
          this.logger.warn(
            `mirrorRemoteImages: temp key ${existingKey} (and .webp variant) not found — referencing as-is`,
          );
        }
        // Verify permanent keys actually exist in S3 before referencing.
        // Files can be missing if upload failed silently, was deleted by
        // cleanup, or the URL was copied from another product without
        // re-mirroring. Fall through to re-download if missing.
        if (existingKey && !this.isTempKey(existingKey)) {
          const exists = await this.objectExists(existingKey);
          if (!exists) {
            // Try .webp variant (originals are often converted)
            const webpKey = existingKey.replace(/\.[a-z0-9]+$/i, '.webp');
            const webpExists = await this.objectExists(webpKey);
            if (webpExists) {
              out[i] = { url: this.getCdnUrl(webpKey), s3Key: webpKey };
              return;
            }
            this.logger.warn(
              `mirrorRemoteImages: permanent key ${existingKey} not found in S3 — will attempt re-download`,
            );
            // Fall through to re-download from original source URL
          } else {
            out[i] = { url: u, s3Key: existingKey };
            return;
          }
        } else {
          out[i] = { url: u, s3Key: existingKey };
          return;
        }
      }
      // Skip the fetch + upload if this source URL was already mirrored on a
      // prior run. Key is deterministic per (namespace, source URL); extension
      // isn't known without fetching, so probe the URL extension then common
      // variants (uploads are often converted to .webp).
      if (skipExisting) {
        const candidateExts = [
          ...new Set([
            this.extFromUrlOrMime(u, ''),
            '.webp',
            '.jpg',
            '.png',
            '.jpeg',
          ]),
        ];
        for (const ext of candidateExts) {
          const key = this.mirroredObjectKey(sanitizedNs, u, ext);
          if (await this.objectExists(key)) {
            out[i] = { url: this.getCdnUrl(key), s3Key: key };
            return;
          }
        }
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
          this.logger.warn(
            `mirrorRemoteImages: HTTP ${res.status} for ${u.slice(0, 80)}`,
          );
          out[i] = { url: u, s3Key: null };
          return;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        const contentType =
          res.headers.get('content-type')?.split(';')[0]?.trim() ||
          'application/octet-stream';
        const ext = this.extFromUrlOrMime(u, contentType);
        const key = this.mirroredObjectKey(sanitizedNs, u, ext);
        await this.putObject(key, buf, contentType);
        out[i] = { url: this.getCdnUrl(key), s3Key: key };
        await this.queueVariantGeneration(key);
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

  /**
   * Enqueue responsive-variant generation (_thumb/_sm/_medium/_lg) for a
   * freshly-mirrored catalog image. Fire-and-forget: the frontend derives
   * variant URLs by suffix convention (getVariantUrl in imageUrl.ts) with no
   * DB lookup, so this writes files to S3 only — no image_assets row needed.
   * Failure to enqueue must not fail the mirror/import itself.
   */
  async queueVariantGeneration(s3Key: string): Promise<void> {
    try {
      await this.thumbnailQueue.add(
        'generate-catalog-variants',
        { s3Key },
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          jobId: `catalog-variants-${s3Key}`,
        },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to queue variant generation for ${s3Key}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async queueDriveVariantGeneration(
    assetId: string,
    s3Key: string,
  ): Promise<void> {
    try {
      await this.thumbnailQueue.add(
        'generate-drive-variants',
        { assetId, s3Key },
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          jobId: `drive-variants-${assetId}`,
        },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to queue drive variant generation for ${s3Key}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** Public wrapper — extracts the S3 key from one of our own CDN/bucket
   * URLs, or null if the URL isn't ours (e.g. an un-mirrored eBay image). */
  keyFromUrl(url: string): string | null {
    return this.tryKeyFromOurUrl(url);
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
          ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic'].includes(
            e,
          )
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

  buildDrivePrefix(folderName: string): string {
    const sanitized = folderName
      .trim()
      .replace(/[^a-zA-Z0-9\-_ ./]/g, '')
      .replace(/\s+/g, ' ');
    return this.withKeyPrefix(`image-drive/${sanitized}/`);
  }

  /**
   * Durable mirror key for a source identity (remote URL or temp S3 key).
   * Stable across pipeline re-runs of the same source; unique when the source
   * changes — even if it lands at the same array index as a prior image.
   * Exported for unit tests via the public wrapper below.
   */
  mirroredObjectKey(namespace: string, sourceIdentity: string, ext: string): string {
    const digest = createHash('sha256')
      .update(sourceIdentity.trim())
      .digest('hex')
      .slice(0, 20);
    const safeExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    return this.withKeyPrefix(`catalog-images/${namespace}/${digest}${safeExt}`);
  }

  private relativeKey(fullKey: string): string {
    if (!this.keyPrefix) return fullKey;
    if (fullKey.startsWith(this.keyPrefix)) {
      return fullKey.slice(this.keyPrefix.length);
    }
    return fullKey;
  }

  sanitizeExtension(filename: string): string {
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
