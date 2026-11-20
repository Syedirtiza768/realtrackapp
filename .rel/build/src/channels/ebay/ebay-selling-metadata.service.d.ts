import { EbayAuthService } from './ebay-auth.service.js';
export type EbayCategoryPolicies = {
    supportedConditions: string[];
    supportsVariations: boolean | null;
};
export declare class EbaySellingMetadataService {
    private readonly auth;
    constructor(auth: EbayAuthService);
    getCategoryPolicies(storeId: string, marketplaceId: string, categoryId: string): Promise<EbayCategoryPolicies>;
}
