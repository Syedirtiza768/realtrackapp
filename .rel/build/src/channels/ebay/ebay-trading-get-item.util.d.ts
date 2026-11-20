import type { EbayCompatibilityPayload } from './ebay-api.types.js';
export interface TradingItemDetails {
    itemId: string | null;
    sku: string | null;
    title: string | null;
    categoryId: string | null;
    conditionId: number | null;
    quantity: number | null;
    quantitySold: number | null;
    price: number | null;
    currency: string | null;
    listingType: string | null;
    listingStatus: string | null;
    listingDuration: string | null;
    inventoryTrackingMethod: string | null;
    location: string | null;
    country: string | null;
    postalCode: string | null;
    conditionDescription: string | null;
    paymentProfileId: string | null;
    shippingProfileId: string | null;
    returnProfileId: string | null;
    listingUrl: string | null;
    startTime: string | null;
    endTime: string | null;
    imageUrls: string[];
    compatibility: EbayCompatibilityPayload | null;
    listingDetails: {
        bestOfferEnabled: boolean | null;
        immediatePayRequired: boolean | null;
    };
    description: string | null;
    itemSpecifics: Record<string, string[]>;
}
export declare function parsePictureUrls(itemBlock: string): string[];
export declare function parseTradingItemCompatibility(itemBlock: string): EbayCompatibilityPayload | null;
export declare function parseTradingItemSpecifics(itemBlock: string): Record<string, string[]>;
export declare function parseTradingGetItemResponse(xml: string): TradingItemDetails;
