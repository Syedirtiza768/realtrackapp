import { EbayAuthService } from './ebay-auth.service.js';
import type { EbayCompatibilityPayload } from './ebay-api.types.js';
export interface TradingPublishInput {
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
    location: string;
    country: string;
    postalCode?: string | null;
    conditionDescription?: string | null;
    paymentProfileId?: string | null;
    shippingProfileId?: string | null;
    returnProfileId?: string | null;
}
export declare class EbayTradingPublishService {
    private readonly auth;
    private readonly http;
    constructor(auth: EbayAuthService);
    private post;
    addFixedPriceItem(storeId: string, input: TradingPublishInput, marketplaceId: string): Promise<{
        itemId: string;
    }>;
}
