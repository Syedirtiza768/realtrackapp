export declare const EBAY_STORE_SLUG_ALIASES: Record<string, string[]>;
export declare const DEFAULT_PUBLISHED_LISTINGS_STORE_SLUGS = "salvagea,blackline";
export declare function resolveDefaultPublishedListingsStoreSlugs(): string;
export declare function normalizeStoreSlug(raw: string): string;
export declare function parseStoreSlugQuery(raw: string | undefined): string[];
export declare function isAllStoresSlugQuery(raw: string | undefined): boolean;
