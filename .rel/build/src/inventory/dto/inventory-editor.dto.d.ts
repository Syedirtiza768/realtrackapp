export interface EditorListingInfo {
    id: string;
    sku: string;
    title: string | null;
    brand: string | null;
    partType: string | null;
    mpn: string | null;
    oemNumber: string | null;
    categoryId: string | null;
    categoryName: string | null;
    imageUrls: string[];
    fitmentCount: number;
    status: string;
}
export interface MarketplaceVersion {
    marketplace: 'US' | 'AU' | 'DE';
    title: string;
    description: string;
    price: number | null;
    quantity: number | null;
    conditionId: string;
    conditionDescription: string | null;
    itemSpecifics: Record<string, string>;
    fitmentSummary: string | null;
    seoScore: number | null;
    readinessScore: number | null;
}
export interface PolicyOption {
    id: string;
    ebayPolicyId: string;
    name: string;
    policyType: 'payment' | 'return' | 'fulfillment';
    marketplaceId: string;
}
export interface StoreWithPolicies {
    id: string;
    name: string;
    ebayAccountId: string;
    ebayUserId: string;
    marketplaces: Array<{
        marketplaceId: string;
        label: string;
        defaultPaymentPolicyId: string | null;
        defaultReturnPolicyId: string | null;
        defaultFulfillmentPolicyId: string | null;
        defaultInventoryLocationKey: string | null;
        policies: {
            payment: PolicyOption[];
            return: PolicyOption[];
            fulfillment: PolicyOption[];
        };
    }>;
}
export interface EditorResponse {
    listing: EditorListingInfo;
    marketplaceVersions: MarketplaceVersion[];
    stores: StoreWithPolicies[];
}
export declare class SaveMarketplaceVersionDto {
    marketplace: 'US' | 'AU' | 'DE';
    title: string;
    description: string;
    price?: number | null;
    quantity?: number | null;
    conditionId: string;
    conditionDescription?: string | null;
    itemSpecifics?: Record<string, string>;
}
export declare class SaveEditorDto {
    marketplaceVersions: SaveMarketplaceVersionDto[];
}
export declare class PublishPolicyOverridesDto {
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
    merchantLocationKey?: string;
}
export declare class PublishTargetDto {
    storeId: string;
    marketplaceId: string;
    policyOverrides?: PublishPolicyOverridesDto;
}
export declare class PublishListingDto {
    targets: PublishTargetDto[];
}
