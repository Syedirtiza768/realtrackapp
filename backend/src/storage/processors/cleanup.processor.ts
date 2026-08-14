import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { IsNull, LessThan, Like, Not, Repository } from 'typeorm';
import { ImageAsset } from '../entities/image-asset.entity.js';
import { StorageService } from '../storage.service.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';

/**
 * Scheduled daily cleanup of:
 * 1. Soft-deleted images older than 7 days (hard delete from S3)
 * 2. Orphaned temp/ uploads older than 24 hours (no listing, no job)
 * 3. Stranded temp/ uploads with a listingId but never moved to originals/
 *
 * Before hard-deleting an orphaned temp/ upload, this checks whether the
 * object is still referenced by `listing_records.itemPhotoUrl` or
 * `catalog_products.image_urls`. Those columns store plain S3 URL strings
 * with no FK back to `image_assets`, so an upload can be pulled into a
 * durable row (e.g. by a pipeline export that never called
 * `/storage/confirm`) while its `image_assets` row still looks orphaned.
 * Deleting it in that state permanently breaks the catalog image (this is
 * exactly what happened in the 2026-07 dead-temp-URL incidents — see
 * CHANGELOG.md). Instead we mirror the object to a durable key and repoint
 * the referencing rows first ("heal"), then delete the original.
 */
@Processor('storage-cleanup', { concurrency: 1 })
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    @InjectRepository(ImageAsset)
    private readonly assetRepo: Repository<ImageAsset>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(CatalogProduct)
    private readonly catalogRepo: Repository<CatalogProduct>,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(_job: Job): Promise<{ cleaned: number; healed: number }> {
    this.logger.log('Starting orphan image cleanup');

    let cleaned = 0;
    let healed = 0;

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
        if (this.storageService.isTempKey(asset.s3Key)) {
          const rowsHealed = await this.healIfReferenced(asset);
          if (rowsHealed > 0) {
            healed++;
            this.logger.warn(
              `Orphan temp asset ${asset.id} (${asset.s3Key}) was still referenced by ${rowsHealed} row(s) — mirrored to durable storage and repointed before deleting the original.`,
            );
          }
        }
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

    // 3. Stranded temp/ uploads that have a listingId but were never moved
    //    to originals/ (e.g. intake form set listingId without confirmUpload).
    //    Move them to originals/ and update the S3 key on the asset row.
    const strandedTemps = await this.assetRepo.find({
      where: {
        listingId: Not(IsNull()),
        s3Key: Like('%temp/%'),
        uploadedAt: LessThan(oneDayAgo),
      },
    });

    for (const asset of strandedTemps) {
      try {
        const newKey = await this.storageService.confirmUpload(
          asset.s3Key,
          asset.listingId!,
          asset.id,
        );
        asset.s3Key = newKey;
        asset.cdnUrl = this.storageService.getCdnUrl(newKey);
        await this.assetRepo.save(asset);
        healed++;
        this.logger.warn(
          `Stranded temp asset ${asset.id} (${asset.s3Key}) had listingId=${asset.listingId} — moved to originals/.`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to move stranded temp asset=${asset.id}`,
          err,
        );
      }
    }

    this.logger.log(
      `Cleanup complete: ${cleaned} images removed, ${healed} still-referenced temp uploads healed first`,
    );
    return { cleaned, healed };
  }

  /**
   * If `asset`'s temp/ S3 key is still referenced by any `listing_records.itemPhotoUrl`
   * or `catalog_products.image_urls`, mirror it to a durable key and repoint those
   * rows before the caller deletes the temp original. Returns the number of rows
   * repointed (0 = not referenced, safe to delete as before).
   */
  private async healIfReferenced(asset: ImageAsset): Promise<number> {
    const oldUrl = this.storageService.getCdnUrl(asset.s3Key);

    const [listingMatches, catalogMatches] = await Promise.all([
      this.listingRepo
        .createQueryBuilder('r')
        .where('r."itemPhotoUrl" LIKE :pattern', { pattern: `%${oldUrl}%` })
        .getMany(),
      this.catalogRepo
        .createQueryBuilder('c')
        .where(':url = ANY(c.image_urls)', { url: oldUrl })
        .getMany(),
    ]);

    if (listingMatches.length === 0 && catalogMatches.length === 0) {
      return 0;
    }

    const buf = await this.storageService.getObjectBuffer(asset.s3Key);
    const basename = asset.s3Key.split('/').pop();
    const destKey = this.storageService.buildDurableKey(
      `catalog-images/healed/${basename}`,
    );
    await this.storageService.putObject(destKey, buf, asset.mimeType);
    const newUrl = this.storageService.getCdnUrl(destKey);

    if (listingMatches.length > 0) {
      await this.listingRepo
        .createQueryBuilder()
        .update()
        .set({
          itemPhotoUrl: () => `replace("itemPhotoUrl", :old, :new)`,
        })
        .where('"itemPhotoUrl" LIKE :pattern', { pattern: `%${oldUrl}%` })
        .setParameters({ old: oldUrl, new: newUrl })
        .execute();
    }

    if (catalogMatches.length > 0) {
      await this.catalogRepo
        .createQueryBuilder()
        .update()
        .set({
          imageUrls: () => `array_replace(image_urls, :old, :new)`,
        })
        .where(':old = ANY(image_urls)', { old: oldUrl })
        .setParameters({ old: oldUrl, new: newUrl })
        .execute();
    }

    return listingMatches.length + catalogMatches.length;
  }
}
