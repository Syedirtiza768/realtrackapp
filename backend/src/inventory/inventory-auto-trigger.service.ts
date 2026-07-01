import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { Repository, In } from 'typeorm';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { PipelineJob } from '../ingestion/entities/pipeline-job.entity.js';

export type EnrichmentStatus =
  | 'idle'
  | 'ready'
  | 'enriching'
  | 'completed'
  | 'failed';

/** Inline enrichment stage values written to listing_records.enrichmentStage */
export const INLINE_ENRICH_STAGES = {
  VISION_LOOKUP: 'vision_lookup',
  ENRICHMENT: 'enrichment',
  GENERATING_US: 'generating_us',
  GENERATING_AU: 'generating_au',
  GENERATING_DE: 'generating_de',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type InlineEnrichStage = (typeof INLINE_ENRICH_STAGES)[keyof typeof INLINE_ENRICH_STAGES];

/** Maps inline enrichment stages to the public EnrichmentStatus */
function stageToStatus(stage: string | null | undefined): EnrichmentStatus {
  if (!stage) return 'idle';
  if (stage === INLINE_ENRICH_STAGES.COMPLETED) return 'completed';
  if (stage === INLINE_ENRICH_STAGES.FAILED) return 'failed';
  return 'enriching';
}

/** Set of stages that indicate active inline enrichment */
const INLINE_RUNNING_STAGES = new Set<string>([
  INLINE_ENRICH_STAGES.VISION_LOOKUP,
  INLINE_ENRICH_STAGES.ENRICHMENT,
  INLINE_ENRICH_STAGES.GENERATING_US,
  INLINE_ENRICH_STAGES.GENERATING_AU,
  INLINE_ENRICH_STAGES.GENERATING_DE,
]);

const RUNNING_PIPELINE_STATUSES = new Set([
  'pending',
  'uploading',
  'vin_decode',
  'category_mapping',
  'enrichment',
  'validation',
  'output_generation',
]);

const RUNNING_OPTIMIZATION_STATUSES = new Set([
  'pending',
  'running',
]);

/**
 * Computes enrichment state + enqueues background auto-enrich jobs
 * when a listing reaches 2+ images (vision lookup runs inside the job).
 */
@Injectable()
export class InventoryAutoTriggerService {
  private readonly logger = new Logger(InventoryAutoTriggerService.name);

  constructor(
    @InjectQueue('inventory')
    private readonly inventoryQueue: Queue,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(PipelineJob)
    private readonly pipelineJobRepo: Repository<PipelineJob>,
  ) {}

  /**
   * Derive enrichment status from a listing and its pipeline job (if loaded).
   * Checks inline enrichmentStage first, then pipeline job status.
   */
  deriveStatus(
    listing: Pick<ListingRecord, 'itemPhotoUrl' | 'cOeOemPartNumber' | 'cManufacturerPartNumber' | 'cBrand' | 'pipelineJobId'> & { enrichmentStage?: string | null },
    pipelineJob?: PipelineJob | null,
  ): EnrichmentStatus {
    // 1. Check inline enrichment stage (takes priority — live progress tracking)
    const stage = (listing as any).enrichmentStage as string | null | undefined;
    if (stage) {
      if (INLINE_RUNNING_STAGES.has(stage)) return 'enriching';
      if (stage === INLINE_ENRICH_STAGES.COMPLETED) return 'completed';
      if (stage === INLINE_ENRICH_STAGES.FAILED) return 'failed';
    }

    // 2. Check pipeline job if present
    if (pipelineJob) {
      const optStatus = (pipelineJob as any).optimizationStatus as string | undefined;
      if (optStatus) {
        if (RUNNING_OPTIMIZATION_STATUSES.has(optStatus)) return 'enriching';
        if (optStatus === 'completed') return 'completed';
        if (optStatus === 'failed') return 'failed';
      }

      if (pipelineJob.status === 'completed') return 'completed';
      if (pipelineJob.status === 'failed') return 'failed';
      if (pipelineJob.status && RUNNING_PIPELINE_STATUSES.has(pipelineJob.status)) return 'enriching';
      return 'enriching';
    }

    // 3. No enrichment data — check if ready to trigger
    const imageCount = this.parseImageUrls(listing.itemPhotoUrl).length;
    if (imageCount >= 2) return 'ready';

    return 'idle';
  }

  /**
   * Query enrichment status from DB (use when you don't have the pipeline job loaded).
   */
  async queryStatus(listingId: string): Promise<EnrichmentStatus> {
    const listing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (!listing || listing.deletedAt) return 'idle';

    let pipelineJob: PipelineJob | null = null;
    if (listing.pipelineJobId) {
      pipelineJob = await this.pipelineJobRepo.findOne({ where: { id: listing.pipelineJobId } });
    }

    return this.deriveStatus(listing, pipelineJob);
  }

  /**
   * Query enrichment status + stage from DB.
   * Returns the public status and the detailed inline stage (if any).
   */
  async queryStatusWithStage(listingId: string): Promise<{ status: EnrichmentStatus; stage: string | null }> {
    const listing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (!listing || listing.deletedAt) return { status: 'idle', stage: null };

    let pipelineJob: PipelineJob | null = null;
    if (listing.pipelineJobId) {
      pipelineJob = await this.pipelineJobRepo.findOne({ where: { id: listing.pipelineJobId } });
    }

    return {
      status: this.deriveStatus(listing, pipelineJob),
      stage: listing.enrichmentStage,
    };
  }

  /**
   * Enqueue a background auto-enrich job for a listing.
   * Called when the listing meets the trigger criteria (2+ images, part number, brand).
   */
  async enqueueAutoEnrich(listingId: string): Promise<void> {
    // Check if enrichment is already in progress or completed
    const listing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (!listing || listing.deletedAt) return;

    const imageCount = this.parseImageUrls(listing.itemPhotoUrl).length;
    if (imageCount < 2) {
      this.logger.debug(`Auto-enrich skipped for listing ${listingId}: images=${imageCount}`);
      return;
    }

    // Don't re-enqueue if already has a pipeline job
    if (listing.pipelineJobId) {
      this.logger.debug(`Auto-enrich skipped for listing ${listingId}: pipeline job already exists`);
      return;
    }

    // Check if there's already a pending/active auto-enrich job for this listing
    const pendingJobs = await this.inventoryQueue.getJobs(['waiting', 'active', 'delayed']);
    const alreadyQueued = pendingJobs.some(
      (job) => job.name === 'auto-enrich' && (job.data as { listingId: string }).listingId === listingId,
    );
    if (alreadyQueued) {
      this.logger.debug(`Auto-enrich already queued for listing ${listingId}`);
      return;
    }

    await this.inventoryQueue.add(
      'auto-enrich',
      { listingId },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    this.logger.log(`Auto-enrich job enqueued for listing ${listingId}`);
  }

  private parseImageUrls(raw: string | null | undefined): string[] {
    if (!raw?.trim()) return [];
    return raw
      .split('|')
      .map((u) => u.trim())
      .filter(Boolean);
  }
}
