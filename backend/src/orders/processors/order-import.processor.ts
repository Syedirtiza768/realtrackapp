import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdersService } from '../orders.service.js';
import { Order } from '../entities/order.entity.js';
import { EbayOrderImportService } from '../order-import-ebay.service.js';

/**
 * OrderImportProcessor — BullMQ worker for the 'orders' queue.
 *
 * Phase 4 refactored:
 *  - 'import-from-channels' now delegates to EbayOrderImportService
 *    (uses eBay Fulfillment API directly instead of legacy adapter)
 *  - 'auto-complete' marks delivered orders as completed after 14 days
 */
@Processor('orders', { concurrency: 1 })
export class OrderImportProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderImportProcessor.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly ebayImport: EbayOrderImportService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'import-from-channels':
        await this.importFromAllChannels();
        break;

      case 'auto-complete':
        await this.autoComplete();
        break;

      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  /**
   * Delegates to EbayOrderImportService for all active eBay stores.
   * When additional channels are added, extend this method with their import services.
   */
  private async importFromAllChannels(): Promise<void> {
    try {
      const results = await this.ebayImport.importFromAllStores();
      const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
      this.logger.log(
        `Order import complete: ${totalImported} new orders from ${results.length} stores, ${totalErrors} errors`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Order import failed: ${msg}`);
    }
  }

  /**
   * Auto-complete orders that have been in 'delivered' status for > 14 days.
   */
  private async autoComplete(): Promise<void> {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const delivered = await this.orderRepo.find({
      where: { status: 'delivered' },
    });

    let completed = 0;
    for (const order of delivered) {
      if (order.deliveredAt && order.deliveredAt < cutoff) {
        try {
          await this.ordersService.transitionStatus(
            order.id,
            'completed',
            'Auto-completed: 14 days since delivery',
          );
          completed++;
        } catch {
          // Skip if transition fails
        }
      }
    }

    if (completed > 0) {
      this.logger.log(`Auto-completed ${completed} orders delivered > 14 days ago`);
    }
  }
}
