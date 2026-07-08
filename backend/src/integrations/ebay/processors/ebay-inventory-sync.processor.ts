import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  EbaySyncService,
  type EbayInventorySyncJobPayload,
} from '../services/ebay-sync.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EbayListingSyncLog } from '../entities/ebay-listing-sync-log.entity.js';

@Processor('ebay-inventory-sync')
export class EbayInventorySyncProcessor extends WorkerHost {
  private readonly logger = new Logger(EbayInventorySyncProcessor.name);

  constructor(
    private readonly sync: EbaySyncService,
    @InjectRepository(EbayListingSyncLog)
    private readonly syncLogRepo: Repository<EbayListingSyncLog>,
  ) {
    super();
  }

  async process(
    job: Job<EbayInventorySyncJobPayload & { syncLogId?: string }>,
  ) {
    const { ebayAccountId, organizationId } = job.data;
    let syncLogId = job.data.syncLogId;

    if (!syncLogId) {
      const running = await this.syncLogRepo.findOne({
        where: {
          ebayAccountId,
          organizationId,
          status: 'running',
          syncType: 'listings',
        },
        order: { startedAt: 'DESC' },
      });
      syncLogId = running?.id;
    }

    if (!syncLogId) {
      const row = await this.syncLogRepo.save(
        this.syncLogRepo.create({
          organizationId,
          ebayAccountId,
          syncType: 'listings',
          status: 'running',
          triggeredByUserId: job.data.userId ?? null,
          marketplaceId: job.data.marketplaceId ?? null,
        }),
      );
      syncLogId = row.id;
    }

    this.logger.log(
      `Starting inventory sync for account ${ebayAccountId} (job ${job.id})`,
    );

    return this.sync.syncListingsFromEbay(job.data, syncLogId);
  }
}
