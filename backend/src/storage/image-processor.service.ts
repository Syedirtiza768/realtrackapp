import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { StorageService } from './storage.service.js';

export interface ImageVariant {
  suffix: string;
  width: number;
  height: number;
  fit: keyof sharp.FitEnum;
}

export interface ProcessingResult {
  thumbnailKey: string | null;
  mediumKey: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
}

const VARIANTS: ImageVariant[] = [
  { suffix: '_thumb', width: 200, height: 200, fit: 'cover' },
  { suffix: '_medium', width: 800, height: 800, fit: 'inside' },
];

const MAX_ORIGINAL_DIMENSION = 2048;

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);

  constructor(private readonly storage: StorageService) {}

  /**
   * Process an uploaded image:
   * 1. Resize original to max 2048px + convert to WebP
   * 2. Generate thumbnail (200x200 cover)
   * 3. Generate medium (800x800 inside)
   * 4. Extract dimensions + blurhash placeholder
   */
  async processImage(s3Key: string): Promise<ProcessingResult> {
    this.logger.log(`Processing image: ${s3Key}`);

    const buffer = await this.storage.getObjectBuffer(s3Key);
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Resize original to max dimension + WebP
    const originalWidth = metadata.width ?? 0;
    const originalHeight = metadata.height ?? 0;
    const needsResize =
      originalWidth > MAX_ORIGINAL_DIMENSION ||
      originalHeight > MAX_ORIGINAL_DIMENSION;

    if (needsResize) {
      const resized = await sharp(buffer)
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

    // Generate variants
    let thumbnailKey: string | null = null;
    let mediumKey: string | null = null;

    for (const variant of VARIANTS) {
      try {
        const processed = await sharp(buffer)
          .resize(variant.width, variant.height, {
            fit: variant.fit,
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toBuffer();

        const variantKey = s3Key.replace(
          /\.\w+$/,
          `${variant.suffix}.webp`,
        );
        await this.storage.putObject(variantKey, processed, 'image/webp');

        if (variant.suffix === '_thumb') thumbnailKey = variantKey;
        if (variant.suffix === '_medium') mediumKey = variantKey;

        this.logger.debug(
          `Generated variant ${variant.suffix}: ${variantKey} (${processed.length} bytes)`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to generate variant ${variant.suffix} for ${s3Key}`,
          err,
        );
      }
    }

    // Generate blurhash (small 4x3 components)
    let blurhash: string | null = null;
    try {
      const tiny = await sharp(buffer)
        .resize(32, 32, { fit: 'inside' })
        .ensureAlpha()
        .raw()
        .toBuffer();
      // Simple base64 placeholder (full blurhash library can be added later)
      blurhash = tiny.toString('base64').substring(0, 50);
    } catch {
      this.logger.warn(`Blurhash generation failed for ${s3Key}`);
    }

    return {
      thumbnailKey,
      mediumKey,
      width: originalWidth || null,
      height: originalHeight || null,
      blurhash,
    };
  }

  /**
   * Validate that the buffer is a genuine image by checking magic bytes.
   */
  validateMagicBytes(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return true;
    }
    // PNG: 89 50 4E 47
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return true;
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
      return true;
    }
    // HEIC: ....ftyp (at offset 4)
    if (
      buffer.length >= 12 &&
      buffer[4] === 0x66 &&
      buffer[5] === 0x74 &&
      buffer[6] === 0x79 &&
      buffer[7] === 0x70
    ) {
      return true;
    }

    return false;
  }
}
