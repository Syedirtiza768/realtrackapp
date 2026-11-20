export declare const EBAY_ASPECT_VALUE_MAX_LENGTH = 65;
export declare function truncateEbayAspectValue(value: string, maxLength?: number): string;
export declare function sanitizeListingAspects(aspects: Record<string, string[]>): Record<string, string[]>;
export declare function localizeAspectName(name: string, marketplaceId: string): string;
export declare function localizeAspectsForMarketplace(aspects: Record<string, string[]>, marketplaceId: string): Record<string, string[]>;
export declare function buildListingAspects(input: {
    brand?: string | null;
    mpn?: string | null;
    partType?: string | null;
    upc?: string | null;
    oeOemPartNumber?: string | null;
    existing?: Record<string, string[]>;
}): Record<string, string[]>;
export declare function isUsedEbayCondition(condition: string | null | undefined): boolean;
