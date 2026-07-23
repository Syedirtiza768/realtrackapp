import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, In } from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
import { StoreAccessService } from '../../channels/store-access.service.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import { EbayPublishedListingSyncLog } from '../entities/ebay-published-listing-sync-log.entity.js';
import type { PublishedListingsQueryDto } from '../dto/published-listings.dto.js';
import {
  EBAY_STORE_SLUG_ALIASES,
  isAllStoresSlugQuery,
  parseStoreSlugQuery,
  resolveDefaultPublishedListingsStoreSlugs,
} from '../store-slug.util.js';
import {
  toPublishedListingApiResponse,
  type PublishedListingApiResponse,
} from '../published-listings-response.util.js';
import { PublishedListingsEnrichmentService } from './published-listings-enrichment.service.js';
import { PublishedListingsHealthService } from './published-listings-health.service.js';
import { preferRicherImageUrls } from '../../channels/ebay/ebay-listing-images.util.js';

/** Listings older than this relative to the account's last successful sync are not "live". */
export const LIVE_SYNC_SKEW_MS = 6 * 60 * 60 * 1000;

/** Store-level sync considered failed when last error is newer than last success, or never succeeded. */
const STORE_SYNC_STALE_MS = 24 * 60 * 60 * 1000;

export interface PublishedListingStoreSummary {
  storeId: string;
  storeSlug: string | null;
  name: string;
  activeListingCount: number;
  endedListingCount: number;
  lastSyncedAt: string | null;
  syncStatus: 'ok' | 'stale' | 'failed' | 'never_synced' | 'inactive';
  ebayAccountId: string | null;
  connectionStatus: string | null;
}

export interface PublishedListingsSyncStatusResponse {
  organizationId: string;
  globalActiveCount: number;
  stores: Array<{
    storeId: string;
    storeSlug: string | null;
    name: string;
    activeCount: number;
    endedCount: number;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    syncStatus: PublishedListingStoreSummary['syncStatus'];
    healthFlags: string[];
  }>;
  generatedAt: string;
}

@Injectable()
export class PublishedListingsService {
  constructor(
    @InjectRepository(EbayPublishedListing)
    private readonly listingRepo: Repository<EbayPublishedListing>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayPublishedListingSyncLog)
    private readonly syncLogRepo: Repository<EbayPublishedListingSyncLog>,
    private readonly storeAccess: StoreAccessService,
    private readonly enrichment: PublishedListingsEnrichmentService,
    private readonly health: PublishedListingsHealthService,
  ) {}

  async list(
    organizationId: string,
    user: User,
    query: PublishedListingsQueryDto,
  ): Promise<{
    items: EbayPublishedListing[];
    total: number;
    page: number;
    limit: number;
  }> {
    const accessibleStores = await this.storeAccess.getAccessibleStoreIds(user);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    const qb = this.listingRepo
      .createQueryBuilder('l')
      .innerJoin(
        ConnectedEbayAccount,
        'cea',
        'cea.id = l.ebayAccountId',
      )
      .where('l.organizationId = :organizationId', { organizationId });

    if (!user.storeAccessAll) {
      if (accessibleStores.size === 0) {
        return { items: [], total: 0, page, limit };
      }
      qb.andWhere('l.storeId IN (:...storeIds)', {
        storeIds: [...accessibleStores],
      });
    }

    if (query.ebayAccountId) {
      qb.andWhere('l.ebayAccountId = :ebayAccountId', {
        ebayAccountId: query.ebayAccountId,
      });
    }
    if (query.storeId) {
      qb.andWhere('l.storeId = :storeId', { storeId: query.storeId });
    }

    // Default scope: Blackline + Salvage only (unless storeId / storeSlug=all / explicit slug).
    const slugStoreIds = await this.resolveStoreSlugIds(
      organizationId,
      this.resolveListStoreSlugFilter(query),
    );
    if (slugStoreIds) {
      if (slugStoreIds.length === 0) {
        return { items: [], total: 0, page, limit };
      }
      qb.andWhere('l.storeId IN (:...slugStoreIds)', { slugStoreIds });
    }

    if (query.offerId) {
      qb.andWhere('l.offerId = :offerId', { offerId: query.offerId });
    }
    if (query.marketplaceId) {
      qb.andWhere('l.marketplaceId = :marketplaceId', {
        marketplaceId: query.marketplaceId,
      });
    }

    const status = query.status ?? 'active';
    if (status !== 'all') {
      qb.andWhere('l.listingStatus = :status', { status });
    }

    // Hard gate: active results only include rows from the latest live Trading
    // sync on an active eBay connection — never more than SellerList/ActiveList.
    // "Active" in this API always means buyable: quantityAvailable > 0.
    // Zero-qty live offers are stored as listingStatus=out_of_stock — use
    // status=out_of_stock or status=all to read them.
    // NOTE: correlated MAX(last_synced_at) self-heal subqueries timed out on
    // large mirrors; drift is prevented by not letting policy/order sync stamp
    // lastSuccessfulSyncAt (see ebay-policy-sync / ebay-sync).
    if (status === 'active') {
      qb.andWhere("cea.connectionStatus = 'active'");
      qb.andWhere('cea.lastSuccessfulSyncAt IS NOT NULL');
      qb.andWhere('l.lastSyncedAt IS NOT NULL');
      qb.andWhere(
        `l.lastSyncedAt >= cea.lastSuccessfulSyncAt - INTERVAL '${LIVE_SYNC_SKEW_MS / 1000} seconds'`,
      );
      qb.andWhere('l.quantityAvailable > 0');
    }

    if (query.format) {
      qb.andWhere('l.listingFormat = :format', { format: query.format });
    }
    if (query.condition) {
      qb.andWhere('l.condition ILIKE :condition', {
        condition: `%${query.condition}%`,
      });
    }
    if (query.categoryId) {
      qb.andWhere('l.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.priceMin != null) {
      qb.andWhere('l.price >= :priceMin', { priceMin: query.priceMin });
    }
    if (query.priceMax != null) {
      qb.andWhere('l.price <= :priceMax', { priceMax: query.priceMax });
    }
    if (query.quantityMin != null) {
      qb.andWhere('l.quantityAvailable >= :quantityMin', {
        quantityMin: query.quantityMin,
      });
    }
    if (query.quantityMax != null) {
      qb.andWhere('l.quantityAvailable <= :quantityMax', {
        quantityMax: query.quantityMax,
      });
    }
    if (query.soldMin != null) {
      qb.andWhere('l.quantitySold >= :soldMin', { soldMin: query.soldMin });
    }
    if (query.listedFrom) {
      qb.andWhere('l.ebayStartTime >= :listedFrom', {
        listedFrom: query.listedFrom,
      });
    }
    if (query.listedTo) {
      qb.andWhere('l.ebayStartTime <= :listedTo', { listedTo: query.listedTo });
    }
    if (query.lowStock === 'true') {
      qb.andWhere('l.quantityAvailable > 0 AND l.quantityAvailable <= 3');
    }
    if (query.lowStock === 'out') {
      qb.andWhere('l.quantityAvailable <= 0');
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('l.title ILIKE :term', { term })
            .orWhere('l.sku ILIKE :term', { term })
            .orWhere('l.ebayItemId ILIKE :term', { term })
            .orWhere('l.categoryName ILIKE :term', { term })
            .orWhere('l.accountDisplayName ILIKE :term', { term })
            .orWhere('l.item_specifics::text ILIKE :term', { term });
        }),
      );
    }

    const sortMap: Record<string, string> = {
      price: 'l.price',
      sales: 'l.quantitySold',
      quantity: 'l.quantityAvailable',
      created: 'l.createdAt',
      updated: 'l.updatedAt',
      title: 'l.title',
      synced: 'l.lastSyncedAt',
      id: 'l.id',
    };
    const sortCol = sortMap[query.sortBy ?? 'updated'] ?? 'l.updatedAt';
    const sortDir = query.sortDir === 'asc' ? 'ASC' : 'DESC';
    // Stable pagination: always break ties on id so page windows do not drift.
    qb.orderBy(sortCol, sortDir).addOrderBy('l.id', sortDir);

    const [items, total] = await qb.skip(offset).take(limit).getManyAndCount();
    return { items, total, page, limit };
  }

  /**
   * Resolve which storeSlug string to apply for list filtering.
   * - Explicit storeId → no slug filter (storeId already scopes)
   * - storeSlug=all|* → no slug filter
   * - Explicit storeSlug → that value
   * - Otherwise → default Blackline + Salvage
   */
  private resolveListStoreSlugFilter(
    query: PublishedListingsQueryDto,
  ): string | undefined {
    if (query.storeId) return undefined;
    if (isAllStoresSlugQuery(query.storeSlug)) return undefined;
    if (query.storeSlug?.trim()) return query.storeSlug;
    const defaults = resolveDefaultPublishedListingsStoreSlugs();
    return defaults || undefined;
  }

  /**
   * Resolve ?storeSlug=salvagea,blackline to store UUIDs.
   * Returns null when the filter is absent; [] when no stores match.
   */
  private async resolveStoreSlugIds(
    organizationId: string,
    storeSlug: string | undefined,
  ): Promise<string[] | null> {
    if (isAllStoresSlugQuery(storeSlug)) return null;
    const slugs = parseStoreSlugQuery(storeSlug);
    if (slugs.length === 0) return null;

    const ids = new Set<string>();

    for (const slug of slugs) {
      for (const id of EBAY_STORE_SLUG_ALIASES[slug] ?? []) {
        ids.add(id);
      }
    }

    const stores = await this.storeRepo
      .createQueryBuilder('s')
      .where('s.organization_id = :organizationId', { organizationId })
      .andWhere(
        new Brackets((sub) => {
          sub
            .where(
              `LOWER(COALESCE(s.config->>'storeSlug', '')) IN (:...slugs)`,
              { slugs },
            )
            .orWhere(
              `LOWER(COALESCE(s.store_url, '')) LIKE ANY(ARRAY[:...urlPatterns])`,
              {
                urlPatterns: slugs.map((s) => `%/str/${s}%`),
              },
            );
        }),
      )
      .getMany();

    for (const store of stores) {
      ids.add(store.id);
    }

    if (ids.size === 0) {
      throw new BadRequestException(
        `No stores matched storeSlug="${slugs.join(',')}"`,
      );
    }

    return [...ids];
  }

  async getById(
    id: string,
    organizationId: string,
    user: User,
  ): Promise<PublishedListingApiResponse> {
    let listing = await this.listingRepo.findOne({
      where: { id, organizationId },
    });
    if (!listing) throw new NotFoundException('Published listing not found');
    await this.assertListingAccess(user, listing.storeId);

    listing = await this.maybeEnrichDetailOnDemand(listing);

    const storeSlug = await this.resolveStoreSlugForId(listing.storeId);
    return toPublishedListingApiResponse(listing, { storeSlug });
  }

  /**
   * When detail is thin, backfill via Browse + optional public-page scrape
   * (no Trading GetItem by default while usage limits are hot).
   * Enable with PUBLISHED_LISTINGS_ON_DEMAND_ENRICH=1.
   */
  private async maybeEnrichDetailOnDemand(
    listing: EbayPublishedListing,
  ): Promise<EbayPublishedListing> {
    const flag = (
      process.env.PUBLISHED_LISTINGS_ON_DEMAND_ENRICH ?? ''
    ).toLowerCase();
    if (flag !== '1' && flag !== 'true' && flag !== 'yes') return listing;
    if (!listing.ebayItemId) return listing;

    const enrichmentInput = {
      storeId: listing.storeId,
      ebayItemId: listing.ebayItemId,
      sku: listing.sku,
      marketplaceId: listing.marketplaceId,
      listingUrl: listing.listingUrl,
      title: listing.title,
      imageUrls: listing.imageUrls ?? [],
      compatibility: listing.compatibility,
      description: listing.description,
      itemSpecifics: listing.itemSpecifics ?? {},
      skipTrading: true,
    };
    if (!this.enrichment.needsEnrichment(enrichmentInput)) return listing;

    try {
      const result = await this.enrichment.enrichListing(enrichmentInput);
      if (result.sources.length === 0) return listing;

      const nextImages = preferRicherImageUrls(
        result.imageUrls,
        listing.imageUrls,
      );
      const imagesImproved =
        nextImages.length > (listing.imageUrls?.length ?? 0);
      const descriptionImproved =
        Boolean(result.description?.trim()) &&
        result.description?.trim() !== listing.description?.trim();
      const titleImproved =
        Boolean(result.title?.trim()) &&
        result.title?.trim() !== listing.title?.trim();
      const listingUrlImproved =
        Boolean(result.listingUrl?.trim()) &&
        result.listingUrl?.trim() !== listing.listingUrl?.trim();
      const specificsImproved =
        Object.keys(result.itemSpecifics ?? {}).length >
        Object.keys(listing.itemSpecifics ?? {}).length;
      const compatImproved =
        result.compatibility != null &&
        Array.isArray(
          (result.compatibility as { compatibleProducts?: unknown })
            .compatibleProducts,
        ) &&
        !(
          listing.compatibility != null &&
          Array.isArray(
            (listing.compatibility as { compatibleProducts?: unknown })
              .compatibleProducts,
          )
        );

      if (
        !imagesImproved &&
        !descriptionImproved &&
        !titleImproved &&
        !listingUrlImproved &&
        !specificsImproved &&
        !compatImproved
      ) {
        return listing;
      }

      listing.imageUrls = nextImages;
      if (result.title?.trim()) listing.title = result.title.trim();
      if (result.listingUrl?.trim()) listing.listingUrl = result.listingUrl.trim();
      if (result.description?.trim()) listing.description = result.description;
      if (Object.keys(result.itemSpecifics ?? {}).length > 0) {
        listing.itemSpecifics = result.itemSpecifics;
      }
      if (result.compatibility != null) {
        listing.compatibility = result.compatibility;
      }
      if (result.rawGetItem) {
        listing.rawEbayResponse = {
          ...(listing.rawEbayResponse ?? {}),
          pageEnrichment: result.rawGetItem,
          pageEnrichmentSources: result.sources,
        };
      }
      listing.healthFlags = this.health.computeHealthFlags({
        title: listing.title,
        imageUrls: listing.imageUrls,
        itemSpecifics: listing.itemSpecifics ?? {},
        compatibility: listing.compatibility,
        quantityAvailable: listing.quantityAvailable,
        quantitySold: listing.quantitySold,
        performanceMetrics: listing.performanceMetrics ?? {},
        categoryId: listing.categoryId,
        price: listing.price,
        description: listing.description,
        lastSyncedAt: listing.lastSyncedAt,
      });
      await this.listingRepo.save(listing);
    } catch {
      // Detail read must not fail if enrichment is unavailable.
    }
    return listing;
  }

  async getSummary(
    organizationId: string,
    user: User,
    ebayAccountId?: string,
  ): Promise<{
    total: number;
    active: number;
    ended: number;
    outOfStock: number;
    withWarnings: number;
    lastSyncedAt: string | null;
  }> {
    const accessibleStores = await this.storeAccess.getAccessibleStoreIds(user);
    const qb = this.listingRepo
      .createQueryBuilder('l')
      .where('l.organizationId = :organizationId', { organizationId });

    if (!user.storeAccessAll) {
      if (accessibleStores.size === 0) {
        return {
          total: 0,
          active: 0,
          ended: 0,
          outOfStock: 0,
          withWarnings: 0,
          lastSyncedAt: null,
        };
      }
      qb.andWhere('l.storeId IN (:...storeIds)', {
        storeIds: [...accessibleStores],
      });
    }
    if (ebayAccountId) {
      qb.andWhere('l.ebayAccountId = :ebayAccountId', { ebayAccountId });
    }

    const total = await qb.getCount();
    const active = await qb
      .clone()
      .andWhere("l.listingStatus = 'active'")
      .getCount();
    const ended = await qb
      .clone()
      .andWhere("l.listingStatus = 'ended'")
      .getCount();
    const outOfStock = await qb
      .clone()
      .andWhere("l.listingStatus = 'out_of_stock'")
      .getCount();
    const withWarnings = await qb
      .clone()
      .andWhere('jsonb_array_length(l.health_flags) > 0')
      .getCount();

    const lastRow = await this.listingRepo
      .createQueryBuilder('l')
      .select('MAX(l.lastSyncedAt)', 'max')
      .where('l.organizationId = :organizationId', { organizationId })
      .getRawOne<{ max: Date | null }>();

    return {
      total,
      active,
      ended,
      outOfStock,
      withWarnings,
      lastSyncedAt: lastRow?.max?.toISOString() ?? null,
    };
  }

  /**
   * Reader-visible store catalog (no stores.view required).
   * Includes active/ended counts + sync health for marketplace consumers.
   */
  async listStores(
    organizationId: string,
    user: User,
  ): Promise<{ items: PublishedListingStoreSummary[] }> {
    const accessibleStores = await this.storeAccess.getAccessibleStoreIds(user);
    const accounts = await this.accountRepo.find({
      where: { organizationId },
      relations: ['primaryStore'],
    });

    const storeIds = [
      ...new Set(
        accounts
          .map((a) => a.primaryStoreId)
          .filter((id) => user.storeAccessAll || accessibleStores.has(id)),
      ),
    ];

    // Also include stores that have mirror rows but no connected account join.
    const listingStoreRows = await this.listingRepo
      .createQueryBuilder('l')
      .select('DISTINCT l.storeId', 'storeId')
      .where('l.organizationId = :organizationId', { organizationId })
      .getRawMany<{ storeId: string }>();
    for (const row of listingStoreRows) {
      if (user.storeAccessAll || accessibleStores.has(row.storeId)) {
        storeIds.push(row.storeId);
      }
    }
    const uniqueStoreIds = [...new Set(storeIds)];
    if (uniqueStoreIds.length === 0) return { items: [] };

    const stores = await this.storeRepo.find({
      where: { id: In(uniqueStoreIds) },
    });
    const storeById = new Map(stores.map((s) => [s.id, s]));
    const accountByStore = new Map(
      accounts.map((a) => [a.primaryStoreId, a] as const),
    );

    const countRows = await this.listingRepo
      .createQueryBuilder('l')
      .select('l.storeId', 'storeId')
      .addSelect(
        `SUM(CASE WHEN l.listingStatus = 'active' AND l.quantityAvailable > 0 THEN 1 ELSE 0 END)`,
        'activeCount',
      )
      .addSelect(
        `SUM(CASE WHEN l.listingStatus = 'ended' THEN 1 ELSE 0 END)`,
        'endedCount',
      )
      .addSelect('MAX(l.lastSyncedAt)', 'lastSyncedAt')
      .where('l.organizationId = :organizationId', { organizationId })
      .andWhere('l.storeId IN (:...storeIds)', { storeIds: uniqueStoreIds })
      .groupBy('l.storeId')
      .getRawMany<{
        storeId: string;
        activeCount: string;
        endedCount: string;
        lastSyncedAt: Date | null;
      }>();
    const countsByStore = new Map(
      countRows.map((r) => [
        r.storeId,
        {
          active: Number(r.activeCount) || 0,
          ended: Number(r.endedCount) || 0,
          lastSyncedAt: r.lastSyncedAt,
        },
      ]),
    );

    const liveActiveByStore = await this.countLiveActiveByStore(
      organizationId,
      uniqueStoreIds,
    );

    const items: PublishedListingStoreSummary[] = [];
    for (const storeId of uniqueStoreIds) {
      const store = storeById.get(storeId);
      if (!store) continue;
      const account = accountByStore.get(storeId);
      const counts = countsByStore.get(storeId) ?? {
        active: 0,
        ended: 0,
        lastSyncedAt: null,
      };
      const liveActive = liveActiveByStore.get(storeId) ?? 0;
      const syncStatus = this.resolveStoreSyncStatus(account, liveActive);
      items.push({
        storeId,
        storeSlug: this.extractStoreSlug(store),
        name: store.storeName,
        activeListingCount: liveActive,
        endedListingCount: counts.ended,
        lastSyncedAt:
          account?.lastSuccessfulSyncAt?.toISOString() ??
          counts.lastSyncedAt?.toISOString() ??
          null,
        syncStatus,
        ebayAccountId: account?.id ?? null,
        connectionStatus: account?.connectionStatus ?? null,
      });
    }

    items.sort((a, b) => a.name.localeCompare(b.name));
    return { items };
  }

  async getSyncStatus(
    organizationId: string,
    user: User,
  ): Promise<PublishedListingsSyncStatusResponse> {
    const { items: stores } = await this.listStores(organizationId, user);
    const storeIds = stores.map((s) => s.storeId);
    const accountIds = stores
      .map((s) => s.ebayAccountId)
      .filter((id): id is string => Boolean(id));

    const latestFailByAccount = new Map<
      string,
      { at: Date; error: string | null }
    >();
    if (accountIds.length > 0) {
      const failLogs = await this.syncLogRepo
        .createQueryBuilder('log')
        .where('log.organizationId = :organizationId', { organizationId })
        .andWhere('log.ebayAccountId IN (:...accountIds)', { accountIds })
        .andWhere("log.status = 'failed'")
        .orderBy('log.startedAt', 'DESC')
        .getMany();
      for (const log of failLogs) {
        if (latestFailByAccount.has(log.ebayAccountId)) continue;
        const firstError = Array.isArray(log.errors) ? log.errors[0] : null;
        const message =
          firstError && typeof firstError === 'object' && 'message' in firstError
            ? String((firstError as { message?: unknown }).message ?? '')
            : null;
        latestFailByAccount.set(log.ebayAccountId, {
          at: log.completedAt ?? log.startedAt,
          error: message || 'Published listings sync failed',
        });
      }
    }

    let globalActiveCount = 0;
    const enrichedStores = stores.map((store) => {
      globalActiveCount += store.activeListingCount;
      const fail = store.ebayAccountId
        ? latestFailByAccount.get(store.ebayAccountId)
        : undefined;
      const lastSuccessMs = store.lastSyncedAt
        ? new Date(store.lastSyncedAt).getTime()
        : 0;
      const failedRecently =
        Boolean(fail) &&
        (!lastSuccessMs || fail!.at.getTime() > lastSuccessMs);
      const syncStatus = failedRecently ? 'failed' : store.syncStatus;
      const healthFlags: string[] = [];
      if (syncStatus === 'failed') healthFlags.push('store_sync_failed');
      if (syncStatus === 'stale') healthFlags.push('sync_stale');
      if (store.activeListingCount === 0) healthFlags.push('empty_active_mirror');

      return {
        storeId: store.storeId,
        storeSlug: store.storeSlug,
        name: store.name,
        activeCount: store.activeListingCount,
        endedCount: store.endedListingCount,
        lastSuccessAt: store.lastSyncedAt,
        lastErrorAt: fail?.at.toISOString() ?? null,
        lastError: fail?.error ?? null,
        syncStatus,
        healthFlags,
      };
    });

    return {
      organizationId,
      globalActiveCount,
      stores: enrichedStores,
      generatedAt: new Date().toISOString(),
    };
  }

  private async countLiveActiveByStore(
    organizationId: string,
    storeIds: string[],
  ): Promise<Map<string, number>> {
    if (storeIds.length === 0) return new Map();
    const rows = await this.listingRepo
      .createQueryBuilder('l')
      .innerJoin(ConnectedEbayAccount, 'cea', 'cea.id = l.ebayAccountId')
      .select('l.storeId', 'storeId')
      .addSelect('COUNT(*)', 'cnt')
      .where('l.organizationId = :organizationId', { organizationId })
      .andWhere('l.storeId IN (:...storeIds)', { storeIds })
      .andWhere("l.listingStatus = 'active'")
      .andWhere('l.quantityAvailable > 0')
      .andWhere("cea.connectionStatus = 'active'")
      .andWhere('cea.lastSuccessfulSyncAt IS NOT NULL')
      .andWhere('l.lastSyncedAt IS NOT NULL')
      .andWhere(
        `l.lastSyncedAt >= cea.lastSuccessfulSyncAt - INTERVAL '${LIVE_SYNC_SKEW_MS / 1000} seconds'`,
      )
      .groupBy('l.storeId')
      .getRawMany<{ storeId: string; cnt: string }>();
    return new Map(rows.map((r) => [r.storeId, Number(r.cnt) || 0]));
  }

  private resolveStoreSyncStatus(
    account: ConnectedEbayAccount | undefined,
    liveActive: number,
  ): PublishedListingStoreSummary['syncStatus'] {
    if (!account) return 'never_synced';
    if (account.connectionStatus !== 'active') return 'inactive';
    if (!account.lastSuccessfulSyncAt) return 'never_synced';
    const age = Date.now() - account.lastSuccessfulSyncAt.getTime();
    if (age > STORE_SYNC_STALE_MS) return 'stale';
    // Active connection with a recent watermark but zero live rows is still
    // "ok" at the sync layer — empty inventory is surfaced via activeListingCount.
    void liveActive;
    return 'ok';
  }

  private extractStoreSlug(store: Store): string | null {
    const fromConfig =
      typeof store.config?.storeSlug === 'string'
        ? store.config.storeSlug.trim().toLowerCase()
        : '';
    if (fromConfig) return fromConfig;
    const url = store.storeUrl ?? '';
    const match = url.match(/ebay\.com\/str\/([a-z0-9_-]+)/i);
    if (match?.[1]) return match[1].toLowerCase();
    for (const preferred of [
      'salvagea',
      'blacklineusedautoparts',
      'blackline',
      'salvage',
    ]) {
      if (EBAY_STORE_SLUG_ALIASES[preferred]?.includes(store.id)) {
        return preferred;
      }
    }
    for (const [slug, ids] of Object.entries(EBAY_STORE_SLUG_ALIASES)) {
      if (ids.includes(store.id)) return slug;
    }
    return null;
  }

  private async resolveStoreSlugForId(storeId: string): Promise<string | null> {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    return store ? this.extractStoreSlug(store) : null;
  }

  private async assertListingAccess(
    user: User,
    storeId: string,
  ): Promise<void> {
    if (user.storeAccessAll) return;
    const stores = await this.storeAccess.getAccessibleStoreIds(user);
    if (!stores.has(storeId)) {
      throw new ForbiddenException('No access to this store listing');
    }
  }
}
