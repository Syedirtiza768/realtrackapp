import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { PipelineJob } from '../ingestion/entities/pipeline-job.entity.js';

export type EnrichmentStatus =
  | 'idle'
  | 'ready'
  | 'enriching'
  | 'completed'
  | 'needs_review'
  | 'failed';

/** Inline enrichment stage values written to listing_records.enrichmentStage */
export const INLINE_ENRICH_STAGES = {
  VISION_LOOKUP: 'vision_lookup',
  ENRICHMENT: 'enrichment',
  GENERATING_US: 'generating_us',
  GENERATING_AU: 'generating_au',
  GENERATING_DE: 'generating_de',
  COMPLETED: 'completed',
  NEEDS_REVIEW: 'needs_review',
  FAILED: 'failed',
} as const;

export type InlineEnrichStage =
  (typeof INLINE_ENRICH_STAGES)[keyof typeof INLINE_ENRICH_STAGES];

/** Set of stages that indicate active inline enrichment */
const INLINE_RUNNING_STAGES = new Set<string>([
  INLINE_ENRICH_STAGES.VISION_LOOKUP,
  INLINE_ENRICH_STAGES.ENRICHMENT,
  INLINE_ENRICH_STAGES.GENERATING_US,
  INLINE_ENRICH_STAGES.GENERATING_AU,
  INLINE_ENRICH_STAGES.GENERATING_DE,
]);

/** Stages where a new enrich job may be enqueued (stuck or incomplete). */
const REENRICHABLE_STAGES = new Set<string>([
  INLINE_ENRICH_STAGES.FAILED,
  INLINE_ENRICH_STAGES.NEEDS_REVIEW,
  ...INLINE_RUNNING_STAGES,
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

const RUNNING_OPTIMIZATION_STATUSES = new Set(['pending', 'running']);

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
    listing: Pick<
      ListingRecord,
      | 'itemPhotoUrl'
      | 'cOeOemPartNumber'
      | 'cManufacturerPartNumber'
      | 'cBrand'
      | 'pipelineJobId'
    > & { enrichmentStage?: string | null },
    pipelineJob?: PipelineJob | null,
  ): EnrichmentStatus {
    const stage = (listing as { enrichmentStage?: string | null })
      .enrichmentStage;
    if (stage) {
      if (INLINE_RUNNING_STAGES.has(stage)) return 'enriching';
      if (stage === INLINE_ENRICH_STAGES.COMPLETED) return 'completed';
      if (stage === INLINE_ENRICH_STAGES.NEEDS_REVIEW) return 'needs_review';
      if (stage === INLINE_ENRICH_STAGES.FAILED) return 'failed';
    }

    if (pipelineJob) {
      const optStatus = (pipelineJob as { optimizationStatus?: string })
        .optimizationStatus;
      if (optStatus) {
        if (RUNNING_OPTIMIZATION_STATUSES.has(optStatus)) return 'enriching';
        if (optStatus === 'completed') return 'completed';
        if (optStatus === 'needs_review') return 'needs_review';
        if (optStatus === 'failed') return 'failed';
      }

      if (pipelineJob.status === 'completed') return 'completed';
      if (pipelineJob.status === 'failed') return 'failed';
      if (
        pipelineJob.status &&
        RUNNING_PIPELINE_STATUSES.has(pipelineJob.status)
      ) {
        return 'enriching';
      }
      return 'enriching';
    }

    const imageCount = this.parseImageUrls(listing.itemPhotoUrl).length;
    if (imageCount >= 2) return 'ready';

    return 'idle';
  }

  async queryStatus(listingId: string): Promise<EnrichmentStatus> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (!listing || listing.deletedAt) return 'idle';

    let pipelineJob: PipelineJob | null = null;
    if (listing.pipelineJobId) {
      pipelineJob = await this.pipelineJobRepo.findOne({
        where: { id: listing.pipelineJobId },
      });
    }

    return this.deriveStatus(listing, pipelineJob);
  }

  async queryStatusWithStage(
    listingId: string,
  ): Promise<{ status: EnrichmentStatus; stage: string | null }> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (!listing || listing.deletedAt) return { status: 'idle', stage: null };

    let pipelineJob: PipelineJob | null = null;
    if (listing.pipelineJobId) {
      pipelineJob = await this.pipelineJobRepo.findOne({
        where: { id: listing.pipelineJobId },
      });
    }

    return {
      status: this.deriveStatus(listing, pipelineJob),
      stage: listing.enrichmentStage,
    };
  }

  /**
   * Enqueue a background auto-enrich job for a listing.
   * Called when the listing meets the trigger criteria (2+ images).
   * Use `force: true` to re-run stuck or needs_review enrichments.
   */
  async enqueueAutoEnrich(
    listingId: string,
    options?: { force?: boolean },
  ): Promise<{ queued: boolean; reason?: string }> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (!listing || listing.deletedAt) {
      return { queued: false, reason: 'listing_not_found' };
    }

    const imageCount = this.parseImageUrls(listing.itemPhotoUrl).length;
    if (imageCount < 2) {
      this.logger.debug(
        `Auto-enrich skipped for listing ${listingId}: images=${imageCount}`,
      );
      return { queued: false, reason: 'insufficient_images' };
    }

    const stage = listing.enrichmentStage;
    const force = options?.force === true;

    if (!force) {
      if (stage === INLINE_ENRICH_STAGES.COMPLETED) {
        return { queued: false, reason: 'already_completed' };
      }

      if (stage && INLINE_RUNNING_STAGES.has(stage)) {
        const pendingJobs = await this.inventoryQueue.getJobs([
          'waiting',
          'active',
          'delayed',
        ]);
        const alreadyQueued = pendingJobs.some(
          (job) =>
            job.name === 'auto-enrich' &&
            (job.data as { listingId: string }).listingId === listingId,
        );
        if (alreadyQueued) {
          return { queued: false, reason: 'already_running' };
        }
      }
    } else if (stage && REENRICHABLE_STAGES.has(stage)) {
      await this.listingRepo.update(listingId, {
        enrichmentStage: null,
      } as Partial<ListingRecord>);
    }

    const pendingJobs = await this.inventoryQueue.getJobs([
      'waiting',
      'active',
      'delayed',
    ]);
    const duplicate = pendingJobs.some(
      (job) =>
        job.name === 'auto-enrich' &&
        (job.data as { listingId: string }).listingId === listingId,
    );
    if (duplicate) {
      return { queued: false, reason: 'already_queued' };
    }

    await this.inventoryQueue.add(
      'auto-enrich',
      { listingId, force: force || false },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 15_000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    this.logger.log(
      `Auto-enrich job enqueued for listing ${listingId}${force ? ' (force)' : ''}`,
    );
    return { queued: true };
  }

  private parseImageUrls(raw: string | null | undefined): string[] {
    if (!raw?.trim()) return [];
    return raw
      .split('|')
      .map((u) => u.trim())
      .filter(Boolean);
  }
}
