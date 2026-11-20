export interface EbayPolicyListItem {
    ebayPolicyId: string;
    name: string;
    isDefault: boolean;
    raw: Record<string, unknown>;
}
export declare class EbaySellAccountApiService {
    private readonly logger;
    private client;
    listFulfillmentPolicies(accessToken: string, baseUrl: string, marketplaceId: string, signal?: AbortSignal): Promise<EbayPolicyListItem[]>;
    listPaymentPolicies(accessToken: string, baseUrl: string, marketplaceId: string, signal?: AbortSignal): Promise<EbayPolicyListItem[]>;
    createReturnPolicy(accessToken: string, baseUrl: string, marketplaceId: string, body: Record<string, unknown>): Promise<{
        returnPolicyId: string;
        raw: Record<string, unknown>;
    }>;
    updateReturnPolicy(accessToken: string, baseUrl: string, marketplaceId: string, returnPolicyId: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
    listReturnPolicies(accessToken: string, baseUrl: string, marketplaceId: string, signal?: AbortSignal): Promise<EbayPolicyListItem[]>;
    listInventoryLocations(accessToken: string, baseUrl: string, marketplaceId: string): Promise<{
        merchantLocationKey: string;
        name: string;
        raw: Record<string, unknown>;
    }[]>;
    private readDefaultFlag;
    private listPaged;
}
