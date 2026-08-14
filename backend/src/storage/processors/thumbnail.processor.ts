import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { ImageAsset } from '../entities/image-asset.entity.js';
import { ImageDriveAsset } from '../entities/image-drive-asset.entity.js';
import { ImageProcessorService } from '../image-processor.service.js';
import { StorageService } from '../storage.service.js';

export interface ThumbnailJobData {
  assetId: string;
  s3Key: string;
}

export interface CatalogVariantJobData {
  s3Key: string;
}

export interface DriveVariantJobData {
  assetId: string;
  s3Key: string;
}

@Processor('storage-thumbnails', { concurrency: 15 })
export class ThumbnailProcessor extends WorkerHost {
  private readonly logger = new Logger(ThumbnailProcessor.name);

  constructor(
    private readonly imageProcessor: ImageProcessorService,
    private readonly storageService: StorageService,
    @InjectRepository(ImageAsset)
    private readonly assetRepo: Repository<ImageAsset>,
    @InjectRepository(ImageDriveAsset)
    private readonly driveAssetRepo: Repository<ImageDriveAsset>,
  ) {
    super();
  }

  async process(
    job: Job<ThumbnailJobData | CatalogVariantJobData | DriveVariantJobData>,
  ): Promise<void> {
    if (job.name === 'generate-catalog-variants') {
      const { s3Key } = job.data as CatalogVariantJobData;
      this.logger.log(`Generating catalog-image variants for key=${s3Key}`);
      try {
        await this.imageProcessor.processImage(s3Key);
      } catch (err) {
        this.logger.error(
          `Catalog variant generation failed for ${s3Key}`,
          err,
        );
        throw err;
      }
      return;
    }

    if (job.name === 'generate-drive-variants') {
      const { assetId, s3Key } = job.data as DriveVariantJobData;
      this.logger.log(`Generating drive variants for asset=${assetId}`);
      try {
        const result = await this.imageProcessor.processImage(s3Key);

        await this.driveAssetRepo.update(assetId, {
          s3KeyThumb: result.thumbnailKey,
          s3KeyMedium: result.mediumKey,
          width: result.width,
          height: result.height,
          blurhash: result.blurhash,
        });

        this.logger.log(`Drive variants generated for asset=${assetId}`);
      } catch (err) {
        this.logger.error(
          `Drive variant generation failed for asset=${assetId}`,
          err,
        );
        throw err;
      }
      return;
    }

    const { assetId, s3Key } = job.data as ThumbnailJobData;
    this.logger.log(`Generating thumbnails for asset=${assetId}`);

    try {
      const result = await this.imageProcessor.processImage(s3Key);

      await this.assetRepo.update(assetId, {
        s3KeyThumb: result.thumbnailKey,
        s3KeyMedium: result.mediumKey,
        cdnUrl: this.storageService.getCdnUrl(s3Key),
        width: result.width,
        height: result.height,
        blurhash: result.blurhash,
      });

      this.logger.log(`Thumbnails generated for asset=${assetId}`);
    } catch (err) {
      this.logger.error(
        `Thumbnail generation failed for asset=${assetId}`,
        err,
      );
      throw err;
    }
  }
}
