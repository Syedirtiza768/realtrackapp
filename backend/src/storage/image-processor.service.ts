import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { StorageService } from './storage.service.js';

export interface ImageVariant {
  suffix: string;
  width: number;
  height: number;
  fit: keyof sharp.FitEnum;
  quality: number;
}

export interface ProcessingResult {
  thumbnailKey: string | null;
  mediumKey: string | null;
  smallKey: string | null;
  largeKey: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  dominantColor: string | null;
}

const VARIANTS: ImageVariant[] = [
  { suffix: '_thumb', width: 200, height: 200, fit: 'cover', quality: 75 },
  { suffix: '_sm', width: 320, height: 320, fit: 'inside', quality: 78 },
  { suffix: '_medium', width: 800, height: 800, fit: 'inside', quality: 80 },
  { suffix: '_lg', width: 1200, height: 1200, fit: 'inside', quality: 82 },
];

const MAX_ORIGINAL_DIMENSION = 2048;
const MAX_PIXEL_COUNT = 4096 * 4096;

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);

  constructor(private readonly storage: StorageService) {}

  /**
   * Process an uploaded image:
   * 1. Resize original to max 2048px + convert to WebP
   * 2. Generate responsive variants (thumb, sm, medium, lg)
   * 3. Extract dimensions, dominant color, and blurhash placeholder
   */
  async processImage(s3Key: string): Promise<ProcessingResult> {
    this.logger.log(`Processing image: ${s3Key}`);

    const buffer = await this.storage.getObjectBuffer(s3Key);

    // Validate magic bytes — reject non-image files early
    const validation = this.validateMagicBytes(buffer);
    if (!validation.valid) {
      this.logger.warn(
        `Rejected ${s3Key}: failed magic byte validation (not a valid image)`,
      );
      return {
        thumbnailKey: null,
        mediumKey: null,
        smallKey: null,
        largeKey: null,
        width: null,
        height: null,
        blurhash: null,
        dominantColor: null,
      };
    }

    const metadata = await sharp(buffer).metadata();

    const originalWidth = metadata.width ?? 0;
    const originalHeight = metadata.height ?? 0;

    // Decompression bomb protection
    if (originalWidth * originalHeight > MAX_PIXEL_COUNT) {
      this.logger.warn(
        `Image ${s3Key} exceeds max pixel count (${originalWidth}x${originalHeight}) — skipping variants`,
      );
      return {
        thumbnailKey: null,
        mediumKey: null,
        smallKey: null,
        largeKey: null,
        width: originalWidth || null,
        height: originalHeight || null,
        blurhash: null,
        dominantColor: null,
      };
    }

    // Apply EXIF orientation once so all variants use correctly-oriented
    // pixels. Phone cameras (esp. iPhone) store sensor rotation in EXIF;
    // without .rotate(), variants render sideways/upside-down while the
    // original (served with EXIF intact) displays correctly in browsers.
    // metadata.orientation is 1 (or undefined) for upright images, 2-8 for
    // rotated/flipped. Only re-encode when rotation is actually needed.
    const orientedBuffer =
      metadata.orientation && metadata.orientation > 1
        ? await sharp(buffer).rotate().toBuffer()
        : buffer;

    // Resize original to max dimension + WebP (strip EXIF via sharp defaults)
    const needsResize =
      originalWidth > MAX_ORIGINAL_DIMENSION ||
      originalHeight > MAX_ORIGINAL_DIMENSION;

    if (needsResize) {
      const resized = await sharp(orientedBuffer)
        .resize(MAX_ORIGINAL_DIMENSION, MAX_ORIGINAL_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();

      const webpKey = s3Key.replace(/\.\w+$/, '.webp');
      await this.storage.putObject(webpKey, resized, 'image/webp');
      this.logger.debug(`Resized original → ${webpKey}`);
    }

    // Generate responsive variants
    const results: Record<string, string | null> = {};
    for (const variant of VARIANTS) {
      try {
        const processed = await sharp(orientedBuffer)
          .resize(variant.width, variant.height, {
            fit: variant.fit,
            withoutEnlargement: true,
          })
          .webp({ quality: variant.quality })
          .toBuffer();

        const variantKey = s3Key.replace(/\.\w+$/, `${variant.suffix}.webp`);
        await this.storage.putObject(variantKey, processed, 'image/webp');
        results[variant.suffix] = variantKey;

        this.logger.debug(
          `Generated variant ${variant.suffix}: ${variantKey} (${processed.length} bytes)`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to generate variant ${variant.suffix} for ${s3Key}`,
          err,
        );
        results[variant.suffix] = null;
      }
    }

    // Generate dominant color (6x6 resize → average RGB)
    let dominantColor: string | null = null;
    try {
      const { data } = await sharp(orientedBuffer)
        .resize(6, 6, { fit: 'cover' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let r = 0,
        g = 0,
        b = 0;
      const pixels = data.length / 3;
      for (let i = 0; i < data.length; i += 3) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      const rr = Math.round(r / pixels);
      const gg = Math.round(g / pixels);
      const bb = Math.round(b / pixels);
      dominantColor = `#${rr.toString(16).padStart(2, '0')}${gg.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`;
    } catch {
      this.logger.warn(`Dominant color extraction failed for ${s3Key}`);
    }

    // Generate blurhash placeholder (tiny 32px WebP as data URL)
    let blurhash: string | null = null;
    try {
      const tiny = await sharp(orientedBuffer)
        .resize(32, 32, { fit: 'inside' })
        .webp({ quality: 20 })
        .toBuffer();
      blurhash = `data:image/webp;base64,${tiny.toString('base64')}`;
    } catch {
      this.logger.warn(`Blurhash generation failed for ${s3Key}`);
    }

    return {
      thumbnailKey: results['_thumb'] ?? null,
      mediumKey: results['_medium'] ?? null,
      smallKey: results['_sm'] ?? null,
      largeKey: results['_lg'] ?? null,
      width: originalWidth || null,
      height: originalHeight || null,
      blurhash,
      dominantColor,
    };
  }

  /**
   * Validate that the buffer is a genuine image by checking magic bytes.
   * Rejects decompression bombs, malformed files, and non-image data.
   */
  validateMagicBytes(buffer: Buffer): { valid: boolean; type: string | null } {
    if (buffer.length < 4) return { valid: false, type: null };

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { valid: true, type: 'image/jpeg' };
    }
    // PNG: 89 50 4E 47
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return { valid: true, type: 'image/png' };
    }
    // WebP: RIFF....WEBP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer.length >= 12 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { valid: true, type: 'image/webp' };
    }
    // HEIC/AVIF: ....ftyp (at offset 4)
    if (
      buffer.length >= 12 &&
      buffer[4] === 0x66 &&
      buffer[5] === 0x74 &&
      buffer[6] === 0x79 &&
      buffer[7] === 0x70
    ) {
      const brand = buffer.slice(8, 12).toString('ascii');
      if (brand.startsWith('avif')) return { valid: true, type: 'image/avif' };
      return { valid: true, type: 'image/heic' };
    }
    // GIF: GIF8
    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    ) {
      return { valid: true, type: 'image/gif' };
    }
    // BMP: BM
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
      return { valid: true, type: 'image/bmp' };
    }

    return { valid: false, type: null };
  }
}
