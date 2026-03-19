import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MotorsIntelligenceService } from '../services/motors-intelligence.service';
import { EbayEnrichmentService } from '../services/ebay-enrichment.service';

export interface MotorsPipelineJobData {
  motorsProductId: string;
  stage?: 'full' | 'extraction' | 'identity' | 'fitment' | 'enrichment' | 'listing' | 'compliance' | 'publish';
  connectionId?: string;
}

@Processor('motors-pipeline')
export class MotorsPipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(MotorsPipelineProcessor.name);

  constructor(
    private readonly motorsService: MotorsIntelligenceService,
    private readonly ebayEnrichmentService: EbayEnrichmentService,
  ) {
    super();
  }

  async process(job: Job<MotorsPipelineJobData>): Promise<any> {
    const { motorsProductId, stage = 'full', connectionId } = job.data;

    this.logger.log(
      `Processing Motors pipeline job ${job.id} for product ${motorsProductId} (stage: ${stage})`,
    );

    try {
      // Update BullMQ job progress for monitoring
      await job.updateProgress(0);

      switch (stage) {
        case 'full': {
          // Run the main 6-stage pipeline
          await job.updateProgress(10);
          const result = await this.motorsService.runPipeline(motorsProductId);

          // After main pipeline, run eBay enrichment if successful
          if (result.status !== 'failed') {
            await job.updateProgress(80);
            try {
              const enrichment = await this.ebayEnrichmentService.enrichProduct(motorsProductId);
              this.logger.log(
                `eBay enrichment completed for ${motorsProductId}: ` +
                `category=${enrichment.categoryId}, aspects=${enrichment.aspects.length}, ` +
                `confidence=${enrichment.enrichmentConfidence}`,
              );
            } catch (err) {
              this.logger.warn(`eBay enrichment failed (non-blocking): ${err.message}`);
            }
          }

          await job.updateProgress(100);
          return result;
        }

        case 'enrichment':
          await job.updateProgress(10);
          const enrichResult = await this.ebayEnrichmentService.enrichProduct(motorsProductId);
          await job.updateProgress(100);
          return enrichResult;

        case 'publish':
          if (!connectionId) {
            throw new Error('connectionId required for publish stage');
          }
          await job.updateProgress(10);
          const publishResult = await this.motorsService.publish(motorsProductId, connectionId);
          await job.updateProgress(100);
          return publishResult;

        default:
          // For individual stages, run the full pipeline
          await job.updateProgress(10);
          const defaultResult = await this.motorsService.runPipeline(motorsProductId);
          await job.updateProgress(100);
          return defaultResult;
      }
    } catch (error) {
      this.logger.error(
        `Pipeline job ${job.id} failed for product ${motorsProductId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
