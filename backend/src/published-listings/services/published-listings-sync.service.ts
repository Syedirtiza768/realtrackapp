import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository, In, Brackets } from 'typeorm';
import type { Queue } from 'bullmq';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
import { resolveMarketplaceId } from '../../channels/ebay/ebay-marketplace-headers.util.js';
import { EbayInventoryApiService } from '../../channels/ebay/ebay-inventory-api.service.js';
import { EbayTradingApiService } from '../../channels/ebay/ebay-trading-api.service.js';
import type { TradingSellerListItem } from '../../channels/ebay/ebay-trading-api.service.js';
import type {
  EbayInventoryItem,
  EbayOffer,
} from '../../channels/ebay/ebay-api.types.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import { EbayPublishedListingSyncLog } from '../entities/ebay-published-listing-sync-log.entity.js';
import { preferRicherImageUrls } from '../../channels/ebay/ebay-listing-images.util.js';
import { PublishedListingsHealthService } from './published-listings-health.service.js';
import { PublishedListingsEnrichmentService } from './published-listings-enrichment.service.js';

export interface PublishedListingsSyncJobPayload {
  organizationId: string;
  ebayAccountId: string;
  userId?: string | null;
  marketplaceId?: string | null;
  syncLogId: string;
  listingIds?: string[];
  trigger?: 'manual' | 'scheduled' | 'single';
}

@Injectable()
export class PublishedListingsSyncService {
  private readonly logger = new Logger(PublishedListingsSyncService.name);

  constructor(
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayPublishedListing)
    private readonly listingRepo: Repository<EbayPublishedListing>,
    @InjectRepository(EbayPublishedListingSyncLog)
    private readonly syncLogRepo: Repository<EbayPublishedListingSyncLog>,
    @InjectRepository(EbayListingChannel)
    private readonly channelRepo: Repository<EbayListingChannel>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly inventoryApi: EbayInventoryApiService,
    private readonly tradingApi: EbayTradingApiService,
    private readonly health: PublishedListingsHealthService,
    private readonly enrichment: PublishedListingsEnrichmentService,
    @InjectQueue('published-listings-sync')
    private readonly syncQueue: Queue<PublishedListingsSyncJobPayload>,
  ) {}

  async enqueueSync(input: {
    organizationId: string;
    ebayAccountId?: string;
    marketplaceId?: string | null;
    userId?: string | null;
    listingIds?: string[];
    trigger?: 'manual' | 'scheduled' | 'single';
  }): Promise<{ jobIds: string[]; syncLogIds: string[] }> {
    const accounts = await this.resolveAccounts(
      input.organizationId,
      input.ebayAccountId,
    );

    const jobIds: string[] = [];
    const syncLogIds: string[] = [];

    for (const account of accounts) {
      if (account.connectionStatus !== 'active') {
        throw new BadRequestException(
          `Account "${account.accountDisplayName}" is not active (${account.connectionStatus})`,
        );
      }

      const syncLog = await this.syncLogRepo.save(
        this.syncLogRepo.create({
          organizationId: input.organizationId,
          ebayAccountId: account.id,
          marketplaceId: input.marketplaceId ?? null,
          trigger: input.listingIds?.length
            ? 'single'
            : (input.trigger ?? 'manual'),
          status: 'pending',
          triggeredByUserId: input.userId ?? null,
        }),
      );

      const job = await this.syncQueue.add(
        'sync-account',
        {
          organizationId: input.organizationId,
          ebayAccountId: account.id,
          userId: input.userId ?? null,
          marketplaceId: input.marketplaceId ?? null,
          syncLogId: syncLog.id,
          listingIds: input.listingIds,
          trigger: input.listingIds?.length ? 'single' : 'manual',
        },
        {
          jobId: `pub-listings-sync-${account.id}-${Date.now()}`,
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );

      jobIds.push(job.id ?? '');
      syncLogIds.push(syncLog.id);
    }

    return { jobIds, syncLogIds };
  }

  async syncListingById(
    listingId: string,
    organizationId: string,
  ): Promise<EbayPublishedListing> {
    const local = await this.listingRepo.findOne({
      where: { id: listingId, organizationId },
    });
    if (!local) throw new NotFoundException('Published listing not found');

    const account = await this.accountRepo.findOne({
      where: { id: local.ebayAccountId, organizationId },
    });
    if (!account) throw new NotFoundException('eBay account not found');

    const channelLinks = await this.channelRepo.find({
      where: { organizationId, ebayAccountId: account.id },
    });
    const channelByOffer = new Map<string, EbayListingChannel>();
    const channelByListing = new Map<string, EbayListingChannel>();
    for (const ch of channelLinks) {
      if (ch.offerId) channelByOffer.set(ch.offerId, ch);
      if (ch.listingId) channelByListing.set(ch.listingId, ch);
    }

    await this.syncSingleListing(
      account,
      local,
      channelByOffer,
      channelByListing,
    );

    return this.listingRepo.findOneByOrFail({ id: listingId });
  }

  async syncAccount(payload: PublishedListingsSyncJobPayload): Promise<{
    processed: number;
    created: number;
    updated: number;
    failed: number;
  }> {
    const syncLog = payload.syncLogId
      ? await this.syncLogRepo.findOneBy({ id: payload.syncLogId })
      : null;
    if (syncLog) {
      syncLog.status = 'running';
      await this.syncLogRepo.save(syncLog);
    }

    const account = await this.accountRepo.findOne({
      where: {
        id: payload.ebayAccountId,
        organizationId: payload.organizationId,
      },
    });
    if (!account) {
      throw new NotFoundException('eBay account not found');
    }

    const storeId = account.primaryStoreId;
    const store = await this.storeRepo.findOneBy({ id: storeId });
    const accountMarketplaceId =
      payload.marketplaceId ??
      (store ? resolveMarketplaceId(store) : 'EBAY_US');
    const errors: Record<string, unknown>[] = [];
    const warnings: Record<string, unknown>[] = [];
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    /** Only advance lastSuccessfulSyncAt after a trustworthy *full* live Trading fetch. */
    let advanceSyncWatermark = false;

    const channelLinks = await this.channelRepo.find({
      where: {
        organizationId: payload.organizationId,
        ebayAccountId: account.id,
      },
    });
    const channelByOffer = new Map<string, EbayListingChannel>();
    const channelByListing = new Map<string, EbayListingChannel>();
    for (const ch of channelLinks) {
      if (ch.offerId) channelByOffer.set(ch.offerId, ch);
      if (ch.listingId) channelByListing.set(ch.listingId, ch);
    }

    const seenKeys = new Set<string>();

    try {
      if (payload.listingIds?.length) {
        for (const listingId of payload.listingIds) {
          const local = await this.listingRepo.findOne({
            where: {
              id: listingId,
              organizationId: payload.organizationId,
              ebayAccountId: account.id,
            },
          });
          if (!local) {
            failed += 1;
            errors.push({ listingId, message: 'Listing not found' });
            continue;
          }
          try {
            const result = await this.syncSingleListing(
              account,
              local,
              channelByOffer,
              channelByListing,
            );
            processed += 1;
            if (result.created) created += 1;
            else updated += 1;
            if (local.ebayItemId) {
              seenKeys.add(`${local.marketplaceId}:${local.ebayItemId}`);
            }
          } catch (e) {
            failed += 1;
            errors.push({
              listingId,
              message: e instanceof Error ? e.message : String(e),
            });
          }
        }
        // Targeted listingIds syncs must NOT advance lastSuccessfulSyncAt —
        // the API hard-gate treats that watermark as "full live set freshness".
        // Advancing it here hides every active row that was not in listingIds.
        advanceSyncWatermark = false;
      } else {
        const tradingResult = await this.syncFromTradingApi(
          account,
          storeId,
          accountMarketplaceId,
          seenKeys,
          channelByListing,
        );
        processed += tradingResult.processed;
        created += tradingResult.created;
        updated += tradingResult.updated;
        failed += tradingResult.failed;
        warnings.push(...tradingResult.warnings);
        advanceSyncWatermark = tradingResult.liveFetchOk;

        // Never prune (or advance the live watermark) when Trading failed —
        // rate-limit / auth errors return 0 items and would wipe every active row.
        if (tradingResult.liveFetchOk) {
          const endedCount = await this.markUnseenActiveAsEnded(
            account.id,
            accountMarketplaceId,
            seenKeys,
          );
          if (endedCount > 0) {
            this.logger.log(
              `Marked ${endedCount} previously-active listing(s) as ended for ${account.accountDisplayName}`,
            );
          }

          const liveCount = seenKeys.size;
          const remainingActive = await this.listingRepo.count({
            where: {
              ebayAccountId: account.id,
              marketplaceId: accountMarketplaceId,
              listingStatus: 'active',
            },
          });
          if (remainingActive > liveCount) {
            const extra = await this.markUnseenActiveAsEnded(
              account.id,
              accountMarketplaceId,
              seenKeys,
            );
            this.logger.warn(
              `Hard-gate prune for ${account.accountDisplayName}: DB had ${remainingActive} active vs ${liveCount} live; ended ${extra} more`,
            );
          }
        } else {
          failed += 1;
          errors.push({
            source: 'trading_api',
            message:
              'Live Trading fetch failed — skipped ActiveList prune and sync watermark update',
          });
          this.logger.warn(
            `Skipping ActiveList prune for ${account.accountDisplayName}: Trading live fetch failed`,
          );
        }

        // Optional Inventory API pass — disabled by default on full sync because it
        // issues one offer lookup per SKU and stalls large stores (6000+ listings).
        if (process.env.PUBLISHED_LISTINGS_INVENTORY_ENRICH === '1') {
          const limit = 50;
          let offset = 0;

          for (;;) {
            const page = await this.inventoryApi.getItems(
              storeId,
              limit,
              offset,
            );
            const items = page.inventoryItems ?? [];
            if (!items.length) break;

            for (const item of items) {
              const sku = item.sku?.trim();
              if (!sku) continue;

              let offerOffset = 0;
              for (;;) {
                const { offers, total } =
                  await this.inventoryApi.getOffersBySku(
                    storeId,
                    sku,
                    100,
                    offerOffset,
                  );
                if (!offers.length) break;

                for (const offer of offers) {
                  if (!this.isPublishedOffer(offer)) continue;
                  if (
                    accountMarketplaceId &&
                    offer.marketplaceId !== accountMarketplaceId
                  ) {
                    continue;
                  }

                  processed += 1;
                  try {
                    const result = await this.upsertFromOffer(
                      account,
                      offer,
                      item,
                      channelByOffer,
                      channelByListing,
                    );
                    if (result.created) created += 1;
                    else updated += 1;
                    if (offer.listingId) {
                      seenKeys.add(`${offer.marketplaceId}:${offer.listingId}`);
                    }
                  } catch (e) {
                    failed += 1;
                    errors.push({
                      sku,
                      offerId: offer.offerId,
                      message: e instanceof Error ? e.message : String(e),
                    });
                  }
                }

                offerOffset += offers.length;
                if (offerOffset >= total) break;
              }
            }

            if (!page.next || items.length < limit) break;
            offset += limit;
          }
        }
      }

      if (advanceSyncWatermark) {
        await this.accountRepo.update(account.id, {
          lastSuccessfulSyncAt: new Date(),
          lastListingsFetchedCount: payload.listingIds?.length
            ? processed
            : Math.max(processed, seenKeys.size),
        });
      } else {
        this.logger.warn(
          `Not advancing sync watermark for ${account.accountDisplayName}: no trustworthy live Trading set`,
        );
      }

      if (syncLog) {
        syncLog.status =
          !advanceSyncWatermark && !payload.listingIds?.length
            ? 'failed'
            : failed > 0 && processed === 0
              ? 'failed'
              : 'completed';
        syncLog.completedAt = new Date();
        syncLog.itemsProcessed = processed;
        syncLog.itemsCreated = created;
        syncLog.itemsUpdated = updated;
        syncLog.itemsFailed = failed;
        syncLog.errors = errors;
        syncLog.warnings = warnings;
        await this.syncLogRepo.save(syncLog);
      }

      return { processed, created, updated, failed };
    } catch (e) {
      if (syncLog) {
        syncLog.status = 'failed';
        syncLog.completedAt = new Date();
        syncLog.errors = [
          ...errors,
          { message: e instanceof Error ? e.message : String(e) },
        ];
        await this.syncLogRepo.save(syncLog);
      }
      throw e;
    }
  }

  private async syncSingleListing(
    account: ConnectedEbayAccount,
    local: EbayPublishedListing,
    channelByOffer: Map<string, EbayListingChannel>,
    channelByListing: Map<string, EbayListingChannel>,
  ): Promise<{ created: boolean }> {
    const storeId = account.primaryStoreId;
    if (!local.sku) {
      throw new BadRequestException('Listing has no SKU');
    }

    const item = await this.inventoryApi.getItem(storeId, local.sku);
    let offer: EbayOffer | null = null;

    if (local.offerId) {
      offer = await this.inventoryApi.getOffer(storeId, local.offerId);
    } else {
      const { offers } = await this.inventoryApi.getOffersBySku(
        storeId,
        local.sku,
        100,
        0,
      );
      offer =
        offers.find((o) => o.listingId === local.ebayItemId) ??
        offers.find((o) => this.isPublishedOffer(o)) ??
        offers[0] ??
        null;
    }

    if (!offer) {
      throw new NotFoundException('No eBay offer found for listing');
    }

    return this.upsertFromOffer(
      account,
      offer,
      item,
      channelByOffer,
      channelByListing,
      local,
    );
  }

  private async upsertFromOffer(
    account: ConnectedEbayAccount,
    offer: EbayOffer,
    item: EbayInventoryItem,
    channelByOffer: Map<string, EbayListingChannel>,
    channelByListing: Map<string, EbayListingChannel>,
    existing?: EbayPublishedListing | null,
  ): Promise<{ created: boolean }> {
    const sku = offer.sku ?? item.sku ?? null;
    const extracted = this.health.extractFromInventoryItem(item);

    let compatibility: Record<string, unknown> | null = null;
    if (sku && account.primaryStoreId) {
      try {
        compatibility = (await this.inventoryApi.getCompatibility(
          account.primaryStoreId,
          sku,
        )) as unknown as Record<string, unknown>;
      } catch {
        compatibility = offer.compatibility as unknown as Record<
          string,
          unknown
        > | null;
      }
    }

    const channel =
      (offer.offerId ? channelByOffer.get(offer.offerId) : undefined) ??
      (offer.listingId ? channelByListing.get(offer.listingId) : undefined);

    const imageUrls = preferRicherImageUrls(
      extracted.imageUrls,
      existing?.imageUrls,
    );
    const listingStatus = this.health.mapOfferStatus(offer);
    const healthFlags = this.health.computeHealthFlags({
      title: extracted.title,
      imageUrls,
      itemSpecifics: extracted.itemSpecifics,
      compatibility,
      quantityAvailable: offer.availableQuantity ?? extracted.quantityAvailable,
      quantitySold: 0,
      performanceMetrics: {},
      categoryId: offer.categoryId ?? null,
      price: offer.pricingSummary?.price?.value ?? null,
    });

    const data: Partial<EbayPublishedListing> = {
      organizationId: account.organizationId,
      ebayAccountId: account.id,
      storeId: account.primaryStoreId,
      marketplaceId: offer.marketplaceId,
      ebayItemId: offer.listingId ?? null,
      offerId: offer.offerId ?? null,
      sku,
      title: extracted.title,
      description: offer.listingDescription ?? extracted.description,
      categoryId: offer.categoryId ?? null,
      price: offer.pricingSummary?.price?.value ?? null,
      currency: offer.pricingSummary?.price?.currency ?? 'USD',
      quantityAvailable: offer.availableQuantity ?? extracted.quantityAvailable,
      listingStatus,
      listingFormat: this.health.mapOfferFormat(offer.format),
      condition: extracted.condition,
      listingUrl: this.health.buildListingUrl(
        offer.listingId,
        offer.marketplaceId,
        account.environment,
      ),
      imageUrls,
      itemSpecifics: extracted.itemSpecifics,
      listingPolicies:
        (offer.listingPolicies as Record<string, unknown> | undefined) ?? null,
      compatibility,
      healthFlags,
      accountDisplayName: account.accountDisplayName,
      lastSyncedAt: new Date(),
      catalogProductId: channel?.catalogProductId ?? null,
      ebayListingChannelId: channel?.id ?? null,
      rawEbayResponse: { offer, inventoryItem: item },
    };

    if (existing) {
      Object.assign(existing, data);
      await this.listingRepo.save(existing);
      return { created: false };
    }

    let row = offer.listingId
      ? await this.listingRepo.findOne({
          where: {
            ebayAccountId: account.id,
            marketplaceId: offer.marketplaceId,
            ebayItemId: offer.listingId,
          },
        })
      : null;

    if (!row && offer.offerId) {
      row = await this.listingRepo.findOne({
        where: { ebayAccountId: account.id, offerId: offer.offerId },
      });
    }

    if (row) {
      Object.assign(row, data);
      await this.listingRepo.save(row);
      return { created: false };
    }

    const created = this.listingRepo.create(data as EbayPublishedListing);
    await this.listingRepo.save(created);
    return { created: true };
  }

  private isPublishedOffer(offer: EbayOffer): boolean {
    const status = (offer.status ?? '').toUpperCase();
    return status === 'PUBLISHED' || Boolean(offer.listingId);
  }

  private async syncFromTradingApi(
    account: ConnectedEbayAccount,
    storeId: string,
    marketplaceId: string | null,
    seenKeys: Set<string>,
    channelByListing: Map<string, EbayListingChannel>,
  ): Promise<{
    processed: number;
    created: number;
    updated: number;
    failed: number;
    warnings: Record<string, unknown>[];
    /** False when Trading API threw (rate limit / auth) — never prune or advance sync watermark. */
    liveFetchOk: boolean;
  }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    const warnings: Record<string, unknown>[] = [];
    let liveFetchOk = false;
    const enrichBudget = Math.max(
      0,
      Number(process.env.PUBLISHED_LISTINGS_ENRICH_MAX_PER_SYNC ?? '500') || 500,
    );
    let enrichUsed = 0;

    try {
      const items = await this.tradingApi.getAllLiveListings(
        storeId,
        marketplaceId,
      );
      // Successful Trading response (including a legitimately empty seller) —
      // safe to prune unseen actives and advance lastSuccessfulSyncAt.
      liveFetchOk = true;
      const mp = marketplaceId ?? 'EBAY_US';

      for (const item of items) {
        const key = `${mp}:${item.itemId}`;
        if (seenKeys.has(key)) continue;

        processed += 1;
        try {
          const result = await this.upsertFromTradingItem(
            account,
            item,
            mp,
            channelByListing,
            enrichUsed < enrichBudget,
          );
          if (result.enriched) enrichUsed += 1;
          if (result.created) created += 1;
          else updated += 1;
          seenKeys.add(key);
        } catch (e) {
          failed += 1;
          warnings.push({
            itemId: item.itemId,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // Spend any leftover enrich budget on active rows that still have ≤1 image
      // (Trading list responses usually only carry GalleryURL).
      if (enrichUsed < enrichBudget) {
        const backfilled = await this.enrichSparseImageListings(
          account,
          mp,
          enrichBudget - enrichUsed,
        );
        enrichUsed += backfilled;
        if (backfilled > 0) {
          this.logger.log(
            `Backfilled full image galleries for ${backfilled} listing(s) on ${account.accountDisplayName}`,
          );
        }
      }

      if (items.length > 0) {
        this.logger.log(
          `Trading live list for ${account.accountDisplayName}: ${items.length} active, ${created} new, ${updated} updated, enriched=${enrichUsed}/${enrichBudget}`,
        );
      }
    } catch (e) {
      warnings.push({
        source: 'trading_api',
        message: e instanceof Error ? e.message : String(e),
      });
      this.logger.warn(
        `Trading API fallback skipped for ${account.id}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    return { processed, created, updated, failed, warnings, liveFetchOk };
  }

  private async upsertFromTradingItem(
    account: ConnectedEbayAccount,
    item: TradingSellerListItem,
    marketplaceId: string,
    channelByListing: Map<string, EbayListingChannel>,
    allowEnrichment = true,
  ): Promise<{ created: boolean; enriched: boolean }> {
    const channel = channelByListing.get(item.itemId);
    const listingStatus =
      item.listingStatus.toLowerCase() !== 'active'
        ? 'ended'
        : item.quantityAvailable <= 0
          ? 'out_of_stock'
          : 'active';

    const row = await this.listingRepo.findOne({
      where: {
        ebayAccountId: account.id,
        marketplaceId,
        ebayItemId: item.itemId,
      },
    });

    // Trading ActiveList/SellerList often only returns GalleryURL (1 thumb).
    // Never wipe a previously enriched multi-image gallery down to that single URL.
    const tradingImages =
      item.imageUrls?.length > 0
        ? item.imageUrls
        : item.imageUrl
          ? [item.imageUrl]
          : [];
    let imageUrls = preferRicherImageUrls(row?.imageUrls, tradingImages);
    let compatibility: Record<string, unknown> | null =
      row?.compatibility ?? null;
    let description = row?.description ?? null;
    let itemSpecifics: Record<string, string[]> = {
      ...(row?.itemSpecifics ?? {}),
    };
    let enriched = false;
    let rawGetItem: Record<string, unknown> | undefined;

    const enrichmentInput = {
      storeId: account.primaryStoreId,
      ebayItemId: item.itemId,
      sku: item.sku,
      marketplaceId,
      listingUrl: item.listingUrl ?? row?.listingUrl ?? null,
      title: item.title ?? row?.title ?? null,
      imageUrls,
      compatibility,
      description,
      itemSpecifics,
      skipTrading:
        (process.env.PUBLISHED_LISTINGS_SKIP_TRADING_ENRICH ?? '')
          .toLowerCase() === '1' ||
        (process.env.PUBLISHED_LISTINGS_SKIP_TRADING_ENRICH ?? '')
          .toLowerCase() === 'true',
    };

    let enrichedTitle = item.title;
    let enrichedListingUrl =
      item.listingUrl ??
      row?.listingUrl ??
      null;

    if (
      allowEnrichment &&
      listingStatus === 'active' &&
      this.enrichment.needsEnrichment(enrichmentInput)
    ) {
      const result = await this.enrichment.enrichListing(enrichmentInput);
      imageUrls = preferRicherImageUrls(result.imageUrls, imageUrls);
      compatibility = result.compatibility ?? compatibility;
      if (result.description?.trim()) description = result.description;
      if (result.title?.trim()) enrichedTitle = result.title.trim();
      if (result.listingUrl?.trim()) enrichedListingUrl = result.listingUrl.trim();
      if (Object.keys(result.itemSpecifics ?? {}).length > 0) {
        itemSpecifics = result.itemSpecifics;
      }
      if (result.rawGetItem) {
        rawGetItem = result.rawGetItem as unknown as Record<string, unknown>;
      }
      enriched =
        result.sources.length > 0 &&
        (result.imageUrls.length > tradingImages.length ||
          result.compatibility != null ||
          Boolean(result.description?.trim()) ||
          Boolean(result.title?.trim()) ||
          Boolean(result.listingUrl?.trim()) ||
          Object.keys(result.itemSpecifics ?? {}).length > 0);
    }

    const performanceMetrics: Record<string, unknown> = {};
    if (item.viewCount != null) performanceMetrics.viewCount = item.viewCount;
    if (item.watchCount != null)
      performanceMetrics.watchCount = item.watchCount;

    const healthFlags = this.health.computeHealthFlags({
      title: enrichedTitle,
      imageUrls,
      itemSpecifics,
      compatibility,
      quantityAvailable: item.quantityAvailable,
      quantitySold: item.quantitySold,
      performanceMetrics,
      categoryId: item.categoryId,
      price: item.price != null ? String(item.price) : null,
      description,
      lastSyncedAt: new Date(),
    });

    const data: Partial<EbayPublishedListing> = {
      organizationId: account.organizationId,
      ebayAccountId: account.id,
      storeId: account.primaryStoreId,
      marketplaceId,
      ebayItemId: item.itemId,
      // Preserve an existing Inventory offerId (or one from the channel map).
      // Trading SellerList does not return offer ids — never wipe a known one.
      offerId: row?.offerId ?? channel?.offerId ?? null,
      sku: item.sku,
      title: enrichedTitle,
      description,
      categoryId: item.categoryId,
      price: item.price != null ? String(item.price) : null,
      currency: item.currency,
      quantityAvailable: item.quantityAvailable,
      quantitySold: item.quantitySold,
      listingStatus,
      listingFormat:
        item.listingFormat === 'auction' ? 'auction' : 'fixed_price',
      condition: item.condition,
      listingUrl:
        enrichedListingUrl ??
        this.health.buildListingUrl(
          item.itemId,
          marketplaceId,
          account.environment,
        ),
      imageUrls,
      itemSpecifics,
      compatibility,
      performanceMetrics,
      healthFlags,
      accountDisplayName: account.accountDisplayName,
      ebayStartTime: item.startTime ? new Date(item.startTime) : null,
      ebayEndTime: item.endTime ? new Date(item.endTime) : null,
      lastSyncedAt: new Date(),
      catalogProductId: channel?.catalogProductId ?? null,
      ebayListingChannelId: channel?.id ?? row?.ebayListingChannelId ?? null,
      rawEbayResponse: {
        syncSource: 'trading_api',
        item,
        ...(rawGetItem ? { getItem: rawGetItem } : {}),
      },
    };

    if (row) {
      Object.assign(row, data);
      await this.listingRepo.save(row);
      return { created: false, enriched };
    }

    const created = this.listingRepo.create(data as EbayPublishedListing);
    await this.listingRepo.save(created);
    return { created: true, enriched };
  }

  /**
   * Backfill gallery / description / item specifics / compatibility for active
   * rows that still look thin after Trading SellerList sync.
   */
  private async enrichSparseImageListings(
    account: ConnectedEbayAccount,
    marketplaceId: string,
    budget: number,
  ): Promise<number> {
    if (budget <= 0) return 0;

    const sparse = await this.listingRepo
      .createQueryBuilder('l')
      .where('l.ebayAccountId = :ebayAccountId', {
        ebayAccountId: account.id,
      })
      .andWhere('l.marketplaceId = :marketplaceId', { marketplaceId })
      .andWhere("l.listingStatus = 'active'")
      .andWhere('l.ebayItemId IS NOT NULL')
      .andWhere(
        new Brackets((sub) => {
          sub
            .where(
              `jsonb_array_length(COALESCE(l.image_urls, '[]'::jsonb)) <= 1`,
            )
            .orWhere(`COALESCE(l.description, '') = ''`)
            .orWhere(
              `COALESCE(l.item_specifics, '{}'::jsonb) = '{}'::jsonb`,
            )
            .orWhere('l.compatibility IS NULL')
            .orWhere(
              `l.listing_url ~* 'ebay\\.(de|fr|it|es|nl|be|at|ch|pl|ie|com\\.br)'`,
            );
        }),
      )
      .orderBy('l.lastSyncedAt', 'ASC')
      .take(budget)
      .getMany();

    let enriched = 0;
    for (const row of sparse) {
      if (!row.ebayItemId) continue;
      try {
        const result = await this.enrichment.enrichListing({
          storeId: account.primaryStoreId,
          ebayItemId: row.ebayItemId,
          sku: row.sku,
          marketplaceId,
          listingUrl: row.listingUrl,
          title: row.title,
          imageUrls: row.imageUrls ?? [],
          compatibility: row.compatibility,
          description: row.description,
          itemSpecifics: row.itemSpecifics ?? {},
          skipTrading:
            (process.env.PUBLISHED_LISTINGS_SKIP_TRADING_ENRICH ?? '')
              .toLowerCase() === '1' ||
            (process.env.PUBLISHED_LISTINGS_SKIP_TRADING_ENRICH ?? '')
              .toLowerCase() === 'true',
        });
        const nextImages = preferRicherImageUrls(
          result.imageUrls,
          row.imageUrls,
        );
        const imagesImproved = nextImages.length > (row.imageUrls?.length ?? 0);
        const compatImproved =
          result.compatibility != null &&
          Array.isArray(
            (result.compatibility as { compatibleProducts?: unknown })
              .compatibleProducts,
          ) &&
          !(
            row.compatibility != null &&
            Array.isArray(
              (row.compatibility as { compatibleProducts?: unknown })
                .compatibleProducts,
            )
          );
        const descriptionImproved =
          Boolean(result.description?.trim()) &&
          result.description?.trim() !== row.description?.trim();
        const titleImproved =
          Boolean(result.title?.trim()) &&
          result.title?.trim() !== row.title?.trim();
        const listingUrlImproved =
          Boolean(result.listingUrl?.trim()) &&
          result.listingUrl?.trim() !== row.listingUrl?.trim();
        const specificsImproved =
          Object.keys(result.itemSpecifics ?? {}).length >
          Object.keys(row.itemSpecifics ?? {}).length;

        if (
          !imagesImproved &&
          !compatImproved &&
          !descriptionImproved &&
          !titleImproved &&
          !listingUrlImproved &&
          !specificsImproved &&
          result.sources.length === 0
        ) {
          continue;
        }

        row.imageUrls = nextImages;
        if (result.title?.trim()) {
          row.title = result.title.trim();
        }
        if (result.listingUrl?.trim()) {
          row.listingUrl = result.listingUrl.trim();
        }
        if (result.compatibility != null) {
          row.compatibility = result.compatibility;
        }
        if (result.description?.trim()) {
          row.description = result.description;
        }
        if (Object.keys(result.itemSpecifics ?? {}).length > 0) {
          row.itemSpecifics = result.itemSpecifics;
        }
        if (result.rawGetItem) {
          row.rawEbayResponse = {
            ...(row.rawEbayResponse ?? {}),
            getItem: result.rawGetItem,
          };
        }
        row.healthFlags = this.health.computeHealthFlags({
          title: row.title,
          imageUrls: nextImages,
          itemSpecifics: row.itemSpecifics ?? {},
          compatibility: row.compatibility,
          quantityAvailable: row.quantityAvailable,
          quantitySold: row.quantitySold,
          performanceMetrics: row.performanceMetrics ?? {},
          categoryId: row.categoryId,
          price: row.price,
          description: row.description,
          lastSyncedAt: row.lastSyncedAt,
        });
        await this.listingRepo.save(row);
        enriched += 1;
      } catch (e) {
        this.logger.debug(
          `Sparse enrich skipped for ${row.ebayItemId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
    return enriched;
  }

  private async markUnseenActiveAsEnded(
    ebayAccountId: string,
    marketplaceId: string,
    seenKeys: Set<string>,
  ): Promise<number> {
    const activeRows = await this.listingRepo.find({
      where: {
        ebayAccountId,
        marketplaceId,
        listingStatus: 'active',
      },
      select: ['id', 'ebayItemId', 'marketplaceId'],
    });

    const toEnd = activeRows.filter((row) => {
      if (!row.ebayItemId) return false;
      const key = `${row.marketplaceId}:${row.ebayItemId}`;
      return !seenKeys.has(key);
    });

    if (toEnd.length === 0) return 0;

    await this.listingRepo.update(
      { id: In(toEnd.map((r) => r.id)) },
      {
        listingStatus: 'ended',
        lastSyncedAt: new Date(),
      },
    );
    return toEnd.length;
  }

  private async resolveAccounts(
    organizationId: string,
    ebayAccountId?: string,
  ): Promise<ConnectedEbayAccount[]> {
    if (ebayAccountId) {
      const account = await this.accountRepo.findOne({
        where: { id: ebayAccountId, organizationId },
      });
      if (!account) throw new NotFoundException('eBay account not found');
      return [account];
    }

    return this.accountRepo.find({
      where: { organizationId, connectionStatus: 'active' },
      order: { accountDisplayName: 'ASC' },
    });
  }

  async getSyncLogs(
    organizationId: string,
    ebayAccountId?: string,
    limit = 20,
  ): Promise<EbayPublishedListingSyncLog[]> {
    const where: Record<string, string> = { organizationId };
    if (ebayAccountId) where.ebayAccountId = ebayAccountId;
    return this.syncLogRepo.find({
      where,
      order: { startedAt: 'DESC' },
      take: Math.min(limit, 100),
    });
  }
}
