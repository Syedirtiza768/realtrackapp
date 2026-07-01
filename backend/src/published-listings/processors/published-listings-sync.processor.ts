import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  PublishedListingsSyncService,
  type PublishedListingsSyncJobPayload,
} from '../services/published-listings-sync.service.js';

@Processor('published-listings-sync')
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
