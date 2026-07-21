import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpenAiService } from './openai.service.js';
import {
  OpenAiQueueService,
  OpenAiQueueProcessor,
} from './openai-queue.service.js';
import { EnrichmentPipeline } from './pipelines/enrichment.pipeline.js';
import { VisionEnrichmentPipeline } from './pipelines/vision-enrichment.pipeline.js';
import { ListingGenerationPipeline } from './pipelines/listing-generation.pipeline.js';
import { TitlePositionPartNamePipeline } from './pipelines/title-position-part-name.pipeline.js';
import { CompetitiveAnalysisPipeline } from './pipelines/competitive-analysis.pipeline.js';
import { CrossReferencePipeline } from './pipelines/cross-reference.pipeline.js';
import { PricingAnalysisPipeline } from './pipelines/pricing-analysis.pipeline.js';
import { CrossReference } from '../../listings/entities/cross-reference.entity.js';
import { AiRunLog } from './entities/ai-run-log.entity.js';
import { AiRoutingPolicyHistory } from './entities/ai-routing-policy-history.entity.js';
import { ComplianceAuditLog } from '../../catalog-import/entities/compliance-audit-log.entity.js';
import { ModelRouter } from './model-router.js';
import { ListingQualityValidator } from './listing-quality.validator.js';
import { AiRunLogService } from './ai-run-log.service.js';
import { AiOptimizerService } from './ai-optimizer.service.js';
import { ListingGuardAuditService } from './listing-guard-audit.service.js';
import { AiRoutingController } from './ai-routing.controller.js';
import { EbayTaxonomyTruthService } from './ebay-taxonomy-truth.service.js';
import { EnrichmentCacheService } from './enrichment-cache.service.js';
import { EbayCategory } from '../../listings/entities/ebay-category.entity.js';

/**
 * OpenAiModule — Global module providing centralised OpenAI access.
 */
@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: 'openai' }),
    TypeOrmModule.forFeature([
      CrossReference,
      AiRunLog,
      AiRoutingPolicyHistory,
      ComplianceAuditLog,
      EbayCategory,
    ]),
  ],
  controllers: [AiRoutingController],
  providers: [
    OpenAiService,
    OpenAiQueueService,
    OpenAiQueueProcessor,
    ModelRouter,
    ListingQualityValidator,
    AiRunLogService,
    AiOptimizerService,
    ListingGuardAuditService,
    EbayTaxonomyTruthService,
    EnrichmentCacheService,
    EnrichmentPipeline,
    VisionEnrichmentPipeline,
    ListingGenerationPipeline,
    TitlePositionPartNamePipeline,
    CompetitiveAnalysisPipeline,
    CrossReferencePipeline,
    PricingAnalysisPipeline,
  ],
  exports: [
    OpenAiService,
    OpenAiQueueService,
    ModelRouter,
    ListingQualityValidator,
    AiRunLogService,
    AiOptimizerService,
    EnrichmentCacheService,
    EnrichmentPipeline,
    VisionEnrichmentPipeline,
    ListingGenerationPipeline,
    TitlePositionPartNamePipeline,
    CompetitiveAnalysisPipeline,
    CrossReferencePipeline,
    PricingAnalysisPipeline,
  ],
})
export class OpenAiModule {}
