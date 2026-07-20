import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
import { StoreAccessService } from '../../channels/store-access.service.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import type { PublishedListingsQueryDto } from '../dto/published-listings.dto.js';
import {
  EBAY_STORE_SLUG_ALIASES,
  isAllStoresSlugQuery,
  parseStoreSlugQuery,
  resolveDefaultPublishedListingsStoreSlugs,
} from '../store-slug.util.js';

/** Listings older than this relative to the account's last successful sync are not "live". */
const LIVE_SYNC_SKEW_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class PublishedListingsService {
  constructor(
    @InjectRepository(EbayPublishedListing)
    private readonly listingRepo: Repository<EbayPublishedListing>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly storeAccess: StoreAccessService,
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
    if (status === 'active') {
      qb.andWhere("cea.connectionStatus = 'active'");
      qb.andWhere('cea.lastSuccessfulSyncAt IS NOT NULL');
      qb.andWhere('l.lastSyncedAt IS NOT NULL');
      qb.andWhere(
        `l.lastSyncedAt >= cea.lastSuccessfulSyncAt - INTERVAL '${LIVE_SYNC_SKEW_MS / 1000} seconds'`,
      );
      // Buyable only: active + non-zero quantity (unless caller sets quantityMin / lowStock=out).
      if (query.quantityMin == null && query.lowStock !== 'out') {
        qb.andWhere('l.quantityAvailable > 0');
      }
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
    };
    const sortCol = sortMap[query.sortBy ?? 'updated'] ?? 'l.updatedAt';
    const sortDir = query.sortDir === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(sortCol, sortDir);

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
  ): Promise<EbayPublishedListing> {
    const listing = await this.listingRepo.findOne({
      where: { id, organizationId },
    });
    if (!listing) throw new NotFoundException('Published listing not found');
    await this.assertListingAccess(user, listing.storeId);
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
