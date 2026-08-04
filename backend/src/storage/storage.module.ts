import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageAsset } from './entities/image-asset.entity.js';
import { ImageDriveAsset } from './entities/image-drive-asset.entity.js';
import { StorageController } from './storage.controller.js';
import { ImageDriveController } from './image-drive.controller.js';
import { StorageService } from './storage.service.js';
import { ImageDriveService } from './image-drive.service.js';
import { ImageProcessorService } from './image-processor.service.js';
import { ThumbnailProcessor } from './processors/thumbnail.processor.js';
import { CleanupProcessor } from './processors/cleanup.processor.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';

@Module({
  imports: [
    // ListingRecord/CatalogProduct are registered here (in addition to their
    // owning modules) so CleanupProcessor can check whether a temp/ upload it's
    // about to delete is still referenced by itemPhotoUrl/image_urls before
    // deleting it — those columns are plain strings with no FK back to
    // image_assets, so this is the only way to detect a leaked reference.
    TypeOrmModule.forFeature([
      ImageAsset,
      ImageDriveAsset,
      ListingRecord,
      CatalogProduct,
    ]),
    BullModule.registerQueue(
      { name: 'storage-thumbnails' },
      { name: 'storage-cleanup' },
    ),
  ],
  controllers: [StorageController, ImageDriveController],
  providers: [
    StorageService,
    ImageDriveService,
    ImageProcessorService,
    ThumbnailProcessor,
    CleanupProcessor,
  ],
  exports: [StorageService, ImageDriveService, ImageProcessorService, TypeOrmModule],
})
export class StorageModule {}
