import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import * as crypto from 'crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import axios from 'axios';

export interface OptimizedImage {
  localPath: string;
  originalUrl: string;
  width: number;
  height: number;
  format: string;
  fileSizeBytes: number;
  hash: string;
  aspectRatio: number;
}

/**
 * ImageOptimizerService — downloads, validates, and optimizes images.
 *
 * Functions:
 *  - Download images from URLs with timeout + size limits
 *  - Validate dimensions, aspect ratio, format
 *  - Convert to optimized webp/jpg with compression
 *  - Generate perceptual hashes for deduplication
 *  - Detect watermarks by analyzing edge density in border regions
 */
@Injectable()
export class ImageOptimizerService {
  private readonly logger = new Logger(ImageOptimizerService.name);
  private readonly storageDir: string;
  private readonly maxDownloadBytes: number;

  constructor(private readonly config: ConfigService) {
    const root =
      process.env.PIPELINE_PROJECT_ROOT || path.resolve(process.cwd(), '..');
    this.storageDir = path.resolve(root, 'uploads', 'enriched-images');
    // 50 MB — must comfortably exceed the vision provider's 30MB cap so this
    // service can actually download oversized originals in order to shrink
    // them (see SingleListingFormService.resizeImagesForVision).
    this.maxDownloadBytes = 50 * 1024 * 1024;

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Download and optimize an image from a URL.
   * Returns null if the image fails validation.
   */
  async downloadAndOptimize(
    url: string,
    options: {
      targetFormat?: 'webp' | 'jpg';
      maxWidth?: number;
      quality?: number;
    } = {},
  ): Promise<OptimizedImage | null> {
    const targetFormat = options.targetFormat ?? 'webp';
    const maxWidth = options.maxWidth ?? 1600;
    const quality = options.quality ?? 82;

    try {
      // Download with size limit and timeout
      const buffer = await this.downloadImage(url);
      if (!buffer) return null;

      // Get metadata
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        this.logger.debug(`No dimensions detected for ${url}`);
        return null;
      }

      // Reject images smaller than 300px
      if (metadata.width < 300 || metadata.height < 300) {
        this.logger.debug(
          `Image too small (${metadata.width}x${metadata.height}): ${url}`,
        );
        return null;
      }

      // Compute perceptual hash from the image content
      const hash = await this.computePerceptualHash(buffer);

      // Optimize: resize if oversized, convert to target format
      let pipeline = sharp(buffer);

      if (metadata.width > maxWidth) {
        pipeline = pipeline.resize(maxWidth, null, {
          withoutEnlargement: true,
        });
      }

      let outputBuffer: Buffer;
      if (targetFormat === 'webp') {
        outputBuffer = await pipeline.webp({ quality, effort: 4 }).toBuffer();
      } else {
        outputBuffer = await pipeline
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
      }

      // Get final metadata
      const finalMeta = await sharp(outputBuffer).metadata();
      const finalWidth = finalMeta.width ?? metadata.width;
      const finalHeight = finalMeta.height ?? metadata.height;

      // Save to disk
      const filename = `${hash}.${targetFormat}`;
      const localPath = path.join(this.storageDir, filename);

      if (!fs.existsSync(localPath)) {
        fs.writeFileSync(localPath, outputBuffer);
      }

      return {
        localPath,
        originalUrl: url,
        width: finalWidth,
        height: finalHeight,
        format: targetFormat,
        fileSizeBytes: outputBuffer.length,
        hash,
        aspectRatio: Math.round((finalWidth / finalHeight) * 100) / 100,
      };
    } catch (err) {
      this.logger.debug(`Failed to optimize image from ${url}: ${err}`);
      return null;
    }
  }

  /**
   * Check if an image likely has watermarks by analyzing border regions.
   * Uses edge detection on the image borders.
   */
  async detectWatermark(
    imageBuffer: Buffer,
  ): Promise<{ hasWatermark: boolean; confidence: number }> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      if (!metadata.width || !metadata.height) {
        return { hasWatermark: false, confidence: 0 };
      }

      const w = metadata.width;
      const h = metadata.height;

      // Extract bottom 15% of image where watermarks typically appear
      const cropHeight = Math.max(30, Math.round(h * 0.15));
      const bottomStrip = await sharp(imageBuffer)
        .extract({ left: 0, top: h - cropHeight, width: w, height: cropHeight })
        .greyscale()
        .raw()
        .toBuffer();

      // Compute variance of pixel values — watermarks tend to have distinct edge patterns
      const pixels = new Uint8Array(bottomStrip);
      let sum = 0;
      let sumSq = 0;
      for (let i = 0; i < pixels.length; i++) {
        sum += pixels[i];
        sumSq += pixels[i] * pixels[i];
      }
      const mean = sum / pixels.length;
      const variance = sumSq / pixels.length - mean * mean;

      // High variance in border region can indicate watermarks / overlays
      // This is a heuristic — AI validation provides more reliable detection
      const hasWatermark = variance > 3500 && mean > 180;
      const confidence = hasWatermark ? Math.min(0.7, variance / 10000) : 0;

      return { hasWatermark, confidence };
    } catch {
      return { hasWatermark: false, confidence: 0 };
    }
  }

  /**
   * Compute a perceptual hash (average hash) for image deduplication.
   */
  async computePerceptualHash(imageBuffer: Buffer): Promise<string> {
    try {
      // Resize to 16x16 greyscale for fingerprinting
      const thumbBuffer = await sharp(imageBuffer)
        .resize(16, 16, { fit: 'fill' })
        .greyscale()
        .raw()
        .toBuffer();

      const pixels = new Uint8Array(thumbBuffer);

      // Compute mean
      let sum = 0;
      for (let i = 0; i < pixels.length; i++) sum += pixels[i];
      const mean = sum / pixels.length;

      // Build bit string (1 if pixel > mean, 0 otherwise)
      let bits = '';
      for (let i = 0; i < pixels.length; i++) {
        bits += pixels[i] > mean ? '1' : '0';
      }

      // Convert to hex using MD5 of the bit pattern for compact storage
      return crypto.createHash('md5').update(bits).digest('hex');
    } catch {
      // Fallback to URL-based hash
      return crypto.createHash('md5').update(imageBuffer).digest('hex');
    }
  }

  /**
   * Validate image dimensions and aspect ratio for eBay compliance.
   */
  async validateForEbay(imageBuffer: Buffer): Promise<{
    valid: boolean;
    width: number;
    height: number;
    aspectRatio: number;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const metadata = await sharp(imageBuffer).metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      const aspectRatio =
        height > 0 ? Math.round((width / height) * 100) / 100 : 0;

      if (width < 500 || height < 500) {
        issues.push(`Image too small: ${width}x${height} (min 500x500)`);
      }

      // eBay prefers square or near-square images
      if (aspectRatio < 0.5 || aspectRatio > 2.0) {
        issues.push(
          `Aspect ratio ${aspectRatio} outside recommended range (0.5-2.0)`,
        );
      }

      return { valid: issues.length === 0, width, height, aspectRatio, issues };
    } catch {
      return {
        valid: false,
        width: 0,
        height: 0,
        aspectRatio: 0,
        issues: ['Unable to read image metadata'],
      };
    }
  }

  /**
   * Download an image from URL with size limit and timeout.
   */
  private async downloadImage(url: string): Promise<Buffer | null> {
    // Skip local/relative URLs
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return null;
    }

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15_000,
        maxContentLength: this.maxDownloadBytes,
        headers: {
          'User-Agent': 'ListingPro/1.0 Image Enrichment Bot',
          Accept: 'image/*',
        },
        maxRedirects: 3,
      });

      const contentType = String(response.headers['content-type'] ?? '');
      if (!contentType.startsWith('image/')) {
        return null;
      }

      return Buffer.from(response.data);
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.response?.status === 404) {
        // Expected for unavailable images
        return null;
      }
      this.logger.debug(
        `Image download failed for ${url}: ${err.message ?? err}`,
      );
      return null;
    }
  }
}
