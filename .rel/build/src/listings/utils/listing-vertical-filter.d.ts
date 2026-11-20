export declare const LISTING_VERTICALS: readonly ["automotive", "fashion", "business_industrial"];
export declare function listingVerticalFilter(vertical: string | null | undefined, alias?: string): {
    sql: string;
    params: Record<string, string>;
} | null;
