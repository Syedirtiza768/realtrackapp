import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PipelineJob } from './entities/pipeline-job.entity.js';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import { EnterpriseListingIntelligenceService } from './enterprise-listing-intelligence.service.js';
import type { ListingQualityProfile } from './enterprise-listing-intelligence.service.js';
import { ListingOptimizationService } from '../listing-optimization/listing-optimization.service.js';
import type { JobOptimizationStatus } from '../listing-optimization/listing-optimization.types.js';
import { applyCreatedByVisibility, canViewJob, withCreatedByBackfill } from '../common/utils/job-visibility.js';
import { HeavyJobLimiterService } from '../common/jobs/heavy-job-limiter.service.js';

export interface CreatePipelineJobDto {
  originalFilename: string;
  storedFilePath: string;
  fileSizeBytes?: number;
}

export interface CreateSingleListingDto {
  sku?: string;
  brand?: string;
  model?: string;
  vin?: string;
  category?: string;
  partNumber?: string;
  partName?: string;
  note?: string;
  price?: number;
  quantity?: number;
  imageUrls?: string;
  uploadedAssetIds?: string[];
}

export interface PipelineJobSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
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
    private readonly heavyJobLimiter: HeavyJobLimiterService,
  ) {}

  private pipelineUploadRoot(): string {
    const projectRoot = process.env.PIPELINE_PROJECT_ROOT || path.resolve(process.cwd(), '..');
    return path.resolve(projectRoot, 'uploads', 'pipeline');
  }

  private ensureJobUploadDir(jobId: string): string {
    const dir = path.join(this.pipelineUploadRoot(), jobId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /**
   * Upload buffer to a job-scoped directory, persist the job row, and enqueue processing.
   */
  async createJobFromUpload(
    originalFilename: string,
    fileBuffer: Buffer,
    userId?: string,
  ): Promise<PipelineJob> {
    await this.heavyJobLimiter.assertPipelineSlotAvailable();

    const enabled = await this.featureFlagService.isEnabled('pipeline_enrichment');
    if (!enabled) {
      throw new ServiceUnavailableException(
        'Pipeline enrichment feature is not enabled. Enable the "pipeline_enrichment" feature flag.',
      );
    }

    const placeholder = await this.jobRepo.save(
      this.jobRepo.create({
        originalFilename,
        storedFilePath: 'pending',
        fileSizeBytes: fileBuffer.length,
        status: 'pending',
        createdBy: userId ?? null,
      }),
    );

    const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedPath = path.join(
      this.ensureJobUploadDir(placeholder.id),
      `${Date.now()}_${safeName}`,
    );
    fs.writeFileSync(storedPath, fileBuffer);

    await this.jobRepo.update(placeholder.id, { storedFilePath: storedPath });
    const saved = await this.jobRepo.findOneByOrFail({ id: placeholder.id });
    return this.enqueuePipelineJob(saved, storedPath, originalFilename);
  }

  /**
   * Create a new enrichment pipeline job and enqueue for processing.
   */
  async createJob(dto: CreatePipelineJobDto, userId?: string): Promise<PipelineJob> {
    await this.heavyJobLimiter.assertPipelineSlotAvailable();
    const enabled = await this.featureFlagService.isEnabled('pipeline_enrichment');
    if (!enabled) {
      throw new ServiceUnavailableException('Pipeline enrichment feature is not enabled. Enable the "pipeline_enrichment" feature flag.');
    }

    const job = this.jobRepo.create({
      originalFilename: dto.originalFilename,
      storedFilePath: dto.storedFilePath,
      fileSizeBytes: dto.fileSizeBytes ?? null,
      status: 'pending',
      createdBy: userId ?? null,
    });

    let saved: PipelineJob;
    try {
      saved = await this.jobRepo.save(job);
    } catch (err) {
      this.logger.error(
        `Failed to save pipeline job: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Failed to create pipeline job. Database may be unreachable or schema is out of date.',
      );
    }

    return this.enqueuePipelineJob(saved, dto.storedFilePath, dto.originalFilename);
  }

  private async enqueuePipelineJob(
    saved: PipelineJob,
    filePath: string,
    originalFilename: string,
  ): Promise<PipelineJob> {
    try {
      await this.pipelineQueue.add(
        'run-pipeline',
        {
          jobId: saved.id,
          filePath,
          originalFilename,
        },
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      );
    } catch (err) {
      this.logger.error(
        `Failed to enqueue pipeline job ${saved.id}: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined,
      );
      await this.jobRepo.update(saved.id, {
        status: 'failed',
        lastError: 'Failed to enqueue job. Redis may be unavailable. Try again.',
      } as any);
      throw new ServiceUnavailableException(
        'Pipeline job created but could not be queued for processing. Redis may be unavailable. Try again.',
      );
    }

    this.logger.log(`Created pipeline job ${saved.id} for file: ${originalFilename}`);
    return saved;
  }

  /**
   * Create a pipeline job from a single listing's form data.
   * Generates a single-row CSV and feeds it into the existing pipeline.
   */
  async createSingleJob(dto: CreateSingleListingDto, userId?: string): Promise<PipelineJob> {
    if (!dto.partName && !dto.partNumber) {
      throw new BadRequestException('At least partName or partNumber is required');
    }

    const escapeCsv = (val: unknown): string => {
      const s = val == null ? '' : String(val);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const headers = ['sku', 'brand', 'model', 'vin', 'category', 'part number', 'part name', 'note', 'price', 'quantity', 'image urls'];
    const row = [
      dto.sku ?? '',
      dto.brand ?? '',
      dto.model ?? '',
      dto.vin ?? '',
      dto.category ?? '',
      dto.partNumber ?? '',
      dto.partName ?? '',
      dto.note ?? '',
      dto.price ?? '',
      dto.quantity ?? '',
      dto.imageUrls ?? '',
    ].map(escapeCsv).join(',');

    const csv = `${headers.join(',')}\n${row}\n`;
    const csvBuffer = Buffer.from(csv, 'utf8');
    const displayName = dto.partName || dto.partNumber || dto.sku || 'Unknown Part';
    const originalFilename = `Single Listing - ${displayName}`;

    await this.heavyJobLimiter.assertPipelineSlotAvailable();
    const enabled = await this.featureFlagService.isEnabled('pipeline_enrichment');
    if (!enabled) {
      throw new ServiceUnavailableException(
        'Pipeline enrichment feature is not enabled. Enable the "pipeline_enrichment" feature flag.',
      );
    }

    const placeholder = await this.jobRepo.save(
      this.jobRepo.create({
        originalFilename,
        storedFilePath: 'pending',
        fileSizeBytes: csvBuffer.length,
        status: 'pending',
        createdBy: userId ?? null,
      }),
    );

    const storedPath = path.join(
      this.ensureJobUploadDir(placeholder.id),
      `single_${Date.now()}.csv`,
    );
    fs.writeFileSync(storedPath, csvBuffer);
    await this.jobRepo.update(placeholder.id, { storedFilePath: storedPath });

    const job = await this.enqueuePipelineJob(
      await this.jobRepo.findOneByOrFail({ id: placeholder.id }),
      storedPath,
      originalFilename,
    );

    // Store uploaded asset IDs so the processor can link them after listing creation
    if (dto.uploadedAssetIds && dto.uploadedAssetIds.length > 0) {
      await this.jobRepo.update(job.id, {
        stageDetails: {
          ...(job.stageDetails ?? {}),
          uploadedAssetIds: dto.uploadedAssetIds,
        },
      } as any);
    }

    return job;
  }

  /**
   * List pipeline jobs with optional status filter.
   */
  async listJobs(
    status?: string,
    limit = 20,
    offset = 0,
    viewerId?: string,
    viewAll = true,
  ): Promise<{ jobs: PipelineJob[]; total: number }> {
    const qb = this.jobRepo.createQueryBuilder('j').orderBy('j.createdAt', 'DESC');
    if (status) qb.andWhere('j.status = :status', { status });
    if (viewerId) {
      applyCreatedByVisibility(qb, 'j', viewerId, viewAll);
    }
    qb.take(limit).skip(offset);
    const [jobs, total] = await qb.getManyAndCount();
    return { jobs, total };
  }

  /**
   * Get a single pipeline job by ID.
   */
  async getJob(id: string, viewerId?: string, viewAll = true): Promise<PipelineJob> {
    const job = await this.jobRepo.findOneBy({ id });
    if (!job) throw new NotFoundException(`Pipeline job ${id} not found`);
    if (viewerId && !canViewJob(job.createdBy, viewerId, viewAll)) {
      throw new ForbiddenException('You do not have access to this pipeline job');
    }
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
  async cancelJob(id: string, actorId?: string, viewAll = true): Promise<PipelineJob> {
    const job = await this.getJob(id, actorId, viewAll);
    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new BadRequestException(`Job ${id} cannot be cancelled (current: ${job.status})`);
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    job.createdBy = withCreatedByBackfill(job.createdBy, actorId);
    return this.jobRepo.save(job);
  }

  /**
   * Retry a failed pipeline job.
   */
  async retryJob(id: string, actorId?: string, viewAll = true): Promise<PipelineJob> {
    const job = await this.getJob(id, actorId, viewAll);
    if (job.status !== 'failed') {
      throw new BadRequestException(`Job ${id} is not in failed state (current: ${job.status})`);
    }

    job.status = 'pending';
    job.lastError = null;
    job.errorCount = 0;
    job.startedAt = null;
    job.completedAt = null;
    job.createdBy = withCreatedByBackfill(job.createdBy, actorId);
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

    const pending = byStatus.pending ?? 0;
    const completed = byStatus.completed ?? 0;
    const failed = byStatus.failed ?? 0;
    const cancelled = byStatus.cancelled ?? 0;
    const processing = Object.entries(byStatus)
      .filter(([status]) => !['completed', 'failed', 'cancelled', 'pending'].includes(status))
      .reduce((sum, [, count]) => sum + count, 0);

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      cancelled,
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

  async getOptimizationStatus(jobId: string, marketplace?: string): Promise<JobOptimizationStatus> {
    return this.listingOptimization.getJobOptimizationStatus(jobId, marketplace);
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

  async bypassJobOptimization(jobId: string) {
    return this.listingOptimization.bypassJobOptimization(jobId);
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
