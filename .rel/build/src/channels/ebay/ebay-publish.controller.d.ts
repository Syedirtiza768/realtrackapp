import { EbayPublishService, type PublishResult } from './ebay-publish.service.js';
declare class PublishDto {
    listingId: string;
    storeIds: string[];
    sku: string;
    title: string;
    description: string;
    categoryId: string;
    condition: string;
    conditionDescription?: string;
    price: number;
    currency?: string;
    quantity: number;
    imageUrls: string[];
    aspects: Record<string, string[]>;
    compatibility?: unknown;
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
    merchantLocationKey?: string;
    listingFormat?: 'FIXED_PRICE' | 'AUCTION';
    listingDuration?: string;
    requestedFulfillmentPolicyName?: string;
    requestedReturnPolicyName?: string;
    requestedPaymentPolicyName?: string;
}
declare class PublishOfferDto {
    offerId: string;
    price: number;
    quantity: number;
    currency?: string;
}
declare class BulkPublishDto {
    items: PublishDto[];
}
declare class PublishByListingIdsDto {
    listingIds: string[];
    storeIds: string[];
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
    shippingProfileName?: string;
    returnProfileName?: string;
    paymentProfileName?: string;
}
declare class UpdatePriceQuantityDto {
    storeId: string;
    offers: PublishOfferDto[];
}
declare class EndListingDto {
    storeId: string;
}
export declare class EbayPublishController {
    private readonly publishService;
    constructor(publishService: EbayPublishService);
    publish(dto: PublishDto): Promise<PublishResult[]>;
    publishBatch(dto: BulkPublishDto): Promise<{
        listingId: string;
        results: PublishResult[];
    }[]>;
    publishByListingIds(dto: PublishByListingIdsDto): Promise<{
        listingId: string;
        results: PublishResult[];
    }[]>;
    updatePriceQuantity(dto: UpdatePriceQuantityDto): Promise<import("./ebay-api.types.js").EbayBulkResponse>;
    endListing(offerId: string, dto: EndListingDto): Promise<void>;
}
export {};
