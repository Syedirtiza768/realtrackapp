import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  ChannelStockSyncService,
  STOCK_CHANNEL_SYNC_QUEUE,
} from './channel-stock-sync.service.js';

/** Single-concurrency worker: channel pushes for the same store are never interleaved. */
@Processor(STOCK_CHANNEL_SYNC_QUEUE, { concurrency: 1 })
export class ChannelStockSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelStockSyncProcessor.name);

  constructor(private readonly sync: ChannelStockSyncService) {
    super();
  }

  async process(job: Job<{ organizationId?: string }>): Promise<unknown> {
    switch (job.name) {
      case 'sweep': {
        let total = 0;
        // Drain in batches so a large backlog does not wait for the next cron tick.
        for (let i = 0; i < 20; i++) {
          const r = await this.sync.sweep(job.data.organizationId);
          total += r.processed;
          if (r.processed === 0) break;
        }
        return { processed: total };
      }
      case 'drift':
        return this.sync.driftCheck(job.data.organizationId);
      default:
        this.logger.warn(`Unknown job ${job.name}`);
        return null;
    }
  }
}
