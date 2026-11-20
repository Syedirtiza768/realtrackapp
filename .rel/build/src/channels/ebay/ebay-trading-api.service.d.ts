import { EbayAuthService } from './ebay-auth.service.js';
import { type TradingItemDetails } from './ebay-trading-get-item.util.js';
import type { EbayCompatibilityPayload } from './ebay-api.types.js';
export interface TradingSellerListItem {
    itemId: string;
    title: string;
    sku: string | null;
    quantityAvailable: number;
    quantitySold: number;
    price: number | null;
    currency: string;
    listingStatus: string;
    listingFormat: string;
    condition: string | null;
    categoryId: string | null;
    imageUrl: string | null;
    imageUrls: string[];
    viewCount: number | null;
    watchCount: number | null;
    startTime: string | null;
    endTime: string | null;
    listingUrl: string | null;
}
export interface TradingFixedPriceItemInput {
    title: string;
    description: string;
    categoryId: string;
    conditionId: number;
    quantity: number;
    price: number;
    currency: string;
    sku: string;
    imageUrls: string[];
    itemSpecifics?: Record<string, string[]>;
    compatibility?: EbayCompatibilityPayload | null;
    listingDuration?: string;
    location?: string | null;
    country?: string | null;
    postalCode?: string | null;
    conditionDescription?: string | null;
    paymentProfileId?: string | null;
    shippingProfileId?: string | null;
    returnProfileId?: string | null;
    immediatePayRequired?: boolean | null;
    bestOfferEnabled?: boolean | null;
}
export interface TradingBatchAddResult {
    messageId: string;
    success: boolean;
    itemId?: string;
    errorCode?: string;
    error?: string;
}
export interface TradingFixedPriceRevisionInput {
    title?: string;
    description?: string;
    categoryId?: string;
    quantity?: number;
    price?: number;
    currency?: string;
    imageUrls?: string[];
    itemSpecifics?: Record<string, string[]>;
    compatibility?: EbayCompatibilityPayload | null;
}
export declare class EbayTradingApiService {
    private readonly auth;
    private readonly logger;
    private readonly http;
    constructor(auth: EbayAuthService);
    private tradingUrl;
    private resolveSiteId;
    private formatTradingDate;
    private postTradingRequest;
    getMyeBaySellingActiveList(storeId: string, options?: {
        page?: number;
        entriesPerPage?: number;
        marketplaceId?: string | null;
    }): Promise<{
        items: TradingSellerListItem[];
        totalPages: number;
        page: number;
        hasMore: boolean;
    }>;
    getSellerList(storeId: string, options?: {
        page?: number;
        entriesPerPage?: number;
        marketplaceId?: string | null;
        modifiedSince?: Date;
    }): Promise<{
        items: TradingSellerListItem[];
        totalPages: number;
        page: number;
        hasMore: boolean;
    }>;
    getItemDetails(storeId: string, itemId: string, marketplaceId?: string | null): Promise<TradingItemDetails>;
    addFixedPriceItem(storeId: string, input: TradingFixedPriceItemInput, marketplaceId?: string | null): Promise<{
        itemId: string;
    }>;
    addFixedPriceItems(storeId: string, inputs: TradingFixedPriceItemInput[], marketplaceId?: string | null): Promise<TradingBatchAddResult[]>;
    reviseFixedPriceItem(storeId: string, itemId: string, input: TradingFixedPriceRevisionInput, marketplaceId?: string | null): Promise<void>;
    relistFixedPriceItem(storeId: string, itemId: string, marketplaceId?: string | null): Promise<{
        itemId: string;
    }>;
    endFixedPriceItem(storeId: string, itemId: string, marketplaceId?: string | null): Promise<void>;
    replaceListingImages(storeId: string, itemId: string, imageUrl: string, marketplaceId?: string | null): Promise<void>;
    replaceItemCompatibility(storeId: string, itemId: string, payload: EbayCompatibilityPayload, marketplaceId?: string | null, listingDetails?: {
        bestOfferEnabled?: boolean | null;
        immediatePayRequired?: boolean | null;
    }): Promise<void>;
    getAllActiveListings(storeId: string, marketplaceId?: string | null): Promise<TradingSellerListItem[]>;
    getAllSellerListListings(storeId: string, marketplaceId?: string | null, modifiedSince?: Date): Promise<TradingSellerListItem[]>;
    getAllLiveListings(storeId: string, marketplaceId?: string | null, modifiedSince?: Date): Promise<TradingSellerListItem[]>;
}
