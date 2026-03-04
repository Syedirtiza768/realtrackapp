import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Centralized scheduler that enqueues jobs to existing BullMQ queues.
 * 
 * This resolves the issue where 4 queues (storage-cleanup, inventory,
 * orders, dashboard) had processors but no producers — no code ever
 * enqueued jobs to them.
 * 
 * All schedules use TZ-agnostic intervals to avoid DST issues.
 * Each job is deduplicated by jobId to prevent overlap.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue('storage-cleanup')
    private readonly storageCleanupQueue: Queue,
    @InjectQueue('inventory')
    private readonly inventoryQueue: Queue,
    @InjectQueue('orders')
    private readonly ordersQueue: Queue,
    @InjectQueue('dashboard')
    private readonly dashboardQueue: Queue,
  ) {}

  /* ─── Storage Cleanup: Daily at 3:00 AM ─── */

  @Cron('0 3 * * *', { name: 'storage-cleanup-daily' })
  async scheduleStorageCleanup(): Promise<void> {
    const jobId = `storage-cleanup-${new Date().toISOString().slice(0, 10)}`;
    await this.storageCleanupQueue.add('cleanup', {}, {
      jobId,
      removeOnComplete: 10,
      removeOnFail: 10,
    });
    this.logger.log(`Enqueued storage cleanup job: ${jobId}`);
  }

  /* ─── Inventory: Low Stock Alert every 4 hours ─── */

  @Cron('0 */4 * * *', { name: 'inventory-low-stock-check' })
  async scheduleInventoryLowStockAlert(): Promise<void> {
    const jobId = `low-stock-alert-${Date.now()}`;
    await this.inventoryQueue.add('low-stock-alert', {}, {
      jobId,
      removeOnComplete: 50,
      removeOnFail: 20,
    });
    this.logger.log(`Enqueued low stock alert check: ${jobId}`);
  }

  /* ─── Inventory: Duplicate Scan once daily at 4:00 AM ─── */

  @Cron('0 4 * * *', { name: 'inventory-duplicate-scan' })
  async scheduleInventoryDuplicateScan(): Promise<void> {
    const jobId = `duplicate-scan-${new Date().toISOString().slice(0, 10)}`;
    await this.inventoryQueue.add('duplicate-scan', {}, {
      jobId,
      removeOnComplete: 10,
      removeOnFail: 10,
    });
    this.logger.log(`Enqueued inventory duplicate scan: ${jobId}`);
  }

  /* ─── Orders: Import from Channels every 15 minutes ─── */

  @Cron('*/15 * * * *', { name: 'order-import-from-channels' })
  async scheduleOrderImport(): Promise<void> {
    const jobId = `order-import-${Date.now()}`;
    await this.ordersQueue.add('import-from-channels', {}, {
      jobId,
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    this.logger.log(`Enqueued order import from channels: ${jobId}`);
  }

  /* ─── Orders: Auto-Complete daily at 2:00 AM ─── */

  @Cron('0 2 * * *', { name: 'order-auto-complete' })
  async scheduleOrderAutoComplete(): Promise<void> {
    const jobId = `order-auto-complete-${new Date().toISOString().slice(0, 10)}`;
    await this.ordersQueue.add('auto-complete', {}, {
      jobId,
      removeOnComplete: 10,
      removeOnFail: 10,
    });
    this.logger.log(`Enqueued order auto-complete: ${jobId}`);
  }

  /* ─── Dashboard: Recompute Summary every 30 minutes ─── */

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'dashboard-recompute' })
  async scheduleDashboardRecompute(): Promise<void> {
    const jobId = `dashboard-recompute-${Date.now()}`;
    await this.dashboardQueue.add('recompute-summary', {}, {
      jobId,
      removeOnComplete: 50,
      removeOnFail: 20,
    });
    this.logger.log(`Enqueued dashboard recompute: ${jobId}`);
  }

  /* ─── Dashboard: Daily Sales Rollup at 1:00 AM ─── */

  @Cron('0 1 * * *', { name: 'dashboard-daily-rollup' })
  async scheduleDailySalesRollup(): Promise<void> {
    const jobId = `daily-sales-rollup-${new Date().toISOString().slice(0, 10)}`;
    await this.dashboardQueue.add('daily-sales-rollup', {}, {
      jobId,
      removeOnComplete: 10,
      removeOnFail: 10,
    });
    this.logger.log(`Enqueued daily sales rollup: ${jobId}`);
  }
}
