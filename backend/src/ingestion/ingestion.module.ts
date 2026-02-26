import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionJob } from './entities/ingestion-job.entity.js';
import { AiResult } from './entities/ai-result.entity.js';
import { ImageAsset } from '../storage/entities/image-asset.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { IngestionController } from './ingestion.controller.js';
import { IngestionService } from './ingestion.service.js';
import { IngestionProcessor } from './processors/ingestion.processor.js';
import { AiModule } from './ai/ai.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ReviewController } from './review/review.controller.js';
import { ReviewService } from './review/review.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([IngestionJob, AiResult, ImageAsset, ListingRecord]),
    BullModule.registerQueue({ name: 'ingestion' }),
    AiModule,
    StorageModule,
  ],
  controllers: [IngestionController, ReviewController],
  providers: [IngestionService, IngestionProcessor, ReviewService],
  exports: [IngestionService],
})
export class IngestionModule {}
