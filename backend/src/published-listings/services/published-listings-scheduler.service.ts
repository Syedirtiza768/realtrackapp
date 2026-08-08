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

  /** Sync published listings from all active eBay accounts (default every 15 minutes). */
  @Cron(
    process.env.PUBLISHED_LISTINGS_SYNC_CRON ?? '*/15 * * * *',
    { name: 'published-listings-sync' },
  )
  async schedulePublishedListingsSync(): Promise<void> {
    if (
      process.env.PUBLISHED_LISTINGS_SYNC_DISABLED === '1' ||
      process.env.PUBLISHED_LISTINGS_SYNC_DISABLED === 'true'
    ) {
      this.logger.debug('Published listings sync cron disabled via env');
      return;
    }
    await this.leader.runIfLeader(
      'published-listings-sync',
      12 * 60_000,
      async () => {
        const scopedIds = (process.env.PUBLISHED_LISTINGS_SYNC_ACCOUNT_IDS || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        let accounts: ConnectedEbayAccount[];
        if (scopedIds.length > 0) {
          // Preserve configured order so priority accounts (e.g. Blackline) sync first.
          const found = await this.accountRepo.find({
            where: scopedIds.map((id) => ({ id, connectionStatus: 'active' })),
          });
          const byId = new Map(found.map((a) => [a.id, a]));
          accounts = scopedIds
            .map((id) => byId.get(id))
            .filter(
              (a): a is ConnectedEbayAccount => Boolean(a),
            );
        } else {
          accounts = await this.accountRepo.find({
            where: { connectionStatus: 'active' },
          });
        }

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
      },
    );
  }
}
