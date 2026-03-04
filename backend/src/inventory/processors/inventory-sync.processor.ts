import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InventoryService } from '../inventory.service.js';

@Processor('inventory', { concurrency: 1 })
export class InventorySyncProcessor extends WorkerHost {
  private readonly logger = new Logger(InventorySyncProcessor.name);

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly eventEmitter: EventEmitter2,
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

      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async handleReconcile(job: Job<{ listingIds: string[] }>): Promise<void> {
    this.logger.log(`Running reconciliation for ${job.data.listingIds.length} listings`);
    const { results } = await this.inventoryService.reconcile(job.data.listingIds);
    const corrected = results.filter((r) => r.status === 'corrected').length;
    this.logger.log(`Reconciliation complete: ${corrected} corrections applied`);
  }

  private async handleLowStockAlert(_job: Job): Promise<void> {
    const items = await this.inventoryService.getLowStock(5, 100);
    if (items.length > 0) {
      this.logger.warn(`Low stock alert: ${items.length} items below threshold`);
      for (const item of items) {
        const available = (item.quantityTotal ?? 0) - (item.quantityReserved ?? 0);
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
    this.logger.log(`Duplicate scan found ${duplicates.length} potential pairs`);
  }
}
