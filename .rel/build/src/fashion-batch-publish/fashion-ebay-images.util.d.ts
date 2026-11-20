export declare const EBAY_MASTER_URLS_KEY = "_ebayMasterUrls";
export declare const EBAY_MASTER_SOURCE_URLS_KEY = "_ebayMasterSourceUrls";
export declare function fashionEbayMasterImages(product: {
    vertical?: string | null;
    imageUrls?: string[] | null;
    verticalAttributes?: Record<string, unknown> | null;
} | null): string[] | null;
export declare function ebayMasterAttributes(masterUrls: string[], sourceUrls: string[]): Record<string, string[]>;
