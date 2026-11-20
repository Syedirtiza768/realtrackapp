import { User } from '../auth/entities/user.entity.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { EbayIntegrationPermissionsService } from '../integrations/ebay/services/ebay-integration-permissions.service.js';
import { PublishedListingsService } from './services/published-listings.service.js';
import { PublishedListingsQueryDto } from './dto/published-listings.dto.js';
export declare class StorePublishedListingsController {
    private readonly listings;
    private readonly storeAccess;
    private readonly permissions;
    constructor(listings: PublishedListingsService, storeAccess: StoreAccessService, permissions: EbayIntegrationPermissionsService);
    listForStore(storeId: string, query: PublishedListingsQueryDto, user: User): Promise<{
        items: Array<import("./entities/ebay-published-listing.entity.js").EbayPublishedListing | import("./published-listings-response.util.js").PublishedListingApiResponse>;
        total: number;
        page: number;
        limit: number;
        nextId?: string;
        hasMore?: boolean;
    }>;
    getForStore(storeId: string, id: string, organizationId: string | undefined, user: User): Promise<import("./published-listings-response.util.js").PublishedListingApiResponse>;
}
