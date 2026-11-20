export declare const EBAY_TITLE_MAX_LENGTH = 80;
export declare const EBAY_OFFER_DESCRIPTION_MAX_LENGTH = 4000;
export declare const EBAY_DESCRIPTION_MAX_LENGTH = 4000;
export declare const EBAY_TITLE_STRUCTURE_PATTERN: RegExp;
export declare const EBAY_TITLE_PART_NUMBER_PATTERN: RegExp;
export declare function matchesStrictEbayTitleStructure(title: string): boolean;
export interface EbayTitleSource {
    title?: string | null;
    titleOverride?: string | null;
    brand?: string | null;
    partType?: string | null;
    mpn?: string | null;
    sku?: string | null;
    yearRange?: string | null;
    make?: string | null;
    model?: string | null;
    generation?: string | null;
    position?: string | null;
    partName?: string | null;
    oemPartNumber?: string | null;
}
export interface EbayStructuredTitleInput {
    yearRange?: string | null;
    make?: string | null;
    model?: string | null;
    generation?: string | null;
    position?: string | null;
    partName?: string | null;
    oemPartNumber?: string | null;
}
export interface EbayTitleResult {
    title: string;
    warnings: string[];
}
export interface EbayDescriptionSource {
    description?: string | null;
    title?: string | null;
    brand?: string | null;
    mpn?: string | null;
    sku?: string | null;
    partType?: string | null;
}
export interface EbayDescriptionResult {
    description: string;
    warnings: string[];
}
export declare function normalizeListingText(value: string): string;
export declare function truncateEbayTitle(title: string, maxLength?: number): string;
export declare function stripPartNameNoise(raw: string, position?: string | null): string;
export declare function buildStructuredEbayTitle(input: EbayStructuredTitleInput, maxLength?: number): string;
export declare function buildEbayListingTitle(source: EbayTitleSource): EbayTitleResult;
export declare function stripListingHtmlBoilerplate(html: string): string;
export declare function truncateEbayDescription(description: string, maxLength?: number): string;
export declare function buildEbayListingDescription(source: EbayDescriptionSource): EbayDescriptionResult;
export declare function sanitizeEbayDescription(description?: string | null, source?: Omit<EbayDescriptionSource, 'description'>): string;
export declare function sanitizePublishListingText(req: {
    title: string;
    description: string;
    sku?: string | null;
    brand?: string | null;
    mpn?: string | null;
    partType?: string | null;
    yearRange?: string | null;
    make?: string | null;
    model?: string | null;
    generation?: string | null;
    position?: string | null;
    partName?: string | null;
    oemPartNumber?: string | null;
}): {
    title: string;
    description: string;
    warnings: string[];
};
