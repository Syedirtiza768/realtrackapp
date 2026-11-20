import { EbayBrowseApiService } from '../../channels/ebay/ebay-browse-api.service.js';
import { EbayInventoryApiService } from '../../channels/ebay/ebay-inventory-api.service.js';
import { EbayTradingApiService } from '../../channels/ebay/ebay-trading-api.service.js';
import { EbayListingPageScrapeService } from '../../channels/ebay/ebay-listing-page-scrape.service.js';
export interface ListingEnrichmentInput {
    storeId: string;
    ebayItemId: string;
    sku?: string | null;
    marketplaceId?: string | null;
    listingUrl?: string | null;
    title?: string | null;
    imageUrls?: string[];
    compatibility?: Record<string, unknown> | null;
    description?: string | null;
    itemSpecifics?: Record<string, string[]>;
    skipTrading?: boolean;
}
export interface ListingEnrichmentResult {
    title: string | null;
    listingUrl: string | null;
    imageUrls: string[];
    compatibility: Record<string, unknown> | null;
    description: string | null;
    itemSpecifics: Record<string, string[]>;
    sources: string[];
    rawGetItem?: {
        imageUrls: string[];
        description: string | null;
        itemSpecifics: Record<string, string[]>;
        compatibility: Record<string, unknown> | null;
        title?: string | null;
    };
}
export declare class PublishedListingsEnrichmentService {
    private readonly tradingApi;
    private readonly browseApi;
    private readonly inventoryApi;
    private readonly pageScrape;
    private readonly logger;
    constructor(tradingApi: EbayTradingApiService, browseApi: EbayBrowseApiService, inventoryApi: EbayInventoryApiService, pageScrape: EbayListingPageScrapeService);
    needsEnrichment(input: ListingEnrichmentInput): boolean;
    enrichListing(input: ListingEnrichmentInput): Promise<ListingEnrichmentResult>;
}
