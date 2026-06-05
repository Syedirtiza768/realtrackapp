import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  EbaySyncService,
  type EbayOrderSyncJobPayload,
} from '../services/ebay-sync.service.js';

@Processor('ebay-order-sync')
export class EbayOrderSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(EbayOrderSyncProcessor.name);

  constructor(private readonly sync: EbaySyncService) {
    super();
  }

  async process(job: Job<EbayOrderSyncJobPayload>) {
    this.logger.log(
      `Order sync for account ${job.data.ebayAccountId} (job ${job.id})`,
    );
    return this.sync.importOrdersFromEbay(job.data);
  }
}
