import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../entities/ebay-listing-channel.entity.js';
import { EbayListingSyncLog } from '../entities/ebay-listing-sync-log.entity.js';
import { EbayInventoryApiService } from '../../../channels/ebay/ebay-inventory-api.service.js';
import { EbayOrderImportService } from '../../../orders/order-import-ebay.service.js';
import { EbayPolicySyncService } from './ebay-policy-sync.service.js';
import { ListingActionLogWriterService } from './listing-action-log-writer.service.js';

export interface EbayInventorySyncJobPayload {
  ebayAccountId: string;
  organizationId: string;
  userId?: string | null;
  marketplaceId?: string | null;
  syncLogId?: string;
}

export interface EbayOrderSyncJobPayload {
  ebayAccountId: string;
  organizationId: string;
  userId?: string | null;
}

@Injectable()
export class EbaySyncService {
  private readonly logger = new Logger(EbaySyncService.name);

  constructor(
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayListingChannel)
    private readonly channelRepo: Repository<EbayListingChannel>,
    @InjectRepository(EbayListingSyncLog)
    private readonly syncLogRepo: Repository<EbayListingSyncLog>,
    private readonly inventoryApi: EbayInventoryApiService,
    private readonly policySync: EbayPolicySyncService,
    private readonly orderImport: EbayOrderImportService,
    private readonly logWriter: ListingActionLogWriterService,
    @InjectQueue('ebay-inventory-sync')
    private readonly inventorySyncQueue: Queue<EbayInventorySyncJobPayload>,
    @InjectQueue('ebay-order-sync')
    private readonly orderSyncQueue: Queue<EbayOrderSyncJobPayload>,
  ) {}

  async enqueueListingSync(
    ebayAccountId: string,
    organizationId: string,
    userId?: string | null,
    marketplaceId?: string | null,
  ): Promise<{ jobId: string; syncLogId: string }> {
    const account = await this.accountRepo.findOne({
      where: { id: ebayAccountId, organizationId },
    });
    if (!account) {
      throw new NotFoundException('eBay account not found');
    }
    if (account.connectionStatus !== 'active') {
      throw new NotFoundException(
        `Account is not active (${account.connectionStatus}). Reconnect before syncing.`,
      );
    }

    const syncLog = await this.syncLogRepo.save(
      this.syncLogRepo.create({
        organizationId,
        ebayAccountId,
        marketplaceId: marketplaceId ?? null,
        syncType: 'listings',
        status: 'running',
        triggeredByUserId: userId ?? null,
      }),
    );

    const job = await this.inventorySyncQueue.add(
      'sync-listings',
      {
        ebayAccountId,
        organizationId,
        userId: userId ?? null,
        marketplaceId: marketplaceId ?? null,
        syncLogId: syncLog.id,
      },
      {
        jobId: `ebay-inv-sync-${ebayAccountId}-${Date.now()}`,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    return { jobId: job.id ?? '', syncLogId: syncLog.id };
  }

  /**
   * Pull inventory SKUs and offers from eBay, update matching `ebay_listing_channels` rows.
   */
  async syncListingsFromEbay(
    payload: EbayInventorySyncJobPayload,
    syncLogId: string,
  ): Promise<{ processed: number; updated: number; failed: number }> {
    const account = await this.accountRepo.findOne({
      where: {
        id: payload.ebayAccountId,
        organizationId: payload.organizationId,
      },
      relations: ['marketplaces'],
    });
    if (!account) {
      throw new NotFoundException('eBay account not found');
    }

    const storeId = account.primaryStoreId;
    const warnings: Record<string, unknown>[] = [];
    const errors: Record<string, unknown>[] = [];
    let processed = 0;
    let updated = 0;
    let failed = 0;

    const channels = await this.channelRepo.find({
      where: {
        ebayAccountId: account.id,
        organizationId: payload.organizationId,
      },
    });
    const channelBySku = new Map<string, EbayListingChannel[]>();
    for (const ch of channels) {
      const sku = (ch.ebayInventorySku ?? ch.internalSku ?? '').trim();
      if (!sku) continue;
      const list = channelBySku.get(sku) ?? [];
      list.push(ch);
      channelBySku.set(sku, list);
    }

    const limit = 50;
    let offset = 0;
    let totalOffers = 0;

    try {
      for (;;) {
        const page = await this.inventoryApi.getItems(storeId, limit, offset);
        const items = page.inventoryItems ?? [];
        if (!items.length) break;

        for (const item of items) {
          const sku = item.sku?.trim();
          if (!sku) continue;
          processed += 1;

          try {
            const { offers } = await this.inventoryApi.getOffersBySku(
              storeId,
              sku,
              100,
              0,
            );
            totalOffers += offers.length;

            for (const offer of offers) {
              const mp = offer.marketplaceId ?? payload.marketplaceId ?? null;
              if (payload.marketplaceId && mp && mp !== payload.marketplaceId) {
                continue;
              }

              const matches = channelBySku.get(sku) ?? [];
              const target =
                matches.find((c) => c.marketplaceId === mp) ?? matches[0];

              if (!target) {
                warnings.push({
                  sku,
                  message:
                    'Offer found on eBay but no local ebay_listing_channel row — publish from catalog to link.',
                  offerId: offer.offerId,
                });
                continue;
              }

              target.ebayInventorySku = sku;
              target.offerId = offer.offerId ?? target.offerId;
              target.listingId = offer.listingId ?? target.listingId;
              if (offer.pricingSummary?.price?.value != null) {
                target.channelPrice = String(offer.pricingSummary.price.value);
              }
              if (offer.availableQuantity != null) {
                target.channelQuantity = offer.availableQuantity;
              }
              const status = (offer.status ?? '').toUpperCase();
              if (status === 'PUBLISHED' || offer.listingId) {
                target.listingStatus = 'published';
                target.publishedAt = target.publishedAt ?? new Date();
              } else if (status === 'ENDED' || status === 'WITHDRAWN') {
                target.listingStatus = 'ended';
              }
              target.lastSyncedAt = new Date();
              await this.channelRepo.save(target);
              updated += 1;
            }
          } catch (e) {
            failed += 1;
            errors.push({
              sku,
              message: e instanceof Error ? e.message : String(e),
            });
          }
        }

        const next = page.next ?? '';
        if (!next || items.length < limit) break;
        offset += limit;
      }

      const status =
        failed > 0 && updated > 0
          ? 'partial'
          : failed > 0
            ? 'failed'
            : 'success';

      const logRow = await this.syncLogRepo.findOneByOrFail({ id: syncLogId });
      logRow.status = status;
      logRow.itemsProcessed = processed;
      logRow.itemsUpdated = updated;
      logRow.itemsFailed = failed;
      logRow.warnings = warnings;
      logRow.errors = errors;
      logRow.rawSummary = { totalOffers };
      logRow.finishedAt = new Date();
      await this.syncLogRepo.save(logRow);

      await this.accountRepo.update(account.id, {
        lastSuccessfulSyncAt: new Date(),
        lastListingsFetchedCount: totalOffers,
        lastErrorMessage:
          status === 'failed'
            ? ((errors[0] as { message?: string })?.message ?? 'Sync failed')
            : null,
      });

      await this.logWriter.write({
        organizationId: payload.organizationId,
        ebayAccountId: account.id,
        userId: payload.userId ?? null,
        action: 'listing_sync',
        result: status,
        afterSnapshot: { processed, updated, failed, totalOffers },
      });

      return { processed, updated, failed };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failRow = await this.syncLogRepo.findOneByOrFail({ id: syncLogId });
      failRow.status = 'failed';
      failRow.itemsProcessed = processed;
      failRow.itemsUpdated = updated;
      failRow.itemsFailed = failed + 1;
      failRow.errors = [...errors, { message: msg }];
      failRow.finishedAt = new Date();
      await this.syncLogRepo.save(failRow);
      await this.accountRepo.update(account.id, {
        lastErrorMessage: msg,
      });
      throw e;
    }
  }

  async enqueueOrderSync(
    ebayAccountId: string,
    organizationId: string,
    userId?: string | null,
  ): Promise<{ jobId: string }> {
    const account = await this.accountRepo.findOne({
      where: { id: ebayAccountId, organizationId },
    });
    if (!account) {
      throw new NotFoundException('eBay account not found');
    }
    if (account.connectionStatus !== 'active') {
      throw new NotFoundException(
        `Account is not active (${account.connectionStatus}). Reconnect before syncing orders.`,
      );
    }

    const job = await this.orderSyncQueue.add(
      'sync-orders',
      { ebayAccountId, organizationId, userId: userId ?? null },
      {
        jobId: `ebay-order-sync-${ebayAccountId}-${Date.now()}`,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    return { jobId: job.id ?? '' };
  }

  async importOrdersFromEbay(
    payload: EbayOrderSyncJobPayload,
  ): Promise<{ storeId: string; imported: number; errors: number }> {
    const result = await this.orderImport.importFromConnectedAccount(
      payload.ebayAccountId,
      payload.organizationId,
    );

    await this.accountRepo.update(payload.ebayAccountId, {
      lastSuccessfulSyncAt: new Date(),
      lastErrorMessage:
        result.errors > 0 ? `${result.errors} order(s) failed to import` : null,
    });

    await this.logWriter.write({
      organizationId: payload.organizationId,
      ebayAccountId: payload.ebayAccountId,
      userId: payload.userId ?? null,
      action: 'order_sync',
      result: result.errors > 0 ? 'partial' : 'success',
      afterSnapshot: result as unknown as Record<string, unknown>,
    });

    return result;
  }

  async syncPolicies(
    ebayAccountId: string,
    organizationId: string,
    userId?: string | null,
  ) {
    const result = await this.policySync.syncPolicies(
      ebayAccountId,
      organizationId,
      userId,
    );
    if (result.ok) {
      await this.accountRepo.update(ebayAccountId, {
        lastPoliciesFetchedCount: result.synced,
        lastSuccessfulSyncAt: new Date(),
      });
    }
    return result;
  }

  async listSyncLogs(
    ebayAccountId: string,
    organizationId: string,
    limit = 20,
  ): Promise<EbayListingSyncLog[]> {
    return this.syncLogRepo.find({
      where: { ebayAccountId, organizationId },
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }
}
