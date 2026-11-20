import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Store } from '../entities/store.entity.js';
import { EbayMarketplaceConfigService } from '../../integrations/ebay/services/ebay-marketplace-config.service.js';
import { EbayAuthService } from './ebay-auth.service.js';
import type { EbayInventoryItem, EbayInventoryItemPage, EbayInventoryItemGroup, EbayOffer, EbayOfferResponse, EbayPublishResponse, EbayBulkResponse, EbayPriceQuantityUpdate, EbayLocation, EbayCompatibilityPayload } from './ebay-api.types.js';
export declare class EbayInventoryApiService {
    private readonly auth;
    private readonly marketplaceConfig;
    private readonly configService;
    private readonly storeRepo;
    private readonly logger;
    private readonly http;
    private readonly verifiedLocationCache;
    private readonly verifiedLocationCacheTtlMs;
    constructor(auth: EbayAuthService, marketplaceConfig: EbayMarketplaceConfigService, configService: ConfigService, storeRepo: Repository<Store>);
    private authHeaders;
    createOrReplaceItem(storeId: string, sku: string, item: EbayInventoryItem): Promise<void>;
    createOrReplaceInventoryItemGroup(storeId: string, inventoryItemGroupKey: string, group: EbayInventoryItemGroup): Promise<void>;
    getInventoryItemGroup(storeId: string, inventoryItemGroupKey: string): Promise<EbayInventoryItemGroup>;
    deleteInventoryItemGroup(storeId: string, inventoryItemGroupKey: string): Promise<void>;
    getItem(storeId: string, sku: string): Promise<EbayInventoryItem>;
    getItems(storeId: string, limit?: number, offset?: number): Promise<EbayInventoryItemPage>;
    withdrawOffer(storeId: string, offerId: string): Promise<void>;
    deleteOffer(storeId: string, offerId: string): Promise<void>;
    deleteItem(storeId: string, sku: string): Promise<void>;
    bulkUpdatePriceQuantity(storeId: string, updates: EbayPriceQuantityUpdate[]): Promise<EbayBulkResponse>;
    createOffer(storeId: string, offer: EbayOffer): Promise<EbayOfferResponse>;
    updateOffer(storeId: string, offerId: string, offer: Partial<EbayOffer>): Promise<void>;
    getOffer(storeId: string, offerId: string): Promise<EbayOffer>;
    getOffersBySku(storeId: string, sku: string, limit?: number, offset?: number): Promise<{
        offers: EbayOffer[];
        total: number;
    }>;
    getOffers(storeId: string, params?: {
        sku?: string;
        marketplaceId?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        offers: EbayOffer[];
        total: number;
    }>;
    publishOffer(storeId: string, offerId: string): Promise<EbayPublishResponse>;
    publishOfferByInventoryItemGroup(storeId: string, inventoryItemGroupKey: string): Promise<EbayPublishResponse>;
    withdrawOfferByInventoryItemGroup(storeId: string, inventoryItemGroupKey: string): Promise<void>;
    setCompatibility(storeId: string, sku: string, payload: EbayCompatibilityPayload): Promise<void>;
    getCompatibility(storeId: string, sku: string): Promise<EbayCompatibilityPayload>;
    deleteCompatibility(storeId: string, sku: string): Promise<void>;
    createLocation(storeId: string, merchantLocationKey: string, location: Omit<EbayLocation, 'merchantLocationKey'>): Promise<void>;
    getLocation(storeId: string, merchantLocationKey: string): Promise<EbayLocation | null>;
    getLocations(storeId: string, limit?: number, offset?: number): Promise<{
        locations: EbayLocation[];
        total: number;
    }>;
    ensureMerchantLocation(storeId: string, preferredKey?: string | null): Promise<string | null>;
    private rememberVerifiedLocation;
}
