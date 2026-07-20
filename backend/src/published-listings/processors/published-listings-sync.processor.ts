import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  PublishedListingsSyncService,
  type PublishedListingsSyncJobPayload,
} from '../services/published-listings-sync.service.js';

@Processor('published-listings-sync', {
  concurrency: 1,
  // Full SellerList sync for large stores (40k+) can run for a long time.
  // Default BullMQ lock is 30s and stalls these jobs before prune/hard-gate finish.
  lockDuration: 120 * 60 * 1000,
})
export class PublishedListingsSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishedListingsSyncProcessor.name);

  constructor(private readonly sync: PublishedListingsSyncService) {
    super();
  }

  async process(job: Job<PublishedListingsSyncJobPayload>) {
    this.logger.log(
      `Processing published listings sync job ${job.id} for account ${job.data.ebayAccountId}`,
    );
    return this.sync.syncAccount(job.data);
  }
}
