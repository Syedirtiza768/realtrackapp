import { EbayAuthService } from './ebay-auth.service.js';
import type { EbaySearchResult, EbayItemSummary, EbayItem, EbayCatalogLookupResult } from './ebay-api.types.js';
export declare class EbayBrowseApiService {
    private readonly auth;
    private readonly logger;
    private readonly http;
    private readonly rateLimiter;
    constructor(auth: EbayAuthService);
    private withRateLimitRetry;
    private appHeaders;
    search(options: {
        q?: string;
        categoryIds?: string;
        filter?: string;
        sort?: string;
        limit?: number;
        offset?: number;
        aspectFilter?: string;
        seller?: string;
        marketplaceId?: string | null;
        retryOnRateLimit?: boolean;
    }): Promise<EbaySearchResult>;
    getItem(itemId: string, marketplaceId?: string | null, retryOnRateLimit?: boolean): Promise<EbayItem>;
    getItemByLegacyId(legacyItemId: string, marketplaceId?: string | null): Promise<EbayItem>;
    searchSellerListings(options: {
        seller: string;
        marketplaceId?: string | null;
        country?: string;
        categoryIds?: string;
        limit?: number;
        offset?: number;
    }): Promise<EbaySearchResult>;
    getCompetitorPricing(partNumber: string, condition?: 'NEW' | 'USED', limit?: number): Promise<{
        items: EbayItemSummary[];
        total: number;
        avgPrice: number | null;
        medianPrice: number | null;
        minPrice: number | null;
        maxPrice: number | null;
    }>;
    searchByMpn(brand: string, mpn: string, options?: {
        categoryIds?: string;
        limit?: number;
        marketplaceId?: string | null;
        retryOnRateLimit?: boolean;
    }): Promise<EbayCatalogLookupResult>;
    private extractFitmentFromAspects;
    private aspectValues;
    private firstAspectValue;
    private normalizeAspectName;
    private parseVehicleString;
}
