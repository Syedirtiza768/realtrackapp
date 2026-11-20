export declare class EbayOAuthStartDto {
    organizationId?: string;
    internalStoreId?: string;
    marketplaceId: string;
    environment: 'sandbox' | 'production';
    accountDisplayName?: string;
}
export declare class EbayPublishTargetDto {
    ebayAccountId: string;
    marketplaceId: string;
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
    merchantLocationKey?: string;
    requestedFulfillmentPolicyName?: string;
    requestedPaymentPolicyName?: string;
    requestedReturnPolicyName?: string;
}
export declare class EbayPublishJobDto {
    organizationId?: string;
    catalogProductId: string;
    requestedByUserId?: string;
    targets: EbayPublishTargetDto[];
    idempotencyKey?: string;
}
export declare class EbayBulkPublishJobDto {
    organizationId?: string;
    listingIds: string[];
    storeIds: string[];
    storePolicies?: EbayBulkPublishStorePolicyDto[];
    requestedFulfillmentPolicyName?: string;
    requestedPaymentPolicyName?: string;
    requestedReturnPolicyName?: string;
    idempotencyKey?: string;
}
export declare class EbayBulkPublishStorePolicyDto {
    storeId: string;
    marketplaceId?: string;
    requestedFulfillmentPolicyName?: string;
    requestedPaymentPolicyName?: string;
    requestedReturnPolicyName?: string;
}
export declare class EbayReconnectBodyDto {
    marketplaceId?: string;
    environment?: 'sandbox' | 'production';
    accountDisplayName?: string;
    internalStoreId?: string;
}
export declare class EbayValidateDto {
    organizationId?: string;
    catalogProductId: string;
    targets: EbayPublishTargetDto[];
}
export declare class EbayDefaultPoliciesPatchDto {
    marketplaceId: string;
    defaultPaymentPolicyId?: string | null;
    defaultReturnPolicyId?: string | null;
    defaultFulfillmentPolicyId?: string | null;
    defaultInventoryLocationKey?: string | null;
}
