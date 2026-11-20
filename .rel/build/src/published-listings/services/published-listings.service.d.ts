import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { ChannelWebhookLog } from '../../channels/entities/channel-webhook-log.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
import { StoreAccessService } from '../../channels/store-access.service.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import { EbayPublishedListingSyncLog } from '../entities/ebay-published-listing-sync-log.entity.js';
import type { PrimemotiveSaleWebhookDto, PublishedListingsQueryDto } from '../dto/published-listings.dto.js';
import { type PublishedListingApiResponse } from '../published-listings-response.util.js';
import { PublishedListingsEnrichmentService } from './published-listings-enrichment.service.js';
import { PublishedListingsHealthService } from './published-listings-health.service.js';
export declare const LIVE_SYNC_SKEW_MS: number;
export interface PublishedListingStoreSummary {
    storeId: string;
    storeSlug: string | null;
    name: string;
    activeListingCount: number;
    endedListingCount: number;
    lastSyncedAt: string | null;
    syncStatus: 'ok' | 'stale' | 'failed' | 'never_synced' | 'inactive';
    ebayAccountId: string | null;
    connectionStatus: string | null;
}
export interface PublishedListingsSyncStatusResponse {
    organizationId: string;
    globalActiveCount: number;
    stores: Array<{
        storeId: string;
        storeSlug: string | null;
        name: string;
        activeCount: number;
        endedCount: number;
        lastSuccessAt: string | null;
        lastErrorAt: string | null;
        lastError: string | null;
        syncStatus: PublishedListingStoreSummary['syncStatus'];
        healthFlags: string[];
    }>;
    generatedAt: string;
}
export declare class PublishedListingsService {
    private readonly listingRepo;
    private readonly catalogProductRepo;
    private readonly webhookLogRepo;
    private readonly storeRepo;
    private readonly accountRepo;
    private readonly syncLogRepo;
    private readonly storeAccess;
    private readonly enrichment;
    private readonly health;
    constructor(listingRepo: Repository<EbayPublishedListing>, catalogProductRepo: Repository<CatalogProduct>, webhookLogRepo: Repository<ChannelWebhookLog>, storeRepo: Repository<Store>, accountRepo: Repository<ConnectedEbayAccount>, syncLogRepo: Repository<EbayPublishedListingSyncLog>, storeAccess: StoreAccessService, enrichment: PublishedListingsEnrichmentService, health: PublishedListingsHealthService);
    resolvePrimemotiveStoreId(organizationId: string): Promise<string>;
    listPrimemotive(organizationId: string, user: User, query: PublishedListingsQueryDto): Promise<{
        items: Array<EbayPublishedListing | PublishedListingApiResponse>;
        total: number;
        page: number;
        limit: number;
        nextId?: string;
        hasMore?: boolean;
    }>;
    list(organizationId: string, user: User, query: PublishedListingsQueryDto, constraints?: {
        requirePublishedActiveRecord?: boolean;
    }): Promise<{
        items: Array<EbayPublishedListing | PublishedListingApiResponse>;
        total: number;
        page: number;
        limit: number;
        nextId?: string;
        hasMore?: boolean;
    }>;
    recordPrimemotiveSaleEvent(organizationId: string, user: User, dto: PrimemotiveSaleWebhookDto, rawBody: Buffer, timestampHeader?: string, signatureHeader?: string): Promise<{
        status: string;
        eventId: string;
        listingId: any;
        receivedAt: string;
    }>;
    listPrimemotiveSalesEvents(organizationId: string, user: User, query: PublishedListingsQueryDto): Promise<{
        items: ChannelWebhookLog[];
        total: number;
        page: number;
        limit: number;
    }>;
    exportCsv(organizationId: string, user: User, query: PublishedListingsQueryDto): Promise<string>;
    private firstSpecificFromItem;
    private allSpecificsFromItem;
    private buildListQuery;
    private resolveListStoreSlugFilter;
    private resolveStoreSlugIds;
    getById(id: string, organizationId: string, user: User, includeCatalogData?: boolean): Promise<PublishedListingApiResponse>;
    getByIdRaw(id: string, organizationId: string, user: User): Promise<EbayPublishedListing>;
    getByIdsRaw(ids: string[], organizationId: string, user: User): Promise<EbayPublishedListing[]>;
    private maybeEnrichDetailOnDemand;
    getSummary(organizationId: string, user: User, ebayAccountId?: string): Promise<{
        total: number;
        active: number;
        ended: number;
        outOfStock: number;
        withWarnings: number;
        lastSyncedAt: string | null;
    }>;
    listStores(organizationId: string, user: User): Promise<{
        items: PublishedListingStoreSummary[];
    }>;
    getSyncStatus(organizationId: string, user: User): Promise<PublishedListingsSyncStatusResponse>;
    private countLiveActiveByStore;
    private resolveStoreSyncStatus;
    private extractStoreSlug;
    private resolveStoreSlugForId;
    private assertListingAccess;
    private loadCatalogProducts;
}
