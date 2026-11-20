import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { CrossStoreSaleSyncService } from '../cross-store-sale-sync.service.js';
import { CROSS_STORE_SALE_SYNC_QUEUE } from '../cross-store-sale-sync.util.js';

/**
 * One job per imported eBay order (jobId cross-store-<orderId>). Concurrency 1
 * so two sales of the same SKU never read and lower the same listing at once.
 */
@Processor(CROSS_STORE_SALE_SYNC_QUEUE, { concurrency: 1 })
export class CrossStoreSaleSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(CrossStoreSaleSyncProcessor.name);

  constructor(private readonly sync: CrossStoreSaleSyncService) {
    super();
  }

  async process(job: Job<{ orderId: string }>): Promise<{ results: number }> {
    if (!(await this.sync.enabled())) return { results: 0 };
    try {
      const results = await this.sync.syncOrder(job.data.orderId);
      return { results: results.length };
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      const attempts = job.opts.attempts ?? 1;
      if (job.attemptsMade + 1 >= attempts) {
        this.logger.error(
          `Cross-store sale sync gave up on order ${job.data.orderId}: ${message}`,
        );
        await this.sync.notifyGaveUp(job.data.orderId, message);
      }
      throw err;
    }
  }
}
