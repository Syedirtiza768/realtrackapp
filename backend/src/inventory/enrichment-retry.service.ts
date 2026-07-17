import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { INLINE_ENRICH_STAGES } from './inventory-auto-trigger.service.js';

export type EnrichmentFailureClass = 'transient' | 'permanent';

export interface EnrichmentFailureInfo {
  classification: EnrichmentFailureClass;
  reason: string;
  originalError: string;
}

/** Max number of automatic retries before marking permanent failure */
const MAX_AUTO_RETRIES = 5;

/**
 * Base delay in ms for exponential backoff: 2min.
 * Escalation: 2min → 8min → 32min → ~2hr → ~8hr
 * Formula: BASE * MULTIPLIER^retryCount
 */
const RETRY_BASE_DELAY_MS = 2 * 60 * 1000;
const RETRY_MULTIPLIER = 4;

/**
 * Markers that indicate a transient (retriable) error — rate limits,
 * timeouts, and temporary unavailability from eBay or OpenAI APIs.
 */
const TRANSIENT_MARKERS = [
  'rate limit',
  'ratelimit',
  'rate_limit',
  'rateLimitExceeded',
  'too many requests',
  '429',
  'throttl',
  'temporarily unavailable',
  'service unavailable',
  'bad gateway',
  'gateway timeout',
  'timed out',
  'timeout',
  'etimedout',
  'econnreset',
  'econnrefused',
  'socket hang up',
  'network error',
  '502',
  '503',
  '504',
  'overloaded',
  'insufficient_quota',
  'context_length_exceeded',
  'circuit open',
];

/**
 * Markers that indicate a permanent (non-retriable) error — bad data,
 * validation failures, missing prerequisites, auth issues.
 */
const PERMANENT_MARKERS = [
  'not found',
  'listing has no sku',
  'cannot enrich',
  'invalid',
  'unauthorized',
  'forbidden',
  '401',
  '403',
  'bad request',
  '400',
  'unprocessable',
  '422',
  'deleted',
  'missing required',
  'no images',
  'validation failed',
  // Image exceeds the AI vision provider's size limit — will never
  // succeed on blind retry without a resize step upstream.
  'cannot exceed',
  // Internal TypeErrors/ReferenceErrors are code bugs, not API conditions;
  // retrying them blindly just burns 5 attempts (~10hrs) before failing
  // anyway. Fail fast so they surface for a real code fix.
  'cannot read propert',
  'is not a function',
  'is not defined',
];

@Injectable()
export class EnrichmentRetryService {
  private readonly logger = new Logger(EnrichmentRetryService.name);

  constructor(
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectQueue('inventory')
    private readonly inventoryQueue: Queue,
  ) {}

  /**
   * Classify an enrichment error as transient (retriable) or permanent.
   *
   * Transient: rate limits (429), server errors (5xx), timeouts, network
   * failures, eBay/OpenAI temporary issues.
   *
   * Permanent: bad data, missing SKU, validation errors, auth failures,
   * deleted listings.
   */
  classifyError(err: unknown): EnrichmentFailureInfo {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const normalizedMessage = rawMessage.toLowerCase();

    const httpStatus = this.extractHttpStatus(err);

    // HTTP 429 is always transient (rate limit)
    if (httpStatus === 429) {
      return {
        classification: 'transient',
        reason: `rate_limited_429: ${rawMessage.slice(0, 200)}`,
        originalError: rawMessage,
      };
    }

    // HTTP 5xx is always transient (server error)
    if (httpStatus !== null && httpStatus >= 500 && httpStatus < 600) {
      return {
        classification: 'transient',
        reason: `server_error_${httpStatus}: ${rawMessage.slice(0, 200)}`,
        originalError: rawMessage,
      };
    }

    // HTTP 400/401/403/422 are permanent
    if (
      httpStatus === 400 ||
      httpStatus === 401 ||
      httpStatus === 403 ||
      httpStatus === 422
    ) {
      return {
        classification: 'permanent',
        reason: `client_error_${httpStatus}: ${rawMessage.slice(0, 200)}`,
        originalError: rawMessage,
      };
    }

    // Check transient markers
    for (const marker of TRANSIENT_MARKERS) {
      if (normalizedMessage.includes(marker)) {
        return {
          classification: 'transient',
          reason: `transient_${marker.replace(/\s+/g, '_')}: ${rawMessage.slice(0, 200)}`,
          originalError: rawMessage,
        };
      }
    }

    // Check permanent markers
    for (const marker of PERMANENT_MARKERS) {
      if (normalizedMessage.includes(marker)) {
        return {
          classification: 'permanent',
          reason: `permanent_${marker.replace(/\s+/g, '_')}: ${rawMessage.slice(0, 200)}`,
          originalError: rawMessage,
        };
      }
    }

    // If we can't classify it, treat as transient (will exhaust retries
    // and become permanent after MAX_AUTO_RETRIES).
    return {
      classification: 'transient',
      reason: `unclassified: ${rawMessage.slice(0, 200)}`,
      originalError: rawMessage,
    };
  }

  /**
   * Record a failure on a listing and determine next action.
   * Returns true if the listing should be retried, false if permanently failed.
   */
  async recordFailure(
    listingId: string,
    err: unknown,
  ): Promise<{ shouldRetry: boolean; classification: EnrichmentFailureClass }> {
    const failure = this.classifyError(err);
    const now = new Date();

    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (!listing) {
      this.logger.warn(
        `Cannot record failure — listing ${listingId} not found`,
      );
      return { shouldRetry: false, classification: failure.classification };
    }

    if (failure.classification === 'permanent') {
      await this.listingRepo.update(listingId, {
        enrichmentStage: INLINE_ENRICH_STAGES.FAILED,
        enrichmentPermanentFail: true,
        enrichmentLastFailureReason: failure.reason,
        enrichmentLastFailureAt: now,
        enrichmentNextRetryAt: null,
      });

      this.logger.warn(
        `Listing ${listingId} enrichment permanently failed (${failure.classification}): ${failure.reason}`,
      );
      return { shouldRetry: false, classification: 'permanent' };
    }

    // Transient failure — check retry count
    const newRetryCount = (listing.enrichmentRetryCount ?? 0) + 1;

    if (newRetryCount >= MAX_AUTO_RETRIES) {
      await this.listingRepo.update(listingId, {
        enrichmentStage: INLINE_ENRICH_STAGES.FAILED,
        enrichmentPermanentFail: true,
        enrichmentRetryCount: newRetryCount,
        enrichmentLastFailureReason: `exhausted_${MAX_AUTO_RETRIES}_retries: ${failure.reason}`,
        enrichmentLastFailureAt: now,
        enrichmentNextRetryAt: null,
      });

      this.logger.warn(
        `Listing ${listingId} exhausted ${MAX_AUTO_RETRIES} auto-retries — marking permanent failure. ` +
          `Last reason: ${failure.reason}`,
      );
      return { shouldRetry: false, classification: 'transient' };
    }

    // Schedule next retry with exponential backoff
    const delayMs =
      RETRY_BASE_DELAY_MS * Math.pow(RETRY_MULTIPLIER, newRetryCount - 1);
    const nextRetryAt = new Date(now.getTime() + delayMs);

    await this.listingRepo.update(listingId, {
      enrichmentStage: INLINE_ENRICH_STAGES.FAILED,
      enrichmentPermanentFail: false,
      enrichmentRetryCount: newRetryCount,
      enrichmentLastFailureReason: failure.reason,
      enrichmentLastFailureAt: now,
      enrichmentNextRetryAt: nextRetryAt,
    });

    this.logger.log(
      `Listing ${listingId} transient failure — retry ${newRetryCount}/${MAX_AUTO_RETRIES} ` +
        `scheduled at ${nextRetryAt.toISOString()} (in ${Math.round(delayMs / 1000)}s). ` +
        `Reason: ${failure.reason}`,
    );
    return { shouldRetry: true, classification: 'transient' };
  }

  /**
   * Reset retry tracking on a listing — called on successful enrichment
   * or manual force re-enrich.
   */
  async resetRetryState(listingId: string): Promise<void> {
    await this.listingRepo.update(listingId, {
      enrichmentRetryCount: 0,
      enrichmentLastFailureReason: null,
      enrichmentLastFailureAt: null,
      enrichmentNextRetryAt: null,
      enrichmentPermanentFail: false,
    });
  }

  /**
   * Scan for failed listings eligible for auto-retry and enqueue them.
   * Called by the scheduled cron job.
   */
  async enqueueDueRetries(): Promise<{
    scanned: number;
    enqueued: number;
    skipped: number;
  }> {
    const now = new Date();

    const dueListings = await this.listingRepo.find({
      where: {
        enrichmentStage: INLINE_ENRICH_STAGES.FAILED,
        enrichmentPermanentFail: false,
        enrichmentNextRetryAt: LessThanOrEqual(now),
      },
      select: ['id', 'customLabelSku', 'enrichmentRetryCount'],
    });

    if (dueListings.length === 0) {
      return { scanned: 0, enqueued: 0, skipped: 0 };
    }

    this.logger.log(
      `Enrichment retry scan: found ${dueListings.length} listing(s) due for retry`,
    );

    // Fetch the queue snapshot once per scan instead of once per listing —
    // this loop previously re-scanned the entire BullMQ queue for every
    // due listing, turning an O(1) scan into an O(n) Redis hammering.
    const pendingJobs = await this.inventoryQueue.getJobs([
      'waiting',
      'active',
      'delayed',
    ]);
    const queuedListingIds = new Set(
      pendingJobs
        .filter((job) => job.name === 'auto-enrich')
        .map((job) => (job.data as { listingId: string }).listingId),
    );

    let enqueued = 0;
    let skipped = 0;

    for (const listing of dueListings) {
      try {
        const alreadyQueued = queuedListingIds.has(listing.id);

        if (alreadyQueued) {
          skipped++;
          continue;
        }

        // Reset stage to null so the enrich job starts fresh
        await this.listingRepo.update(listing.id, {
          enrichmentStage: null,
        });

        await this.inventoryQueue.add(
          'auto-enrich',
          { listingId: listing.id, force: false, isAutoRetry: true },
          {
            attempts: 1, // No BullMQ retry — we handle retries ourselves
            removeOnComplete: 50,
            removeOnFail: 100,
          },
        );

        enqueued++;
        this.logger.log(
          `Auto-retry enqueued for listing ${listing.id} (SKU ${listing.customLabelSku ?? 'N/A'}, ` +
            `retry #${(listing.enrichmentRetryCount ?? 0) + 1})`,
        );
      } catch (err) {
        skipped++;
        this.logger.error(
          `Failed to enqueue auto-retry for listing ${listing.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return { scanned: dueListings.length, enqueued, skipped };
  }

  /**
   * Force-reset a permanently failed listing so it can be retried again.
   * Called from the controller manual override endpoint.
   */
  async overridePermanentFailure(listingId: string): Promise<boolean> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (!listing) return false;

    await this.listingRepo.update(listingId, {
      enrichmentStage: null,
      enrichmentPermanentFail: false,
      enrichmentRetryCount: 0,
      enrichmentLastFailureReason: null,
      enrichmentLastFailureAt: null,
      enrichmentNextRetryAt: null,
    });

    this.logger.log(
      `Manual override: reset permanent failure for listing ${listingId}`,
    );
    return true;
  }

  /**
   * Mark a listing as successfully enriched — clear all retry state.
   */
  async recordSuccess(listingId: string): Promise<void> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (!listing) return;

    // Only reset if there was a previous failure
    if (
      (listing.enrichmentRetryCount ?? 0) > 0 ||
      listing.enrichmentPermanentFail
    ) {
      await this.resetRetryState(listingId);
      this.logger.log(
        `Listing ${listingId} enrichment succeeded — retry state cleared ` +
          `(was retry #${listing.enrichmentRetryCount ?? 0})`,
      );
    }
  }

  /**
   * Get retry status for a listing.
   */
  async getRetryStatus(listingId: string): Promise<{
    retryCount: number;
    maxRetries: number;
    permanentFail: boolean;
    lastFailureReason: string | null;
    lastFailureAt: Date | null;
    nextRetryAt: Date | null;
    isRateLimit: boolean;
  } | null> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
      select: [
        'id',
        'enrichmentRetryCount',
        'enrichmentPermanentFail',
        'enrichmentLastFailureReason',
        'enrichmentLastFailureAt',
        'enrichmentNextRetryAt',
      ],
    });
    if (!listing) return null;

    return {
      retryCount: listing.enrichmentRetryCount ?? 0,
      maxRetries: MAX_AUTO_RETRIES,
      permanentFail: listing.enrichmentPermanentFail ?? false,
      lastFailureReason: listing.enrichmentLastFailureReason,
      lastFailureAt: listing.enrichmentLastFailureAt,
      nextRetryAt: listing.enrichmentNextRetryAt,
      isRateLimit:
        listing.enrichmentLastFailureReason?.startsWith('rate_limited') ??
        false,
    };
  }

  private extractHttpStatus(err: unknown): number | null {
    if (!err || typeof err !== 'object') return null;

    const e = err as Record<string, unknown>;
    if (typeof e.status === 'number') return e.status;
    if (typeof e.statusCode === 'number') return e.statusCode;

    const response = e.response as Record<string, unknown> | undefined;
    if (response && typeof response.status === 'number') return response.status;

    return null;
  }
}
