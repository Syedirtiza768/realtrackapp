import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import { EbayTradingApiService } from '../../channels/ebay/ebay-trading-api.service.js';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DAILY_BUDGET = Number(
  process.env.TRADING_ENRICHMENT_DAILY_BUDGET ?? '4500',
);

export interface CachedTradingEnrichment {
  enrichedAt: string;
  source: 'trading_api';
  imageUrls: string[];
  compatibility: Record<string, unknown> | null;
  description: string | null;
  itemSpecifics: Record<string, string[]>;
}

@Injectable()
export class PublishedListingsTradingEnrichmentService {
  private readonly logger = new Logger(
    PublishedListingsTradingEnrichmentService.name,
  );

  private dailyCallCount = 0;
  private dailyResetDate = '';

  constructor(
    @InjectRepository(EbayPublishedListing)
    private readonly listingRepo: Repository<EbayPublishedListing>,
    private readonly tradingApi: EbayTradingApiService,
  ) {}

  private checkBudget(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.dailyResetDate) {
      this.dailyCallCount = 0;
      this.dailyResetDate = today;
    }
    return this.dailyCallCount < DAILY_BUDGET;
  }

  private incrementBudget(): void {
    this.dailyCallCount += 1;
  }

  getBudgetStatus(): { used: number; remaining: number; limit: number; resetDate: string } {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.dailyResetDate) {
      this.dailyCallCount = 0;
      this.dailyResetDate = today;
    }
    return {
      used: this.dailyCallCount,
      remaining: Math.max(0, DAILY_BUDGET - this.dailyCallCount),
      limit: DAILY_BUDGET,
      resetDate: this.dailyResetDate,
    };
  }

  async enrich(
    listing: EbayPublishedListing,
    options?: { force?: boolean },
  ): Promise<{
    data: CachedTradingEnrichment;
    cached: boolean;
    budget: ReturnType<typeof this.getBudgetStatus>;
  }> {
    const cached = this.readCache(listing);
    if (cached && !options?.force) {
      return {
        data: cached,
        cached: true,
        budget: this.getBudgetStatus(),
      };
    }

    if (!this.checkBudget()) {
      this.logger.warn(
        `Trading enrichment budget exhausted (${DAILY_BUDGET}/day). ` +
          `Returning stale cache for ${listing.ebayItemId}.`,
      );
      if (cached) {
        return {
          data: cached,
          cached: true,
          budget: this.getBudgetStatus(),
        };
      }
      return {
        data: this.emptyResult(),
        cached: false,
        budget: this.getBudgetStatus(),
      };
    }

    if (!listing.ebayItemId) {
      return {
        data: this.emptyResult(),
        cached: false,
        budget: this.getBudgetStatus(),
      };
    }

    try {
      this.incrementBudget();
      const t0 = Date.now();
      const result = await this.tradingApi.getItemDetails(
        listing.storeId,
        listing.ebayItemId,
        listing.marketplaceId,
      );
      const elapsed = Date.now() - t0;
      this.logger.log(
        `Trading GetItem ${listing.ebayItemId} completed in ${elapsed}ms ` +
          `(budget: ${this.dailyCallCount}/${DAILY_BUDGET})`,
      );

      const enrichment: CachedTradingEnrichment = {
        enrichedAt: new Date().toISOString(),
        source: 'trading_api',
        imageUrls: result.imageUrls,
        compatibility: result.compatibility as Record<string, unknown> | null,
        description: result.description,
        itemSpecifics: result.itemSpecifics,
      };

      await this.persistCache(listing, enrichment);

      return {
        data: enrichment,
        cached: false,
        budget: this.getBudgetStatus(),
      };
    } catch (err) {
      this.logger.warn(
        `Trading GetItem failed for ${listing.ebayItemId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      if (cached) {
        return {
          data: cached,
          cached: true,
          budget: this.getBudgetStatus(),
        };
      }
      return {
        data: this.emptyResult(),
        cached: false,
        budget: this.getBudgetStatus(),
      };
    }
  }

  async preEnrichBatch(
    listings: EbayPublishedListing[],
    options?: { force?: boolean },
  ): Promise<{ enriched: number; skipped: number; failed: number }> {
    let enriched = 0;
    let skipped = 0;
    let failed = 0;

    for (const listing of listings) {
      if (!this.checkBudget()) {
        this.logger.warn(
          `Pre-enrichment budget exhausted. ${listings.length - enriched - skipped - failed} remaining.`,
        );
        skipped += listings.length - enriched - skipped - failed;
        break;
      }

      const cached = this.readCache(listing);
      if (cached && !options?.force) {
        skipped += 1;
        continue;
      }

      try {
        await this.enrich(listing, options);
        enriched += 1;
      } catch {
        failed += 1;
      }
    }

    this.logger.log(
      `Pre-enrichment batch: ${enriched} enriched, ${skipped} skipped, ${failed} failed. ` +
        `Budget: ${this.dailyCallCount}/${DAILY_BUDGET}`,
    );
    return { enriched, skipped, failed };
  }

  private readCache(
    listing: EbayPublishedListing,
  ): CachedTradingEnrichment | null {
    const raw = listing.rawEbayResponse as Record<string, unknown> | null;
    if (!raw) return null;
    const cached = raw['tradingEnrichment'] as
      | CachedTradingEnrichment
      | undefined;
    if (!cached?.enrichedAt) return null;
    const age = Date.now() - new Date(cached.enrichedAt).getTime();
    if (age > CACHE_TTL_MS) return null;
    return cached;
  }

  private async persistCache(
    listing: EbayPublishedListing,
    enrichment: CachedTradingEnrichment,
  ): Promise<void> {
    listing.rawEbayResponse = {
      ...(listing.rawEbayResponse ?? {}),
      tradingEnrichment: enrichment,
    };
    await this.listingRepo.save(listing);
  }

  private emptyResult(): CachedTradingEnrichment {
    return {
      enrichedAt: new Date().toISOString(),
      source: 'trading_api',
      imageUrls: [],
      compatibility: null,
      description: null,
      itemSpecifics: {},
    };
  }
}
