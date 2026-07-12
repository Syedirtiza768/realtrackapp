import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerLeaderService } from './scheduler-leader.service.js';
import { PriceMonitorService } from '../../pricing-intelligence/price-monitor.service.js';
import { SellerpunditPolicySyncService } from '../../integrations/sellerpundit/sellerpundit-policy-sync.service.js';
import { SellerpunditTokenSyncService } from '../../integrations/sellerpundit/sellerpundit-token-sync.service.js';
import { SellerpunditAuthService } from '../../integrations/sellerpundit/sellerpundit-auth.service.js';
import { EbayPolicySyncService } from '../../integrations/ebay/services/ebay-policy-sync.service.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayCategoryKeywordAuditService } from '../../channels/ebay/ebay-category-keyword-audit.service.js';

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
    @InjectQueue('channels')
    private readonly channelsQueue: Queue,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    private readonly leader: SchedulerLeaderService,
    private readonly spPolicySync: SellerpunditPolicySyncService,
    private readonly spTokenSync: SellerpunditTokenSyncService,
    private readonly spAuth: SellerpunditAuthService,
    private readonly nativePolicySync: EbayPolicySyncService,
    private readonly categoryKeywordAudit: EbayCategoryKeywordAuditService,
    @Optional()
    private readonly priceMonitor?: PriceMonitorService,
  ) {}

  /* ─── Category keyword audit: Daily at 5:00 AM ───
   * Proactively re-verifies every hardcoded CATEGORY_KEYWORD_ROWS ID is
   * still a valid, currently-publishable leaf category on eBay's live tree.
   * Catches drift (eBay restructuring a category we depend on) before it
   * causes a publish failure — see EbayCategoryKeywordAuditService for the
   * incident that motivated this (category 33726). */
  @Cron('0 5 * * *', { name: 'category-keyword-audit-daily' })
  async scheduleCategoryKeywordAudit(): Promise<void> {
    await this.leader.runIfLeader('category-keyword-audit-daily', 3600, async () => {
      const findings = await this.categoryKeywordAudit.auditCategoryKeywords();
      if (findings.length > 0) {
        this.logger.error(
          `Category keyword audit found ${findings.length} drifted categor${findings.length === 1 ? 'y' : 'ies'} — see EbayCategoryKeywordAuditService logs above for details.`,
        );
      }
    });
  }

  /* ─── Storage Cleanup: Daily at 3:00 AM ─── */

  @Cron('0 3 * * *', { name: 'storage-cleanup-daily' })
  async scheduleStorageCleanup(): Promise<void> {
    await this.leader.runIfLeader('storage-cleanup-daily', 3600, async () => {
      const jobId = `storage-cleanup-${new Date().toISOString().slice(0, 10)}`;
      await this.storageCleanupQueue.add(
        'cleanup',
        {},
        {
          jobId,
          removeOnComplete: 10,
          removeOnFail: 10,
        },
      );
      this.logger.log(`Enqueued storage cleanup job: ${jobId}`);
    });
  }

  /* ─── Inventory: Low Stock Alert every 4 hours ─── */

  @Cron('0 */4 * * *', { name: 'inventory-low-stock-check' })
  async scheduleInventoryLowStockAlert(): Promise<void> {
    await this.leader.runIfLeader(
      'inventory-low-stock-check',
      14_000,
      async () => {
        const jobId = `low-stock-alert-${Date.now()}`;
        await this.inventoryQueue.add(
          'low-stock-alert',
          {},
          {
            jobId,
            removeOnComplete: 50,
            removeOnFail: 20,
          },
        );
        this.logger.log(`Enqueued low stock alert check: ${jobId}`);
      },
    );
  }

  /* ─── Inventory: Duplicate Scan once daily at 4:00 AM ─── */

  @Cron('0 4 * * *', { name: 'inventory-duplicate-scan' })
  async scheduleInventoryDuplicateScan(): Promise<void> {
    await this.leader.runIfLeader(
      'inventory-duplicate-scan',
      3600,
      async () => {
        const jobId = `duplicate-scan-${new Date().toISOString().slice(0, 10)}`;
        await this.inventoryQueue.add(
          'duplicate-scan',
          {},
          {
            jobId,
            removeOnComplete: 10,
            removeOnFail: 10,
          },
        );
        this.logger.log(`Enqueued inventory duplicate scan: ${jobId}`);
      },
    );
  }

  /* ─── Orders: Import from Channels every 15 minutes ─── */

  @Cron('*/15 * * * *', { name: 'order-import-from-channels' })
  async scheduleOrderImport(): Promise<void> {
    await this.leader.runIfLeader(
      'order-import-from-channels',
      840,
      async () => {
        const jobId = `order-import-${Date.now()}`;
        await this.ordersQueue.add(
          'import-from-channels',
          {},
          {
            jobId,
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        );
        this.logger.log(`Enqueued order import from channels: ${jobId}`);
      },
    );
  }

  /* ─── Orders: Auto-Complete daily at 2:00 AM ─── */

  @Cron('0 2 * * *', { name: 'order-auto-complete' })
  async scheduleOrderAutoComplete(): Promise<void> {
    await this.leader.runIfLeader('order-auto-complete', 3600, async () => {
      const jobId = `order-auto-complete-${new Date().toISOString().slice(0, 10)}`;
      await this.ordersQueue.add(
        'auto-complete',
        {},
        {
          jobId,
          removeOnComplete: 10,
          removeOnFail: 10,
        },
      );
      this.logger.log(`Enqueued order auto-complete: ${jobId}`);
    });
  }

  /* ─── Dashboard: Recompute Summary every 30 minutes ─── */

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'dashboard-recompute' })
  async scheduleDashboardRecompute(): Promise<void> {
    await this.leader.runIfLeader('dashboard-recompute', 1700, async () => {
      const jobId = `dashboard-recompute-${Date.now()}`;
      await this.dashboardQueue.add(
        'recompute-summary',
        {},
        {
          jobId,
          removeOnComplete: 50,
          removeOnFail: 20,
        },
      );
      this.logger.log(`Enqueued dashboard recompute: ${jobId}`);
    });
  }

  /* ─── Dashboard: Daily Sales Rollup at 1:00 AM ─── */

  @Cron('0 1 * * *', { name: 'dashboard-daily-rollup' })
  async scheduleDailySalesRollup(): Promise<void> {
    await this.leader.runIfLeader('dashboard-daily-rollup', 3600, async () => {
      const jobId = `daily-sales-rollup-${new Date().toISOString().slice(0, 10)}`;
      await this.dashboardQueue.add(
        'daily-sales-rollup',
        {},
        {
          jobId,
          removeOnComplete: 10,
          removeOnFail: 10,
        },
      );
      this.logger.log(`Enqueued daily sales rollup: ${jobId}`);
    });
  }

  /* ─── Channels: Listing Refresh every 48 hours ─── */

  @Cron('0 0 */2 * *', { name: 'listing-refresh-48h' })
  async scheduleListingRefresh(): Promise<void> {
    await this.leader.runIfLeader('listing-refresh-48h', 3600, async () => {
      const jobId = `listing-refresh-${new Date().toISOString().slice(0, 10)}`;
      await this.channelsQueue.add(
        'refresh-stale-offers',
        {},
        {
          jobId,
          removeOnComplete: 10,
          removeOnFail: 10,
        },
      );
      this.logger.log(`Enqueued listing refresh for stale offers: ${jobId}`);
    });
  }

  /* ─── Channels: Inventory Sync every 2 hours ─── */

  @Cron('0 */2 * * *', { name: 'channel-inventory-sync' })
  async scheduleChannelInventorySync(): Promise<void> {
    await this.leader.runIfLeader('channel-inventory-sync', 7000, async () => {
      const jobId = `channel-inventory-sync-${Date.now()}`;
      await this.channelsQueue.add(
        'sync-inventory',
        {},
        {
          jobId,
          removeOnComplete: 50,
          removeOnFail: 20,
        },
      );
      this.logger.log(`Enqueued channel inventory sync: ${jobId}`);
    });
  }

  /* ─── Pricing Intelligence: Competitor Price Collection every 4 hours ─── */

  @Cron('30 */4 * * *', { name: 'pricing-collect-competitor' })
  async scheduleCompetitorPriceCollection(): Promise<void> {
    await this.leader.runIfLeader(
      'pricing-collect-competitor',
      14_000,
      async () => {
        if (!this.priceMonitor) {
          this.logger.debug(
            'PriceMonitorService not available — skipping competitor price collection',
          );
          return;
        }

        try {
          this.logger.log('Starting scheduled competitor price collection');
          const result = await this.priceMonitor.collectAllCompetitorPrices();
          this.logger.log(
            `Competitor price collection complete: ${result.processed} products, ${result.collected} prices, ${result.errors} errors`,
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Scheduled competitor price collection failed: ${msg}`,
          );
        }
      },
    );
  }

  /* ─── SellerPundit: Policy & Token Refresh every 8 hours ─── */

  @Cron('0 */8 * * *', { name: 'sellerpundit-policy-sync' })
  async scheduleSellerpunditPolicySync(): Promise<void> {
    await this.leader.runIfLeader(
      'sellerpundit-policy-sync',
      28_000,
      async () => {
        const accounts = await this.accountRepo.find({
          where: { connectionSource: 'sellerpundit' },
        });
        if (!accounts.length) {
          this.logger.debug('No SellerPundit accounts — skipping policy sync');
          return;
        }

        this.logger.log(
          `SellerPundit auto-sync: refreshing policies for ${accounts.length} account(s)`,
        );

        let ok = 0;
        let failed = 0;

        for (const account of accounts) {
          try {
            await this.spTokenSync.ensureFreshAccessToken(account.id, {
              force: true,
            });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(
              `SellerPundit token refresh failed for account ${account.id} (${account.accountDisplayName ?? account.ebayUserId}): ${msg}`,
            );
          }

          try {
            const result = await this.spPolicySync.syncPolicies(
              account.id,
              account.organizationId,
            );
            if (result.ok) {
              ok++;
              this.logger.log(
                `SellerPundit policies synced for ${account.accountDisplayName ?? account.id}: ${result.synced} policy row(s)`,
              );
            } else {
              failed++;
              this.logger.warn(
                `SellerPundit policy sync returned not-ok for ${account.id}: ${result.message}`,
              );
            }
          } catch (e: unknown) {
            failed++;
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(
              `SellerPundit policy sync failed for account ${account.id} (${account.accountDisplayName ?? account.ebayUserId}): ${msg}`,
            );
          }
        }

        this.logger.log(
          `SellerPundit auto-sync complete: ${ok} ok, ${failed} failed`,
        );
      },
    );
  }

  /* ─── Native OAuth: Policy Refresh every 8 hours ─── */

  @Cron('0 */8 * * *', { name: 'native-oauth-policy-sync' })
  async scheduleNativeOAuthPolicySync(): Promise<void> {
    await this.leader.runIfLeader(
      'native-oauth-policy-sync',
      28_000,
      async () => {
        const accounts = await this.accountRepo.find({
          where: { connectionSource: 'native_oauth' },
        });
        if (!accounts.length) {
          this.logger.debug('No native OAuth accounts — skipping policy sync');
          return;
        }

        // Skip accounts synced within the last 4 hours
        const now = Date.now();
        const fourHoursMs = 4 * 60 * 60 * 1000;
        const eligible = accounts.filter((a) => {
          if (!a.lastSuccessfulSyncAt) return true;
          return now - new Date(a.lastSuccessfulSyncAt).getTime() > fourHoursMs;
        });

        if (!eligible.length) {
          this.logger.debug(
            'All native OAuth accounts recently synced — skipping',
          );
          return;
        }

        this.logger.log(
          `Native OAuth auto-sync: refreshing policies for ${eligible.length} account(s)`,
        );

        let ok = 0;
        let failed = 0;

        for (const account of eligible) {
          try {
            const result = await this.nativePolicySync.syncPolicies(
              account.id,
              account.organizationId,
            );
            if (result.ok) {
              ok++;
              this.logger.log(
                `Native OAuth policies synced for ${account.accountDisplayName ?? account.id}: ${result.synced} policy row(s)`,
              );
            } else {
              failed++;
              this.logger.warn(
                `Native OAuth policy sync returned not-ok for ${account.id}: ${result.message}`,
              );
            }
          } catch (e: unknown) {
            failed++;
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(
              `Native OAuth policy sync failed for account ${account.id} (${account.accountDisplayName ?? account.ebayUserId}): ${msg}`,
            );
          }
        }

        this.logger.log(
          `Native OAuth auto-sync complete: ${ok} ok, ${failed} failed`,
        );
      },
    );
  }
}
