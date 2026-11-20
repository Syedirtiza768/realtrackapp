import type { BulkJobAction } from '../entities/ebay-published-listing-bulk-job.entity.js';
export declare class PublishedListingsQueryDto {
    afterId?: string;
    afterSequence?: string;
    throughSequence?: string;
    organizationId?: string;
    ebayAccountId?: string;
    storeId?: string;
    storeSlug?: string;
    offerId?: string;
    marketplaceId?: string;
    status?: string;
    format?: string;
    condition?: string;
    categoryId?: string;
    priceMin?: number;
    priceMax?: number;
    quantityMin?: number;
    quantityMax?: number;
    soldMin?: number;
    listedFrom?: string;
    listedTo?: string;
    updatedAfter?: string;
    updateAfter?: string;
    lowStock?: string;
    search?: string;
    includeCatalogData?: 'true' | 'false';
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page?: number;
    limit?: number;
}
export declare class PrimemotiveSaleWebhookDto {
    eventType: 'listing.sold';
    eventId: string;
    listingId: string;
    soldAt: string;
    quantity: number;
    externalOrderId?: string;
    unitPrice?: number;
    currency?: string;
}
export declare class SyncPublishedListingsDto {
    organizationId?: string;
    ebayAccountId?: string;
    marketplaceId?: string;
    syncMode?: 'full' | 'delta';
}
export declare class RevisePublishedListingDto {
    title?: string;
    description?: string;
    price?: number;
    quantity?: number;
    imageUrls?: string[];
    itemSpecifics?: Record<string, string[]>;
}
export declare class UpdatePoliciesDto {
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
    shippingProfileName?: string;
    returnProfileName?: string;
    paymentProfileName?: string;
}
export declare class BulkPublishedListingsDto {
    organizationId?: string;
    listingIds: string[];
    action: BulkJobAction;
    payload?: Record<string, unknown>;
}
export declare class BulkPriceUpdatePayload {
    mode?: 'set' | 'increase_percent' | 'decrease_percent' | 'increase_amount' | 'decrease_amount';
    value: number;
}
