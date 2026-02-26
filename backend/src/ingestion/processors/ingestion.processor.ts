import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { IngestionJob } from '../entities/ingestion-job.entity.js';
import { AiResult } from '../entities/ai-result.entity.js';
import { ImageAsset } from '../../storage/entities/image-asset.entity.js';
import { AiService } from '../ai/ai.service.js';
import { StorageService } from '../../storage/storage.service.js';

export interface IngestionJobData {
  jobId: string;
  assetIds: string[];
  mode: 'single' | 'bulk' | 'bundle';
  preferredProvider: 'openai' | 'google';
}

const AUTO_APPROVE_THRESHOLD = 0.85;

/**
 * BullMQ processor for ingestion jobs.
 *
 * Steps:
 * 1. Fetch images from S3 (signed URLs)
 * 2. Call Vision API with structured prompt
 * 3. Parse & normalize response → ai_results row
 * 4. Run confidence scoring
 * 5. If confidence_overall >= 0.85 → auto_approved → create listing draft
 * 6. If confidence_overall < 0.85 → needs_review
 * 7. On failure → increment attempt_count, schedule retry
 */
@Processor('ingestion', { concurrency: 3 })
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    @InjectRepository(IngestionJob)
    private readonly jobRepo: Repository<IngestionJob>,
    @InjectRepository(AiResult)
    private readonly aiResultRepo: Repository<AiResult>,
    @InjectRepository(ImageAsset)
    private readonly assetRepo: Repository<ImageAsset>,
    private readonly aiService: AiService,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<IngestionJobData>): Promise<void> {
    const { jobId, assetIds, preferredProvider } = job.data;
    this.logger.log(`Processing ingestion job=${jobId}`);

    // Mark job as "processing"
    await this.jobRepo.update(jobId, {
      status: 'processing',
      attemptCount: () => '"attempt_count" + 1',
    } as never);

    try {
      // 1. Fetch image URLs from S3
      const assets = await this.assetRepo.findByIds(assetIds);
      const imageUrls = assets.map((a) =>
        this.storageService.getCdnUrl(a.s3Key),
      );

      if (imageUrls.length === 0) {
        throw new Error('No images found for this job');
      }

      // 2. Mark AI start time
      await this.jobRepo.update(jobId, { aiStartedAt: new Date() });

      // 3. Call Vision API
      const aiResponse = await this.aiService.analyzeImages(
        imageUrls,
        preferredProvider,
      );

      // 4. Normalize the response
      const normalized = this.aiService.normalizeResponse(aiResponse);

      // 5. Save AI result
      const aiResult = this.aiResultRepo.create({
        jobId,
        rawResponse: aiResponse.raw,
        provider: aiResponse.provider,
        model: aiResponse.model,
        tokensUsed: aiResponse.tokensUsed,
        latencyMs: aiResponse.latencyMs,
        extractedTitle: normalized.title,
        extractedBrand: normalized.brand,
        extractedMpn: normalized.mpn,
        extractedOemNumber: normalized.oemNumber,
        extractedPartType: normalized.partType,
        extractedCondition: normalized.condition,
        extractedPriceEstimate: normalized.priceEstimate,
        extractedDescription: normalized.description,
        extractedFeatures: normalized.features,
        extractedFitmentRaw: normalized.fitmentRaw,
        confidenceTitle: normalized.confidenceTitle,
        confidenceBrand: normalized.confidenceBrand,
        confidenceMpn: normalized.confidenceMpn,
        confidencePartType: normalized.confidencePartType,
        confidenceOverall: normalized.confidenceOverall,
      });
      await this.aiResultRepo.save(aiResult);

      // 6. Determine review status based on confidence
      const reviewStatus =
        normalized.confidenceOverall >= AUTO_APPROVE_THRESHOLD
          ? 'auto_approved'
          : 'needs_review';

      // 7. Update job
      await this.jobRepo.update(jobId, {
        status: 'ai_complete',
        aiProvider: aiResponse.provider,
        aiModel: aiResponse.model,
        aiCompletedAt: new Date(),
        aiCostUsd: aiResponse.estimatedCostUsd,
        reviewStatus,
      });

      this.logger.log(
        `Ingestion job ${jobId} complete — confidence=${normalized.confidenceOverall.toFixed(2)}, review=${reviewStatus}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Ingestion job ${jobId} failed: ${message}`);

      // Calculate next retry time with exponential backoff
      const job_record = await this.jobRepo.findOneBy({ id: jobId });
      const attemptCount = (job_record?.attemptCount ?? 0);
      const backoffMs = [30_000, 120_000, 600_000][Math.min(attemptCount - 1, 2)] ?? 600_000;
      const nextRetryAt = new Date(Date.now() + backoffMs);

      await this.jobRepo.update(jobId, {
        status: 'failed',
        lastError: message.substring(0, 2000),
        nextRetryAt:
          attemptCount < (job_record?.maxAttempts ?? 3) ? nextRetryAt : null,
      });

      throw err; // Let BullMQ handle retry
    }
  }
}
