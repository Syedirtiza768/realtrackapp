import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { IsNull, LessThan, Repository } from 'typeorm';
import { ImageAsset } from '../entities/image-asset.entity.js';
import { StorageService } from '../storage.service.js';

/**
 * Scheduled daily cleanup of:
 * 1. Orphaned temp/ uploads older than 24 hours
 * 2. Soft-deleted images older than 7 days (hard delete from S3)
 */
@Processor('storage-cleanup', { concurrency: 1 })
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    @InjectRepository(ImageAsset)
    private readonly assetRepo: Repository<ImageAsset>,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(_job: Job): Promise<{ cleaned: number }> {
    this.logger.log('Starting orphan image cleanup');

    let cleaned = 0;

    // 1. Clean soft-deleted images older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const deletedAssets = await this.assetRepo.find({
      where: { deletedAt: LessThan(sevenDaysAgo) },
      withDeleted: true,
    });

    for (const asset of deletedAssets) {
      try {
        await this.storageService.deleteObject(asset.s3Key);
        if (asset.s3KeyThumb) {
          await this.storageService.deleteObject(asset.s3KeyThumb);
        }
        // Hard-remove from DB
        await this.assetRepo.delete(asset.id);
        cleaned++;
      } catch (err) {
        this.logger.error(`Failed to clean asset=${asset.id}`, err);
      }
    }

    // 2. Clean orphaned temp uploads (no listing, no job, older than 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orphanedAssets = await this.assetRepo.find({
      where: {
        listingId: IsNull(),
        jobId: IsNull(),
        uploadedAt: LessThan(oneDayAgo),
      },
    });

    for (const asset of orphanedAssets) {
      try {
        await this.storageService.deleteObject(asset.s3Key);
        if (asset.s3KeyThumb) {
          await this.storageService.deleteObject(asset.s3KeyThumb);
        }
        await this.assetRepo.delete(asset.id);
        cleaned++;
      } catch (err) {
        this.logger.error(`Failed to clean orphan asset=${asset.id}`, err);
      }
    }

    this.logger.log(`Cleanup complete: ${cleaned} images removed`);
    return { cleaned };
  }
}
