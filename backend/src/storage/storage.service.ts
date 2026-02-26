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

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnDomain: string;
  private readonly signedUrlExpiry: number;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET', 'realtrack-images');
    this.cdnDomain = this.config.get<string>('AWS_CLOUDFRONT_DOMAIN', '');
    this.signedUrlExpiry = Number(
      this.config.get<string>('S3_SIGNED_URL_EXPIRY', '300'),
    ); // 5 min default

    this.s3 = new S3Client({
      region: this.config.get<string>('AWS_S3_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
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
    const prefix = listingId ? `originals/${listingId}` : 'temp';
    const s3Key = `${prefix}/${assetId}${ext}`;

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
   * Move an object from temp/ to originals/ when confirmed.
   */
  async confirmUpload(
    tempKey: string,
    listingId: string,
    assetId: string,
  ): Promise<string> {
    const ext = tempKey.substring(tempKey.lastIndexOf('.'));
    const finalKey = `originals/${listingId}/${assetId}${ext}`;

    // Copy + delete (S3 has no rename)
    const buffer = await this.getObjectBuffer(tempKey);
    const mimeType = this.mimeFromExt(ext);
    await this.putObject(finalKey, buffer, mimeType);
    await this.deleteObject(tempKey);

    this.logger.log(`Confirmed upload: ${tempKey} → ${finalKey}`);
    return finalKey;
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
