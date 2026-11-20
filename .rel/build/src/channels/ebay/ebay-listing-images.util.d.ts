export declare const EBAY_MAX_LISTING_IMAGES = 24;
export declare function parseImageUrlField(raw: string | null | undefined): string[];
export declare function flattenImageUrlInputs(urls: string[] | null | undefined): string[];
export declare function normalizePublishImageUrl(url: string): string | null;
export declare function isValidPublishImageUrl(url: string): boolean;
export interface EbayImageUrlsResult {
    imageUrls: string[];
    warnings: string[];
}
export declare function preferLargeEbayImageUrl(url: string): string;
export declare function isSingleImageBrand(brandOrTitle: string | null | undefined): boolean;
export declare function selectPrimaryImageForBrand(urls: string[] | null | undefined, brandOrTitle: string | null | undefined): string[];
export declare function preferRicherImageUrls(primary: string[] | null | undefined, secondary: string[] | null | undefined): string[];
export declare function sanitizeEbayImageUrls(urls: string[] | null | undefined, options?: {
    maxImages?: number;
}): EbayImageUrlsResult;
export declare function applyImageOrderOverride(imageUrls: string[], override: unknown): string[];
