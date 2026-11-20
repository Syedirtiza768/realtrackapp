export interface ScrapedListingPage {
    title: string | null;
    imageUrls: string[];
    descriptionHtml: string | null;
    descriptionText: string | null;
    itemSpecifics: Record<string, string[]>;
    compatibility: {
        compatibleProducts: Array<{
            compatibilityProperties: Array<{
                name: string;
                value: string;
            }>;
            notes?: string;
        }>;
    } | null;
    sources: string[];
}
export declare function extractEbayImageUrlsFromHtml(html: string): string[];
export declare function extractItemSpecificsFromHtml(html: string): Record<string, string[]>;
export declare function extractCompatibilityFromHtml(html: string): ScrapedListingPage['compatibility'];
export declare function parseEbayListingPageHtml(html: string): ScrapedListingPage;
export declare function isNonEnglishEbayListingHost(url?: string | null): boolean;
export declare function buildPublicEbayItemUrl(ebayItemId: string, listingUrl?: string | null, options?: {
    preferEnglishSite?: boolean;
}): string;
