import { ConfigService } from '@nestjs/config';
import { EbayAuthService } from './ebay-auth.service.js';
import { EbayTaxonomyCacheService } from './ebay-taxonomy-cache.service.js';
import type { EbayCategoryTree, EbayCategorySubtree, EbayCategorySuggestion, EbayAspect, EbayCompatibilityProperty } from './ebay-api.types.js';
export declare class EbayTaxonomyApiService {
    private readonly auth;
    private readonly config;
    private readonly taxonomyCache;
    private readonly logger;
    private readonly http;
    private readonly rateLimiter;
    private consecutiveRateLimitExhaustions;
    private circuitOpenUntil;
    private static readonly CIRCUIT_TRIP_THRESHOLD;
    private static readonly CIRCUIT_COOLDOWN_MS;
    static readonly EBAY_US_TREE_ID = "0";
    static readonly EBAY_MOTORS_TREE_ID = "100";
    static readonly EBAY_US_MARKETPLACE = "EBAY_US";
    constructor(auth: EbayAuthService, config: ConfigService, taxonomyCache: EbayTaxonomyCacheService);
    private appHeaders;
    private withRateLimitRetry;
    getDefaultCategoryTreeId(marketplace?: string): Promise<string>;
    getCategoryTree(treeId?: string): Promise<EbayCategoryTree>;
    getCategorySubtree(categoryId: string, treeId?: string): Promise<EbayCategorySubtree>;
    getCategorySuggestions(query: string, treeId?: string): Promise<EbayCategorySuggestion[]>;
    getItemAspectsForCategory(categoryId: string, treeId?: string): Promise<EbayAspect[]>;
    getCompatibilityProperties(categoryTreeId: string, categoryId: string): Promise<EbayCompatibilityProperty[]>;
    getCompatibilityPropertyValues(categoryTreeId: string, categoryId: string, compatibilityPropertyName: string, filter?: Record<string, string>): Promise<{
        value: string;
        applicableProperties?: Record<string, string>;
    }[]>;
    getVehicleValues(level: 'Year' | 'Make' | 'Model' | 'Trim' | 'Engine', categoryId: string, parentSelections?: Record<string, string>, treeId?: string): Promise<string[]>;
}
