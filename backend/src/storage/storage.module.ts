import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageAsset } from './entities/image-asset.entity.js';
import { StorageController } from './storage.controller.js';
import { StorageService } from './storage.service.js';
import { ImageProcessorService } from './image-processor.service.js';
import { ThumbnailProcessor } from './processors/thumbnail.processor.js';
import { CleanupProcessor } from './processors/cleanup.processor.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImageAsset]),
    BullModule.registerQueue(
      { name: 'storage-thumbnails' },
      { name: 'storage-cleanup' },
    ),
  ],
  controllers: [StorageController],
  providers: [
    StorageService,
    ImageProcessorService,
    ThumbnailProcessor,
    CleanupProcessor,
  ],
  exports: [StorageService, ImageProcessorService, TypeOrmModule],
})
export class StorageModule {}
