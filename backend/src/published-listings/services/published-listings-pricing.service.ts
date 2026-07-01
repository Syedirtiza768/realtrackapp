import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EbayBrowseApiService } from '../../channels/ebay/ebay-browse-api.service.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import { PublishedListingsHealthService } from './published-listings-health.service.js';

export interface CompetitorPricingSnapshot {
  searchQuery: string;
  sampleCount: number;
  avgPrice: number | null;
  medianPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  fetchedAt: string;
  topCompetitors: Array<{
    itemId: string | null;
    title: string | null;
    price: number | null;
    condition: string | null;
  }>;
}

@Injectable()
export class PublishedListingsPricingService {
  private readonly logger = new Logger(PublishedListingsPricingService.name);

  constructor(
    @InjectRepository(EbayPublishedListing)
    private readonly listingRepo: Repository<EbayPublishedListing>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    private readonly browseApi: EbayBrowseApiService,
    private readonly health: PublishedListingsHealthService,
  ) {}

  buildSearchQuery(listing: EbayPublishedListing): string | null {
    const specifics = listing.itemSpecifics ?? {};
    const brand =
      specifics.Brand?.[0] ??
      specifics['Manufacturer']?.[0] ??
      specifics['Brand Name']?.[0];
    const mpn =
      specifics['Manufacturer Part Number']?.[0] ??
      specifics.MPN?.[0] ??
      specifics['OE/OEM Part Number']?.[0];

    if (brand && mpn) return `${brand} ${mpn}`.trim();
    if (mpn) return mpn;
    if (listing.sku && listing.sku.length >= 4) return listing.sku;
    if (listing.title.length >= 8) {
      return listing.title.split(/\s+/).slice(0, 6).join(' ');
    }
    return null;
  }

  async refreshCompetitorPricing(
    listingId: string,
    organizationId: string,
  ): Promise<EbayPublishedListing> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId, organizationId },
    });
    if (!listing) throw new NotFoundException('Published listing not found');

    const searchQuery = this.buildSearchQuery(listing);
    if (!searchQuery) {
      this.logger.debug(`No search query for listing ${listingId}`);
      return listing;
    }

    const condition =
      listing.condition?.toUpperCase().includes('NEW') ? 'NEW' : undefined;
    const pricing = await this.browseApi.getCompetitorPricing(
      searchQuery,
      condition,
      25,
    );

    const snapshot: CompetitorPricingSnapshot = {
      searchQuery,
      sampleCount: pricing.items.length,
      avgPrice: pricing.avgPrice,
      medianPrice: pricing.medianPrice,
      minPrice: pricing.minPrice,
      maxPrice: pricing.maxPrice,
      fetchedAt: new Date().toISOString(),
      topCompetitors: pricing.items.slice(0, 5).map((i) => ({
        itemId: i.itemId ?? null,
        title: i.title ?? null,
        price: i.price?.value ? Number(i.price.value) : null,
        condition: i.condition ?? null,
      })),
    };

    listing.performanceMetrics = {
      ...(listing.performanceMetrics ?? {}),
      competitorPricing: snapshot,
    };
    listing.healthFlags = this.health.computeHealthFlags({
      title: listing.title,
      imageUrls: listing.imageUrls,
      itemSpecifics: listing.itemSpecifics,
      compatibility: listing.compatibility,
      quantityAvailable: listing.quantityAvailable,
      quantitySold: listing.quantitySold,
      performanceMetrics: listing.performanceMetrics,
      categoryId: listing.categoryId,
      price: listing.price,
      competitorPricing: snapshot,
    });
    await this.listingRepo.save(listing);
    return listing;
  }

  async refreshForAccount(
    organizationId: string,
    ebayAccountId: string,
    limit = 50,
  ): Promise<{ processed: number; updated: number; skipped: number }> {
    const listings = await this.listingRepo.find({
      where: { organizationId, ebayAccountId, listingStatus: 'active' },
      order: { updatedAt: 'DESC' },
      take: limit,
    });

    let updated = 0;
    let skipped = 0;
    for (const listing of listings) {
      if (!this.buildSearchQuery(listing)) {
        skipped += 1;
        continue;
      }
      try {
        await this.refreshCompetitorPricing(listing.id, organizationId);
        updated += 1;
      } catch (e) {
        this.logger.warn(
          `Competitor pricing failed for ${listing.id}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
        skipped += 1;
      }
    }
    return { processed: listings.length, updated, skipped };
  }

  async refreshForOrganization(
    organizationId: string,
    limitPerAccount = 50,
  ): Promise<{ accounts: number; updated: number; skipped: number }> {
    const accounts = await this.accountRepo.find({
      where: { organizationId, connectionStatus: 'active' },
    });
    let updated = 0;
    let skipped = 0;
    for (const account of accounts) {
      const result = await this.refreshForAccount(
        organizationId,
        account.id,
        limitPerAccount,
      );
      updated += result.updated;
      skipped += result.skipped;
    }
    return { accounts: accounts.length, updated, skipped };
  }
}
