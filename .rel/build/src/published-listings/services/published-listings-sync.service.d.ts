import { Repository } from 'typeorm';
import type { Queue } from 'bullmq';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
import { EbayInventoryApiService } from '../../channels/ebay/ebay-inventory-api.service.js';
import { EbayTradingApiService } from '../../channels/ebay/ebay-trading-api.service.js';
import { EbayBrowseApiService } from '../../channels/ebay/ebay-browse-api.service.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import { EbayPublishedListingSyncLog } from '../entities/ebay-published-listing-sync-log.entity.js';
import { PublishedListingsHealthService } from './published-listings-health.service.js';
import { PublishedListingsEnrichmentService } from './published-listings-enrichment.service.js';
export interface PublishedListingsSyncJobPayload {
    organizationId: string;
    ebayAccountId: string;
    userId?: string | null;
    marketplaceId?: string | null;
    syncLogId: string;
    listingIds?: string[];
    trigger?: 'manual' | 'scheduled' | 'single';
    syncMode?: 'full' | 'delta';
}
export interface BrowseSellerListItem {
    itemId: string;
    v1ItemId: string;
    title: string;
    price: number | null;
    currency: string;
    listingStatus: string;
    condition: string | null;
    categoryId: string | null;
    imageUrls: string[];
    listingUrl: string | null;
}
export declare class PublishedListingsSyncService {
    private readonly accountRepo;
    private readonly listingRepo;
    private readonly syncLogRepo;
    private readonly channelRepo;
    private readonly storeRepo;
    private readonly inventoryApi;
    private readonly tradingApi;
    private readonly browseApi;
    private readonly health;
    private readonly enrichment;
    private readonly syncQueue;
    private readonly logger;
    constructor(accountRepo: Repository<ConnectedEbayAccount>, listingRepo: Repository<EbayPublishedListing>, syncLogRepo: Repository<EbayPublishedListingSyncLog>, channelRepo: Repository<EbayListingChannel>, storeRepo: Repository<Store>, inventoryApi: EbayInventoryApiService, tradingApi: EbayTradingApiService, browseApi: EbayBrowseApiService, health: PublishedListingsHealthService, enrichment: PublishedListingsEnrichmentService, syncQueue: Queue<PublishedListingsSyncJobPayload>);
    enqueueSync(input: {
        organizationId: string;
        ebayAccountId?: string;
        marketplaceId?: string | null;
        userId?: string | null;
        listingIds?: string[];
        trigger?: 'manual' | 'scheduled' | 'single';
        syncMode?: 'full' | 'delta';
    }): Promise<{
        jobIds: string[];
        syncLogIds: string[];
    }>;
    syncListingById(listingId: string, organizationId: string): Promise<EbayPublishedListing>;
    syncAccount(payload: PublishedListingsSyncJobPayload): Promise<{
        processed: number;
        created: number;
        updated: number;
        failed: number;
    }>;
    private syncSingleListing;
    private syncLegacyTradingListing;
    private upsertFromOffer;
    private resolveBrowseSeller;
    private getAllLiveListingsViaBrowse;
    private syncFromBrowseApi;
    private upsertFromBrowseItem;
    private isPublishedOffer;
    private syncFromTradingApi;
    private upsertFromTradingItem;
    private enrichSparseImageListings;
    private markUnseenActiveAsEnded;
    private resolveAccounts;
    getSyncLogs(organizationId: string, ebayAccountId?: string, limit?: number): Promise<EbayPublishedListingSyncLog[]>;
}
