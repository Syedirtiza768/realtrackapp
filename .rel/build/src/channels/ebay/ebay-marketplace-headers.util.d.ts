import type { EbayMarketplaceConfig } from '../../integrations/ebay/services/ebay-marketplace-config.types.js';
export declare function toContentLanguage(locale: string): string;
export declare function toEbayInventoryApiMarketplaceId(marketplaceId: string): string;
export declare function resolveMarketplaceId(store: {
    ebayMarketplaceId?: string | null;
    config?: Record<string, unknown> | null;
}): string;
export declare function marketplaceRequestHeaders(marketplaceId: string, config: EbayMarketplaceConfig | null): Record<string, string>;
