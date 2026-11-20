import type { PublishedListingFormat, PublishedListingHealthFlag, PublishedListingStatus } from '../entities/ebay-published-listing.entity.js';
import type { EbayInventoryItem, EbayOffer } from '../../channels/ebay/ebay-api.types.js';
export declare class PublishedListingsHealthService {
    computeHealthFlags(input: {
        title: string;
        imageUrls: string[];
        itemSpecifics: Record<string, string[]>;
        compatibility: Record<string, unknown> | null;
        quantityAvailable: number;
        quantitySold: number;
        performanceMetrics: Record<string, unknown>;
        categoryId: string | null;
        price?: string | null;
        description?: string | null;
        lastSyncedAt?: Date | string | null;
        syncStaleAfterMs?: number;
        competitorPricing?: {
            medianPrice?: number | null;
            avgPrice?: number | null;
            minPrice?: number | null;
            maxPrice?: number | null;
        } | null;
    }): PublishedListingHealthFlag[];
    mapOfferStatus(offer: EbayOffer): PublishedListingStatus;
    mapOfferFormat(format?: string): PublishedListingFormat;
    buildListingUrl(listingId: string | undefined, marketplaceId: string, environment: 'sandbox' | 'production'): string | null;
    extractFromInventoryItem(item: EbayInventoryItem): {
        title: string;
        description: string | null;
        imageUrls: string[];
        itemSpecifics: Record<string, string[]>;
        condition: string | null;
        quantityAvailable: number;
    };
}
