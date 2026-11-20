import type { EbayMarketplaceConfig } from './ebay-marketplace-config.types.js';
export declare class EbayMarketplaceConfigService {
    private readonly configs;
    all(): EbayMarketplaceConfig[];
    get(marketplaceId: string): EbayMarketplaceConfig | null;
    require(marketplaceId: string): EbayMarketplaceConfig;
}
