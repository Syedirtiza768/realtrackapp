export type EbayPolicyKind = 'fulfillment' | 'payment' | 'return';
export declare function isLikelyEbayRestPolicyId(id: string | null | undefined): boolean;
export declare function extractEbayRestPolicyId(raw: Record<string, unknown>, kind: EbayPolicyKind): string | null;
export declare function readPolicyGeoSite(raw: Record<string, unknown>): string | null;
export declare function geoSitePreferenceForMarketplace(marketplaceId: string): string[];
export declare function policyMatchesMarketplaceGeo(policyGeoSite: string | null | undefined, marketplaceId: string): boolean;
export interface PolicyPickCandidate {
    ebayPolicyId: string;
    isDefault: boolean;
    geoSite: string | null;
    rawPayload?: Record<string, unknown>;
}
export interface ReturnPolicyPickCandidate extends PolicyPickCandidate {
    rawPayload?: Record<string, unknown>;
}
export declare function partsAccessoriesReturnPolicyGuidance(): string;
export type ReturnPolicyStateSummary = {
    days: number | null;
    payer: string | null;
    returnsAccepted: boolean;
    paCompliant: boolean;
    evaluable: boolean;
};
export declare function summarizeReturnPolicyState(raw: Record<string, unknown> | null | undefined): ReturnPolicyStateSummary;
export declare function paReturnPolicyBlockedMessage(params: {
    returnPolicyId: string;
    raw?: Record<string, unknown> | null;
    storeName?: string;
    marketplaceId?: string;
    condition?: string | null;
    accountApiUnavailable?: boolean;
}): string;
export declare function marketplaceRequiresPartsAccessoriesReturnPolicy(marketplaceId: string, categoryId?: string | null): boolean;
export declare function conditionRequiresMandatoryPaFreeReturn(condition: string | null | undefined): boolean;
export declare function listingRequiresPartsAccessoriesReturnPolicy(marketplaceId: string, categoryId?: string | null, condition?: string | null): boolean;
export declare function canEvaluateReturnPolicyCompliance(raw: Record<string, unknown> | null | undefined): boolean;
export declare function isPartsAccessoriesCompliantReturnPolicy(raw: Record<string, unknown> | null | undefined): boolean;
export declare function pickReturnPolicyUpgradeCandidate(items: ReturnPolicyPickCandidate[], marketplaceId: string, preferredPolicyId?: string | null): ReturnPolicyPickCandidate | null;
export declare function buildPaCompliantReturnPolicyRequest(marketplaceId: string, template?: Record<string, unknown> | null): Record<string, unknown>;
export declare function pickReturnPolicyIdForListing(items: ReturnPolicyPickCandidate[], marketplaceId: string, categoryId?: string | null, condition?: string | null): string | null;
export declare function pickPolicyIdForMarketplace(items: PolicyPickCandidate[], marketplaceId: string): string | null;
export declare function coalesceValidPolicyId(...candidates: Array<string | null | undefined>): string | undefined;
export declare function hasValidDefaultPolicyIds(row: {
    defaultFulfillmentPolicyId?: string | null;
    defaultPaymentPolicyId?: string | null;
    defaultReturnPolicyId?: string | null;
} | null | undefined): boolean;
