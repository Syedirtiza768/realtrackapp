import { type ScrapedListingPage } from './ebay-listing-page-scrape.util.js';
export declare class EbayListingPageScrapeService {
    private readonly logger;
    private tokens;
    private lastRefill;
    private readonly maxTokens;
    private readonly refillPerMs;
    constructor();
    isEnabled(): boolean;
    private acquire;
    scrapeListingPage(input: {
        ebayItemId: string;
        listingUrl?: string | null;
    }): Promise<ScrapedListingPage | null>;
}
