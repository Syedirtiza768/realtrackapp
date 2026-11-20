export declare const DEFAULT_LOW_VALUE_MAX_PRICE = 50;
export type EnrichmentProfile = 'compact' | 'full';
export declare function getLowValueMaxPrice(configured?: number | string | null): number;
export declare function isLowValueSku(price?: number | string | null, lowValueMaxPrice?: number): boolean;
export declare function getEnrichmentProfile(price?: number | string | null, lowValueMaxPrice?: number): EnrichmentProfile;
export declare function compactJson(value: unknown): string;
