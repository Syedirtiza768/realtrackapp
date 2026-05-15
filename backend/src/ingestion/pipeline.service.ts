import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { PipelineJob } from './entities/pipeline-job.entity.js';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import { EnterpriseListingIntelligenceService } from './enterprise-listing-intelligence.service.js';
import type { ListingQualityProfile } from './enterprise-listing-intelligence.service.js';
import { ListingOptimizationService } from '../listing-optimization/listing-optimization.service.js';
import type { JobOptimizationStatus } from '../listing-optimization/listing-optimization.types.js';

export interface CreatePipelineJobDto {
  originalFilename: string;
  storedFilePath: string;
  fileSizeBytes?: number;
}

export interface PipelineJobSummary {
  total: number;
  byStatus: Record<string, number>;
  totalPartsProcessed: number;
  totalEnriched: number;
  totalTokens: number;
}

export interface CombinedOptimizationResult {
  job: PipelineJob;
  enterprise: EnterpriseOptimizationResult;
}

export type EnterpriseOptimizationResult = Awaited<
  ReturnType<EnterpriseListingIntelligenceService['generateForPipelineJob']>
>;

/**
 * PipelineService — manages enrichment pipeline jobs.
 *
 * This is an ADDITIVE service that wraps the existing ebay-enrichment-pipeline.mjs
 * as a backend-managed BullMQ job. It does NOT modify any existing ingestion logic.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    @InjectRepository(PipelineJob)
    private readonly jobRepo: Repository<PipelineJob>,
    @InjectQueue('pipeline')
    private readonly pipelineQueue: Queue,
    private readonly featureFlagService: FeatureFlagService,
    private readonly enterpriseListingIntelligence: EnterpriseListingIntelligenceService,
    private readonly listingOptimization: ListingOptimizationService,
  ) {}

  /**
   * Create a new enrichment pipeline job and enqueue for processing.
   */
  async createJob(dto: CreatePipelineJobDto, userId?: string): Promise<PipelineJob> {
    const enabled = await this.featureFlagService.isEnabled('pipeline_enrichment');
    if (!enabled) {
      throw new Error('Pipeline enrichment feature is not enabled. Enable the "pipeline_enrichment" feature flag.');
    }

    const job = this.jobRepo.create({
      originalFilename: dto.originalFilename,
      storedFilePath: dto.storedFilePath,
      fileSizeBytes: dto.fileSizeBytes ?? null,
      status: 'pending',
      createdBy: userId ?? null,
    });

    const saved = await this.jobRepo.save(job);

    await this.pipelineQueue.add(
      'run-pipeline',
      {
        jobId: saved.id,
        filePath: dto.storedFilePath,
        originalFilename: dto.originalFilename,
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    this.logger.log(`Created pipeline job ${saved.id} for file: ${dto.originalFilename}`);
    return saved;
  }

  /**
   * List pipeline jobs with optional status filter.
   */
  async listJobs(
    status?: string,
    limit = 20,
    offset = 0,
  ): Promise<{ jobs: PipelineJob[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [jobs, total] = await this.jobRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { jobs, total };
  }

  /**
   * Get a single pipeline job by ID.
   */
  async getJob(id: string): Promise<PipelineJob> {
    const job = await this.jobRepo.findOneBy({ id });
    if (!job) throw new NotFoundException(`Pipeline job ${id} not found`);
    return job;
  }

  /**
   * Update job progress (called from the BullMQ processor).
   */
  async updateProgress(
    id: string,
    update: Partial<PipelineJob>,
  ): Promise<PipelineJob> {
    await this.jobRepo.update(id, update as any);
    return this.getJob(id);
  }

  /**
   * Cancel a pending/processing pipeline job.
   */
  async cancelJob(id: string): Promise<PipelineJob> {
    const job = await this.getJob(id);
    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new Error(`Job ${id} cannot be cancelled (current: ${job.status})`);
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    return this.jobRepo.save(job);
  }

  /**
   * Retry a failed pipeline job.
   */
  async retryJob(id: string): Promise<PipelineJob> {
    const job = await this.getJob(id);
    if (job.status !== 'failed') {
      throw new Error(`Job ${id} is not in failed state (current: ${job.status})`);
    }

    job.status = 'pending';
    job.lastError = null;
    job.errorCount = 0;
    job.startedAt = null;
    job.completedAt = null;
    await this.jobRepo.save(job);

    await this.pipelineQueue.add(
      'run-pipeline',
      {
        jobId: id,
        filePath: job.storedFilePath,
        originalFilename: job.originalFilename,
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );

    this.logger.log(`Retrying pipeline job ${id}`);
    return job;
  }

  /**
   * Get aggregate stats for pipeline jobs using a single DB query.
   */
  async getStats(): Promise<PipelineJobSummary> {
    const result = await this.jobRepo
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(job.processedParts), 0)', 'totalPartsProcessed')
      .addSelect('COALESCE(SUM(job.enrichedCount), 0)', 'totalEnriched')
      .addSelect('COALESCE(SUM(job.openaiTokensUsed), 0)', 'totalTokens')
      .groupBy('job.status')
      .getRawMany<{
        status: string;
        count: string;
        totalPartsProcessed: string;
        totalEnriched: string;
        totalTokens: string;
      }>();

    const byStatus: Record<string, number> = {};
    let total = 0;
    let totalPartsProcessed = 0;
    let totalEnriched = 0;
    let totalTokens = 0;

    for (const row of result) {
      const count = parseInt(row.count, 10);
      byStatus[row.status] = count;
      total += count;
      totalPartsProcessed += parseInt(row.totalPartsProcessed, 10) || 0;
      totalEnriched += parseInt(row.totalEnriched, 10) || 0;
      totalTokens += parseInt(row.totalTokens, 10) || 0;
    }

    return {
      total,
      byStatus,
      totalPartsProcessed,
      totalEnriched,
      totalTokens,
    };
  }

  async generateEnterpriseOptimization(
    jobId: string,
    options?: {
      marketplace?: 'US' | 'DE' | 'AU';
      limit?: number;
      aiBudgetListings?: number;
      listingQualityProfile?: ListingQualityProfile;
    },
  ): Promise<EnterpriseOptimizationResult> {
    const enterpriseDefaults = this.normalizeEnterpriseOptions(options);
    return this.enterpriseListingIntelligence.generateForPipelineJob(jobId, enterpriseDefaults);
  }

  async runCombinedOptimization(
    jobId: string,
    options?: {
      marketplace?: 'US' | 'DE' | 'AU';
      limit?: number;
      aiBudgetListings?: number;
      listingQualityProfile?: ListingQualityProfile;
    },
  ): Promise<CombinedOptimizationResult> {
    const job = await this.getJob(jobId);
    if (job.status !== 'completed') {
      throw new BadRequestException(
        `Pipeline job ${jobId} is ${job.status}. Wait until enrichment pipeline completes.`,
      );
    }

    const marketplace = options?.marketplace ?? 'US';
    await this.listingOptimization.enqueueJobOptimization(jobId, marketplace);

    const status = await this.getOptimizationStatus(jobId);
    const refreshedJob = await this.getJob(jobId);
    return {
      job: refreshedJob,
      enterprise: this.optimizationStatusToEnterpriseResult(jobId, status, marketplace),
    };
  }

  async getOptimizationStatus(jobId: string): Promise<JobOptimizationStatus> {
    return this.listingOptimization.getJobOptimizationStatus(jobId);
  }

  async getProductOptimization(productId: string) {
    return this.listingOptimization.getProductOptimization(productId);
  }

  async rerunProductOptimization(
    productId: string,
    marketplace: 'US' | 'DE' | 'AU' = 'US',
  ) {
    return this.listingOptimization.optimizeProduct(productId, marketplace, { force: true });
  }

  async markProductManualReview(productId: string, enabled = true) {
    return this.listingOptimization.markManualReview(productId, enabled);
  }

  private optimizationStatusToEnterpriseResult(
    jobId: string,
    status: JobOptimizationStatus,
    marketplace: 'US' | 'DE' | 'AU',
  ): EnterpriseOptimizationResult {
    return {
      jobId,
      marketplace,
      totalProducts: status.total,
      aiGeneratedCount: status.processed,
      blockedCount: status.blockCount,
      reviewCount: status.reviewCount,
      passCount: status.passCount,
      averageUploadReadiness:
        status.products.length > 0
          ? Math.round(
              (status.products.reduce((s, p) => s + p.uploadReadinessScore, 0) /
                status.products.length) *
                100,
            ) / 100
          : 0,
      listings: status.products.map((p) => ({
        productId: p.productId,
        sku: p.sku,
        optimizedTitle: p.optimizedTitle ?? '',
        validationStatus: p.validationStatus,
        uploadReadinessScore: p.uploadReadinessScore,
        complianceWarnings: [...p.errors, ...p.warnings],
        missingDataReport: p.missingDataReport,
        finalUploadPayload: {},
      })) as EnterpriseOptimizationResult['listings'],
    };
  }

  private normalizeEnterpriseOptions(options?: {
    marketplace?: 'US' | 'DE' | 'AU';
    limit?: number;
    aiBudgetListings?: number;
    listingQualityProfile?: ListingQualityProfile;
  }): {
    marketplace?: 'US' | 'DE' | 'AU';
    limit?: number;
    aiBudgetListings?: number;
    listingQualityProfile?: ListingQualityProfile;
  } {
    const limit = options?.limit;
    return {
      marketplace: options?.marketplace,
      limit,
      // Enforce full enterprise AI optimization coverage for all selected rows.
      aiBudgetListings: limit,
      listingQualityProfile: options?.listingQualityProfile ?? 'max_seo_comprehensive',
    };
  }
}
