import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { PipelineJob } from '../ingestion/entities/pipeline-job.entity.js';
import { FitmentModule } from '../fitment/fitment.module.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { OpenAiModule } from '../common/openai/openai.module.js';
import { EnterpriseListingIntelligenceService } from '../ingestion/enterprise-listing-intelligence.service.js';
import { FitmentDiscoveryService } from './fitment-discovery.service.js';
import { ListingOptimizationService } from './listing-optimization.service.js';
import { ListingOptimizationProcessor } from './processors/listing-optimization.processor.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatalogProduct, PipelineJob]),
    BullModule.registerQueue({ name: 'listing-optimization' }),
    FitmentModule,
    ChannelsModule,
    OpenAiModule,
  ],
  providers: [
    FitmentDiscoveryService,
    ListingOptimizationService,
    ListingOptimizationProcessor,
    EnterpriseListingIntelligenceService,
  ],
  exports: [ListingOptimizationService, EnterpriseListingIntelligenceService],
})
export class ListingOptimizationModule {}
