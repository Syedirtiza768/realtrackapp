import { Repository } from 'typeorm';
import { EbayBrowseApiService } from '../../channels/ebay/ebay-browse-api.service.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import { PublishedListingsHealthService } from './published-listings-health.service.js';
export interface CompetitorPricingSnapshot {
    searchQuery: string;
    sampleCount: number;
    avgPrice: number | null;
    medianPrice: number | null;
    minPrice: number | null;
    maxPrice: number | null;
    fetchedAt: string;
    topCompetitors: Array<{
        itemId: string | null;
        title: string | null;
        price: number | null;
        condition: string | null;
    }>;
}
export declare class PublishedListingsPricingService {
    private readonly listingRepo;
    private readonly accountRepo;
    private readonly browseApi;
    private readonly health;
    private readonly logger;
    constructor(listingRepo: Repository<EbayPublishedListing>, accountRepo: Repository<ConnectedEbayAccount>, browseApi: EbayBrowseApiService, health: PublishedListingsHealthService);
    buildSearchQuery(listing: EbayPublishedListing): string | null;
    refreshCompetitorPricing(listingId: string, organizationId: string): Promise<EbayPublishedListing>;
    refreshForAccount(organizationId: string, ebayAccountId: string, limit?: number): Promise<{
        processed: number;
        updated: number;
        skipped: number;
    }>;
    refreshForOrganization(organizationId: string, limitPerAccount?: number): Promise<{
        accounts: number;
        updated: number;
        skipped: number;
    }>;
}
