import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerLeaderService } from '../../common/scheduler/scheduler-leader.service.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { PublishedListingsSyncService } from './published-listings-sync.service.js';

@Injectable()
export class PublishedListingsSchedulerService {
  private readonly logger = new Logger(PublishedListingsSchedulerService.name);

  constructor(
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    private readonly sync: PublishedListingsSyncService,
    private readonly leader: SchedulerLeaderService,
  ) {}

  /** Sync published listings from all active eBay accounts every 6 hours. */
  @Cron('0 */6 * * *', { name: 'published-listings-sync' })
  async schedulePublishedListingsSync(): Promise<void> {
    await this.leader.runIfLeader('published-listings-sync', 21_000, async () => {
      const accounts = await this.accountRepo.find({
        where: { connectionStatus: 'active' },
      });
      for (const account of accounts) {
        try {
          await this.sync.enqueueSync({
            organizationId: account.organizationId,
            ebayAccountId: account.id,
            trigger: 'scheduled',
          });
        } catch (e) {
          this.logger.warn(
            `Failed to enqueue published listings sync for ${account.id}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }
      this.logger.log(
        `Enqueued published listings sync for ${accounts.length} eBay account(s)`,
      );
    });
  }
}
