import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InventoryService } from '../inventory.service.js';
import { InventoryWorkbenchService } from '../inventory-workbench.service.js';
import { EnrichmentRetryService } from '../enrichment-retry.service.js';

// Concurrency 2: warehouse-intake catch-up re-enrich of hundreds of listings
// is otherwise multi-hour at 1. Browse/OpenAI rate limits are still the
// practical ceiling — raise further only after watching 429s.
@Processor('inventory', { concurrency: 2 })
export class InventorySyncProcessor extends WorkerHost {
  private readonly logger = new Logger(InventorySyncProcessor.name);

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly eventEmitter: EventEmitter2,
    private readonly workbench: InventoryWorkbenchService,
    private readonly retryService: EnrichmentRetryService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'reconcile':
        await this.handleReconcile(job);
        break;

      case 'low-stock-alert':
        await this.handleLowStockAlert(job);
        break;

      case 'duplicate-scan':
        await this.handleDuplicateScan(job);
        break;

      case 'auto-enrich':
        await this.handleAutoEnrich(job);
        break;

      case 'enrichment-retry-scan':
        await this.handleEnrichmentRetryScan(job);
        break;

      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async handleReconcile(
    job: Job<{ listingIds: string[] }>,
  ): Promise<void> {
    this.logger.log(
      `Running reconciliation for ${job.data.listingIds.length} listings`,
    );
    const { results } = await this.inventoryService.reconcile(
      job.data.listingIds,
    );
    const corrected = results.filter((r) => r.status === 'corrected').length;
    this.logger.log(
      `Reconciliation complete: ${corrected} corrections applied`,
    );
  }

  private async handleLowStockAlert(_job: Job): Promise<void> {
    const items = await this.inventoryService.getLowStock(5, 100);
    if (items.length > 0) {
      this.logger.warn(
        `Low stock alert: ${items.length} items below threshold`,
      );
      for (const item of items) {
        const available =
          (item.quantityTotal ?? 0) - (item.quantityReserved ?? 0);
        if (available <= 0) {
          this.eventEmitter.emit('inventory.out_of_stock', {
            listingId: item.listingId,
            title: item.listing?.title ?? undefined,
          });
        } else {
          this.eventEmitter.emit('inventory.low_stock', {
            listingId: item.listingId,
            title: item.listing?.title ?? undefined,
            available,
            threshold: item.lowStockThreshold ?? 2,
          });
        }
      }
    }
  }

  private async handleDuplicateScan(_job: Job): Promise<void> {
    const duplicates = await this.inventoryService.findDuplicates(0.7);
    this.logger.log(
      `Duplicate scan found ${duplicates.length} potential pairs`,
    );
  }

  /**
   * Auto-enrich a single listing: vision lookup → AI marketplace content (US/AU/DE) inline.
   * No pipeline job — all done synchronously right in the modal.
   *
   * On failure, classifies the error and records retry state. For transient
   * errors (rate limits, timeouts), schedules automatic retry with exponential
   * backoff. For permanent errors (bad data, missing SKU), marks the listing
   * as permanently failed to stop further retry attempts.
   */
  private async handleAutoEnrich(
    job: Job<{ listingId: string; force?: boolean; isAutoRetry?: boolean }>,
  ): Promise<void> {
    const { listingId, isAutoRetry } = job.data;
    const retryLabel = isAutoRetry ? 'auto-retry' : 'auto-enrich';
    this.logger.log(
      `${retryLabel}: starting inline enrichment for listing ${listingId}`,
    );

    try {
      await this.workbench.inlineEnrichListing(listingId);
      await this.retryService.recordSuccess(listingId);
      this.logger.log(
        `${retryLabel}: inline enrichment completed for listing ${listingId}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `${retryLabel} failed for listing ${listingId}: ${message}`,
      );

      const { shouldRetry, classification } =
        await this.retryService.recordFailure(listingId, err);

      if (shouldRetry) {
        this.logger.log(
          `${retryLabel}: listing ${listingId} classified as transient — ` +
            `auto-retry scheduled (will be picked up by retry scanner)`,
        );
      } else {
        this.logger.warn(
          `${retryLabel}: listing ${listingId} classified as ${classification} — ` +
            `no further auto-retries`,
        );
      }

      // Re-throw so BullMQ marks the job as failed (for observability),
      // but retry logic is handled by our own scheduler, not BullMQ attempts.
      throw err;
    }
  }

  /**
   * Scan for failed enrichments eligible for auto-retry.
   * Triggered by the scheduled cron every 5 minutes.
   */
  private async handleEnrichmentRetryScan(_job: Job): Promise<void> {
    const result = await this.retryService.enqueueDueRetries();
    if (result.scanned > 0) {
      this.logger.log(
        `Enrichment retry scan: ${result.scanned} due, ${result.enqueued} enqueued, ${result.skipped} skipped`,
      );
    }
  }
}
