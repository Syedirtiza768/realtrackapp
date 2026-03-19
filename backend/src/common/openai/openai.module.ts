import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpenAiService } from './openai.service.js';
import { OpenAiQueueService, OpenAiQueueProcessor } from './openai-queue.service.js';
import { EnrichmentPipeline } from './pipelines/enrichment.pipeline.js';
import { ListingGenerationPipeline } from './pipelines/listing-generation.pipeline.js';
import { CompetitiveAnalysisPipeline } from './pipelines/competitive-analysis.pipeline.js';
import { CrossReferencePipeline } from './pipelines/cross-reference.pipeline.js';
import { PricingAnalysisPipeline } from './pipelines/pricing-analysis.pipeline.js';
import { CrossReference } from '../../listings/entities/cross-reference.entity.js';

/**
 * OpenAiModule — Global module providing centralised OpenAI access.
 *
 * @Global so every module can inject OpenAiService, pipelines, and queue
 * without importing OpenAiModule explicitly.
 *
 * Provides:
 *  - OpenAiService        → low-level chat/embed calls with retry + cost tracking
 *  - OpenAiQueueService   → BullMQ-backed async prompt queue
 *  - EnrichmentPipeline   → data enrichment (spreadsheet import, image analysis)
 *  - ListingGenerationPipeline → eBay listing content generation
 *  - CompetitiveAnalysisPipeline → competitive pricing intelligence
 *  - CrossReferencePipeline → OEM ↔ aftermarket cross-reference extraction
 *  - PricingAnalysisPipeline → AI pricing suggestions with cost/MAP enforcement
 */
@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: 'openai' }),
    TypeOrmModule.forFeature([CrossReference]),
  ],
  providers: [
    OpenAiService,
    OpenAiQueueService,
    OpenAiQueueProcessor,
    EnrichmentPipeline,
    ListingGenerationPipeline,
    CompetitiveAnalysisPipeline,
    CrossReferencePipeline,
    PricingAnalysisPipeline,
  ],
  exports: [
    OpenAiService,
    OpenAiQueueService,
    EnrichmentPipeline,
    ListingGenerationPipeline,
    CompetitiveAnalysisPipeline,
    CrossReferencePipeline,
    PricingAnalysisPipeline,
  ],
})
export class OpenAiModule {}
