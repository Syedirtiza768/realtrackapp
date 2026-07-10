import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { StoreAccessService } from '../../channels/store-access.service.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import type { PublishedListingsQueryDto } from '../dto/published-listings.dto.js';

@Injectable()
export class PublishedListingsService {
  constructor(
    @InjectRepository(EbayPublishedListing)
    private readonly listingRepo: Repository<EbayPublishedListing>,
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
    if (query.marketplaceId) {
      qb.andWhere('l.marketplaceId = :marketplaceId', {
        marketplaceId: query.marketplaceId,
      });
    }
    if (query.status) {
      qb.andWhere('l.listingStatus = :status', { status: query.status });
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
