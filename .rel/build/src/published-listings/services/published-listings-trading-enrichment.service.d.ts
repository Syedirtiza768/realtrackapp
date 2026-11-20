import { Repository } from 'typeorm';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import { EbayTradingApiService } from '../../channels/ebay/ebay-trading-api.service.js';
export interface CachedTradingEnrichment {
    enrichedAt: string;
    source: 'trading_api';
    imageUrls: string[];
    compatibility: Record<string, unknown> | null;
    description: string | null;
    itemSpecifics: Record<string, string[]>;
}
export declare class PublishedListingsTradingEnrichmentService {
    private readonly listingRepo;
    private readonly tradingApi;
    private readonly logger;
    private dailyCallCount;
    private dailyResetDate;
    constructor(listingRepo: Repository<EbayPublishedListing>, tradingApi: EbayTradingApiService);
    private checkBudget;
    private incrementBudget;
    getBudgetStatus(): {
        used: number;
        remaining: number;
        limit: number;
        resetDate: string;
    };
    enrich(listing: EbayPublishedListing, options?: {
        force?: boolean;
    }): Promise<{
        data: CachedTradingEnrichment;
        cached: boolean;
        budget: ReturnType<typeof this.getBudgetStatus>;
    }>;
    preEnrichBatch(listings: EbayPublishedListing[], options?: {
        force?: boolean;
    }): Promise<{
        enriched: number;
        skipped: number;
        failed: number;
    }>;
    private readCache;
    private persistCache;
    private emptyResult;
}
