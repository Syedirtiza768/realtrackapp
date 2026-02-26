import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { ImageAsset } from '../storage/entities/image-asset.entity.js';
import { IngestionJob } from './entities/ingestion-job.entity.js';
import { AiResult } from './entities/ai-result.entity.js';
import type { CreateJobDto } from './dto/create-job.dto.js';
import type { IngestionJobData } from './processors/ingestion.processor.js';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(IngestionJob)
    private readonly jobRepo: Repository<IngestionJob>,
    @InjectRepository(AiResult)
    private readonly aiResultRepo: Repository<AiResult>,
    @InjectRepository(ImageAsset)
    private readonly assetRepo: Repository<ImageAsset>,
    @InjectQueue('ingestion')
    private readonly ingestionQueue: Queue<IngestionJobData>,
  ) {}

  /**
   * Create a new ingestion job and enqueue for AI processing.
   */
  async createJob(dto: CreateJobDto, userId?: string): Promise<IngestionJob> {
    // Validate that all asset IDs exist
    const assets = await this.assetRepo.findByIds(dto.assetIds);
    if (assets.length !== dto.assetIds.length) {
      const found = new Set(assets.map((a) => a.id));
      const missing = dto.assetIds.filter((id) => !found.has(id));
      throw new NotFoundException(
        `Image assets not found: ${missing.join(', ')}`,
      );
    }

    // Create job record
    const job = this.jobRepo.create({
      mode: dto.mode,
      sourceType: dto.source ?? 'upload',
      imageCount: dto.assetIds.length,
      createdBy: userId ?? null,
      status: 'pending',
      reviewStatus: 'pending',
    });
    const saved = await this.jobRepo.save(job);

    // Link assets to this job
    await this.assetRepo.update(
      dto.assetIds.map((id) => id),
      { jobId: saved.id },
    );

    // Enqueue for processing
    await this.ingestionQueue.add(
      'process-image',
      {
        jobId: saved.id,
        assetIds: dto.assetIds,
        mode: dto.mode,
        preferredProvider: dto.preferredProvider ?? 'openai',
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    this.logger.log(
      `Created ingestion job ${saved.id} with ${dto.assetIds.length} image(s)`,
    );
    return saved;
  }

  /**
   * List ingestion jobs with optional status filter.
   */
  async listJobs(
    status?: string,
    limit = 20,
    offset = 0,
  ): Promise<{ jobs: IngestionJob[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (status) {
      where['status'] = status;
    }

    const [jobs, total] = await this.jobRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { jobs, total };
  }

  /**
   * Get a single job with its AI result and images.
   */
  async getJob(
    id: string,
  ): Promise<{ job: IngestionJob; aiResult: AiResult | null; images: ImageAsset[] }> {
    const job = await this.jobRepo.findOneBy({ id });
    if (!job) {
      throw new NotFoundException(`Ingestion job ${id} not found`);
    }

    const aiResult = await this.aiResultRepo.findOneBy({ jobId: id });
    const images = await this.assetRepo.find({
      where: { jobId: id },
      order: { sortOrder: 'ASC' },
    });

    return { job, aiResult, images };
  }

  /**
   * Retry a failed job.
   */
  async retryJob(id: string): Promise<IngestionJob> {
    const job = await this.jobRepo.findOneBy({ id });
    if (!job) {
      throw new NotFoundException(`Ingestion job ${id} not found`);
    }
    if (job.status !== 'failed') {
      throw new Error(`Job ${id} is not in failed state (current: ${job.status})`);
    }

    // Get asset IDs linked to this job
    const assets = await this.assetRepo.find({ where: { jobId: id } });
    const assetIds = assets.map((a) => a.id);

    // Reset job status
    job.status = 'pending';
    job.attemptCount = 0;
    job.lastError = null;
    job.nextRetryAt = null;
    await this.jobRepo.save(job);

    // Re-enqueue
    await this.ingestionQueue.add(
      'process-image',
      {
        jobId: id,
        assetIds,
        mode: job.mode,
        preferredProvider: (job.aiProvider?.replace('_vision', '') as 'openai' | 'google') ?? 'openai',
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    );

    this.logger.log(`Retried ingestion job ${id}`);
    return job;
  }

  /**
   * Cancel a pending/processing job.
   */
  async cancelJob(id: string): Promise<IngestionJob> {
    const job = await this.jobRepo.findOneBy({ id });
    if (!job) {
      throw new NotFoundException(`Ingestion job ${id} not found`);
    }
    if (!['pending', 'processing', 'uploading'].includes(job.status)) {
      throw new Error(`Cannot cancel job in status: ${job.status}`);
    }

    job.status = 'cancelled';
    await this.jobRepo.save(job);

    this.logger.log(`Cancelled ingestion job ${id}`);
    return job;
  }

  /**
   * Get aggregate stats for the ingestion pipeline.
   */
  async getStats(): Promise<Record<string, number>> {
    const result = await this.jobRepo
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('job.status')
      .getRawMany<{ status: string; count: string }>();

    const stats: Record<string, number> = {};
    for (const row of result) {
      stats[row.status] = parseInt(row.count, 10);
    }
    return stats;
  }
}
