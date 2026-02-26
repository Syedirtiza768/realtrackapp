import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { ImageAsset } from '../entities/image-asset.entity.js';
import { ImageProcessorService } from '../image-processor.service.js';
import { StorageService } from '../storage.service.js';

export interface ThumbnailJobData {
  assetId: string;
  s3Key: string;
}

@Processor('storage-thumbnails', { concurrency: 5 })
export class ThumbnailProcessor extends WorkerHost {
  private readonly logger = new Logger(ThumbnailProcessor.name);

  constructor(
    private readonly imageProcessor: ImageProcessorService,
    private readonly storageService: StorageService,
    @InjectRepository(ImageAsset)
    private readonly assetRepo: Repository<ImageAsset>,
  ) {
    super();
  }

  async process(job: Job<ThumbnailJobData>): Promise<void> {
    const { assetId, s3Key } = job.data;
    this.logger.log(`Generating thumbnails for asset=${assetId}`);

    try {
      const result = await this.imageProcessor.processImage(s3Key);

      await this.assetRepo.update(assetId, {
        s3KeyThumb: result.thumbnailKey,
        cdnUrl: this.storageService.getCdnUrl(s3Key),
        width: result.width,
        height: result.height,
        blurhash: result.blurhash,
      });

      this.logger.log(`Thumbnails generated for asset=${assetId}`);
    } catch (err) {
      this.logger.error(`Thumbnail generation failed for asset=${assetId}`, err);
      throw err; // triggers BullMQ retry
    }
  }
}
