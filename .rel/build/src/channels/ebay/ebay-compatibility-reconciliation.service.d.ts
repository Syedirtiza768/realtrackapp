import type { EbayCompatibilityPayload, EbayCompatibleProduct, EbayInventoryItem, EbayOffer } from './ebay-api.types.js';
import { EbayInventoryApiService } from './ebay-inventory-api.service.js';
import { EbayTradingApiService } from './ebay-trading-api.service.js';
import { EbayAuthService } from './ebay-auth.service.js';
import { EbaySellAccountApiService } from '../../integrations/ebay/services/ebay-sell-account-api.service.js';
export interface EbayFreshOfferRecovery {
    sku: string;
    offerId: string;
    listingId: string;
}
export interface EbayFreshOfferCanonicalSource {
    item: EbayInventoryItem;
    offer?: Partial<EbayOffer>;
}
export declare class EbayCompatibilityReconciliationService {
    private readonly inventoryApi;
    private readonly tradingApi;
    private readonly auth?;
    private readonly sellAccount?;
    private readonly logger;
    constructor(inventoryApi: EbayInventoryApiService, tradingApi: EbayTradingApiService, auth?: EbayAuthService | undefined, sellAccount?: EbaySellAccountApiService | undefined);
    emptyPayload(): EbayCompatibilityPayload;
    normalize(payload?: EbayCompatibilityPayload | null): EbayCompatibilityPayload;
    rowKey(row: EbayCompatibleProduct): string;
    assertExactRows(sku: string, expected: EbayCompatibilityPayload, actual: EbayCompatibilityPayload | null | undefined, source: string): void;
    syncInventory(storeId: string, sku: string, payload?: EbayCompatibilityPayload | null): Promise<EbayCompatibilityPayload>;
    refreshPublishedOffer(storeId: string, offerId: string, sku: string, payload?: EbayCompatibilityPayload | null): Promise<string | null>;
    recreatePublishedOffer(storeId: string, offerId: string, sku: string, payload?: EbayCompatibilityPayload | null, canonicalSource?: EbayFreshOfferCanonicalSource): Promise<string>;
    recreatePublishedOfferWithFreshSku(storeId: string, offerId: string, sku: string, payload?: EbayCompatibilityPayload | null, canonicalSource?: EbayFreshOfferCanonicalSource, replacementSku?: string): Promise<EbayFreshOfferRecovery>;
    private verifyFreshProjection;
    verifyLiveListing(storeId: string, itemId: string, marketplaceId: string | null | undefined, sku: string, payload?: EbayCompatibilityPayload | null): Promise<void>;
    syncLiveListing(storeId: string, itemId: string, marketplaceId: string | null | undefined, sku: string, payload?: EbayCompatibilityPayload | null): Promise<void>;
    private sameRows;
    private inventoryItemPayloadForWrite;
    private assertFreshSkuAvailable;
    private freshInventorySku;
    private neutralizeCatalogIdentifiers;
    private resolveCurrentListingPolicies;
    private isNotFound;
}
