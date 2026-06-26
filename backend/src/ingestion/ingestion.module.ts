import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../rbac/rbac.module.js';
import { IngestionJob } from './entities/ingestion-job.entity.js';
import { AiResult } from './entities/ai-result.entity.js';
import { ImageAsset } from '../storage/entities/image-asset.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { PipelineJob } from './entities/pipeline-job.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { IngestionController } from './ingestion.controller.js';
import { IngestionService } from './ingestion.service.js';
import { IngestionProcessor } from './processors/ingestion.processor.js';
import { PipelineController } from './pipeline.controller.js';
import { PipelineService } from './pipeline.service.js';
import { PipelineProcessor } from './processors/pipeline.processor.js';
import { AiModule } from './ai/ai.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { FeatureFlagModule } from '../common/feature-flags/feature-flag.module.js';
import { ReviewController } from './review/review.controller.js';
import { ReviewService } from './review/review.service.js';
import { ImageEnrichmentController } from './image-enrichment/image-enrichment.controller.js';
import { ImageEnrichmentService } from './image-enrichment/image-enrichment.service.js';
import { ImageSearchService } from './image-enrichment/image-search.service.js';
import { ImageOptimizerService } from './image-enrichment/image-optimizer.service.js';
import { OpenAiModule } from '../common/openai/openai.module.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { ListingOptimizationModule } from '../listing-optimization/listing-optimization.module.js';
import { HeavyJobLimiterModule } from '../common/jobs/heavy-job-limiter.module.js';
import { FitmentModule } from '../fitment/fitment.module.js';
import { PipelineOutputImageService } from './services/pipeline-output-image.service.js';
import { SingleListingFormService } from './services/single-listing-form.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([IngestionJob, AiResult, ImageAsset, ListingRecord, PipelineJob, CatalogProduct]),
    RbacModule,
    BullModule.registerQueue({ name: 'ingestion' }),
    BullModule.registerQueue({ name: 'pipeline' }),
    BullModule.registerQueue({ name: 'listing-optimization', defaultJobOptions: { removeOnComplete: { count: 50 }, removeOnFail: { count: 100 } } }),
    ListingOptimizationModule,
    FitmentModule,
    AiModule,
    StorageModule,
    FeatureFlagModule,
    OpenAiModule,
    ChannelsModule,
    HeavyJobLimiterModule,
  ],
  controllers: [IngestionController, ReviewController, PipelineController, ImageEnrichmentController],
  providers: [
    IngestionService,
    IngestionProcessor,
    ReviewService,
    PipelineService,
    PipelineProcessor,
    ImageEnrichmentService,
    ImageSearchService,
    ImageOptimizerService,
    PipelineOutputImageService,
    SingleListingFormService,
  ],
  exports: [IngestionService, PipelineService, ImageEnrichmentService, ListingOptimizationModule, SingleListingFormService],
})
export class IngestionModule {}
