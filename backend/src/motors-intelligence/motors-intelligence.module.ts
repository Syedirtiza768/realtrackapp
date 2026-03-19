import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

// Entities
import {
  MotorsProduct,
  ProductCandidate,
  ExtractedAttribute,
  EbayCategoryMapping,
  EbayAspectRequirement,
  ValidationResult,
  ReviewTask,
  CorrectionRule,
  ListingGeneration,
  MotorsFeedbackLog,
} from './entities';

// Services
import {
  VisionExtractionService,
  ProductIdentityService,
  ListingGeneratorService,
  ComplianceEngineService,
  FitmentResolverService,
  ReviewQueueService,
  MotorsIntelligenceService,
  MotorsPublisherService,
  EbayEnrichmentService,
} from './services';

// Controllers
import {
  MotorsIntelligenceController,
  ReviewQueueController,
} from './controllers';

// Processors
import { MotorsPipelineProcessor } from './processors';

// External entities (from other modules)
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity';
import { PartFitment } from '../fitment/entities/part-fitment.entity';
import { FitmentMake } from '../fitment/entities/fitment-make.entity';
import { FitmentModel } from '../fitment/entities/fitment-model.entity';

// External modules
import { ChannelsModule } from '../channels/channels.module';
import { ListingsModule } from '../listings/listings.module';
import { FeatureFlagModule } from '../common/feature-flags/feature-flag.module';
import { FitmentModule } from '../fitment/fitment.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MotorsProduct,
      ProductCandidate,
      ExtractedAttribute,
      EbayCategoryMapping,
      EbayAspectRequirement,
      ValidationResult,
      ReviewTask,
      CorrectionRule,
      ListingGeneration,
      MotorsFeedbackLog,
      // External entities needed by services
      CatalogProduct,
      PartFitment,
      FitmentMake,
      FitmentModel,
    ]),
    BullModule.registerQueue({ name: 'motors-pipeline' }),
    ChannelsModule,
    ListingsModule,
    FeatureFlagModule,
    FitmentModule,
    StorageModule,
  ],
  controllers: [
    MotorsIntelligenceController,
    ReviewQueueController,
  ],
  providers: [
    VisionExtractionService,
    ProductIdentityService,
    ListingGeneratorService,
    ComplianceEngineService,
    FitmentResolverService,
    ReviewQueueService,
    MotorsIntelligenceService,
    MotorsPublisherService,
    EbayEnrichmentService,
    MotorsPipelineProcessor,
  ],
  exports: [
    MotorsIntelligenceService,
    ReviewQueueService,
    EbayEnrichmentService,
  ],
})
export class MotorsIntelligenceModule {}
