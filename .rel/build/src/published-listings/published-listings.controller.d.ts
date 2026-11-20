import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';
import { User } from '../auth/entities/user.entity.js';
import { EbayIntegrationPermissionsService } from '../integrations/ebay/services/ebay-integration-permissions.service.js';
import { BulkPublishedListingsDto, PrimemotiveSaleWebhookDto, PublishedListingsQueryDto, RevisePublishedListingDto, SyncPublishedListingsDto, UpdatePoliciesDto } from './dto/published-listings.dto.js';
import { PublishedListingsService } from './services/published-listings.service.js';
import { PublishedListingsSyncService } from './services/published-listings-sync.service.js';
import { PublishedListingsActionService } from './services/published-listings-action.service.js';
import { PublishedListingsBulkService } from './services/published-listings-bulk.service.js';
import { PublishedListingsAuditService } from './services/published-listings-audit.service.js';
import { PublishedListingsPricingService } from './services/published-listings-pricing.service.js';
import { PublishedListingsTradingEnrichmentService } from './services/published-listings-trading-enrichment.service.js';
import { PrimemotiveListingChangesService } from './services/primemotive-listing-changes.service.js';
export declare class PublishedListingsController {
    private readonly listings;
    private readonly sync;
    private readonly actions;
    private readonly bulk;
    private readonly audit;
    private readonly pricing;
    private readonly permissions;
    private readonly tradingEnrichment;
    private readonly primemotiveChanges;
    constructor(listings: PublishedListingsService, sync: PublishedListingsSyncService, actions: PublishedListingsActionService, bulk: PublishedListingsBulkService, audit: PublishedListingsAuditService, pricing: PublishedListingsPricingService, permissions: EbayIntegrationPermissionsService, tradingEnrichment: PublishedListingsTradingEnrichmentService, primemotiveChanges: PrimemotiveListingChangesService);
    list(query: PublishedListingsQueryDto, user: User): Promise<{
        items: Array<import("./entities/ebay-published-listing.entity.js").EbayPublishedListing | import("./published-listings-response.util.js").PublishedListingApiResponse>;
        total: number;
        page: number;
        limit: number;
        nextId?: string;
        hasMore?: boolean;
    }>;
    listPrimemotive(query: PublishedListingsQueryDto, user: User): Promise<{
        items: Array<import("./entities/ebay-published-listing.entity.js").EbayPublishedListing | import("./published-listings-response.util.js").PublishedListingApiResponse>;
        total: number;
        page: number;
        limit: number;
        nextId?: string;
        hasMore?: boolean;
    }>;
    listPrimemotiveSalesEvents(query: PublishedListingsQueryDto, user: User): Promise<{
        items: import("../channels/entities/channel-webhook-log.entity.js").ChannelWebhookLog[];
        total: number;
        page: number;
        limit: number;
    }>;
    listPrimemotiveChanges(query: PublishedListingsQueryDto, user: User): Promise<{
        items: any;
        total: any;
        limit: number;
        nextSequence: any;
        throughSequence: any;
        hasMore: boolean;
    } | {
        items: {
            eventId: string;
            eventType: import("./entities/ebay-published-listing-change.entity.js").PrimemotiveListingChangeType;
            occurredAt: string;
            listingId: string;
            sequence: string | null;
            revision: {};
            listing: Record<string, unknown>;
        }[];
        total: number;
        page: number;
        limit: number;
        nextUpdatedAfter: string;
    }>;
    recordPrimemotiveSale(dto: PrimemotiveSaleWebhookDto, organizationId: string | undefined, timestamp: string | undefined, signature: string | undefined, request: RawBodyRequest<Request>, user: User): Promise<{
        status: string;
        eventId: string;
        listingId: any;
        receivedAt: string;
    }>;
    exportCsv(query: PublishedListingsQueryDto, res: Response, user: User): Promise<void>;
    summary(organizationId: string | undefined, ebayAccountId: string | undefined, user: User): Promise<{
        total: number;
        active: number;
        ended: number;
        outOfStock: number;
        withWarnings: number;
        lastSyncedAt: string | null;
    }>;
    stores(organizationId: string | undefined, user: User): Promise<{
        items: import("./services/published-listings.service.js").PublishedListingStoreSummary[];
    }>;
    syncStatus(organizationId: string | undefined, user: User): Promise<import("./services/published-listings.service.js").PublishedListingsSyncStatusResponse>;
    syncLogs(organizationId: string | undefined, ebayAccountId: string | undefined, limit: string | undefined, user: User): Promise<{
        items: import("./entities/ebay-published-listing-sync-log.entity.js").EbayPublishedListingSyncLog[];
    }>;
    syncListings(dto: SyncPublishedListingsDto, user: User): Promise<{
        jobIds: string[];
        syncLogIds: string[];
    }>;
    refreshCompetitorPricing(dto: SyncPublishedListingsDto, user: User): Promise<{
        processed: number;
        updated: number;
        skipped: number;
    } | {
        accounts: number;
        updated: number;
        skipped: number;
    }>;
    bulkAction(dto: BulkPublishedListingsDto, user: User): Promise<{
        jobId: string;
        status: import("./entities/ebay-published-listing-bulk-job.entity.js").BulkJobStatus;
        totalItems: number;
    }>;
    bulkStatus(jobId: string, organizationId: string | undefined, user: User): Promise<{
        job: import("./entities/ebay-published-listing-bulk-job.entity.js").EbayPublishedListingBulkJob;
        items: import("./entities/ebay-published-listing-bulk-job-item.entity.js").EbayPublishedListingBulkJobItem[];
    }>;
    tradingEnrichmentBudget(): Promise<{
        used: number;
        remaining: number;
        limit: number;
        resetDate: string;
    }>;
    batchTradingEnrichment(dto: {
        listingIds: string[];
        force?: boolean;
    }, organizationId: string | undefined, user: User): Promise<{
        enriched: number;
        skipped: number;
        failed: number;
    }>;
    getOne(id: string, organizationId: string | undefined, includeCatalogData: boolean | undefined, user: User): Promise<import("./published-listings-response.util.js").PublishedListingApiResponse>;
    getTradingEnrichment(id: string, organizationId: string | undefined, force: string | undefined, user: User): Promise<{
        data: import("./services/published-listings-trading-enrichment.service.js").CachedTradingEnrichment;
        cached: boolean;
        budget: ReturnType<any>;
    }>;
    revisions(id: string, organizationId: string | undefined, user: User): Promise<{
        items: import("./entities/ebay-published-listing-revision.entity.js").EbayPublishedListingRevision[];
    }>;
    revise(id: string, dto: RevisePublishedListingDto, organizationId: string | undefined, user: User): Promise<import("./entities/ebay-published-listing.entity.js").EbayPublishedListing>;
    updatePolicies(id: string, dto: UpdatePoliciesDto, organizationId: string | undefined, user: User): Promise<import("./entities/ebay-published-listing.entity.js").EbayPublishedListing>;
    refreshListingCompetitorPricing(id: string, organizationId: string | undefined, user: User): Promise<import("./entities/ebay-published-listing.entity.js").EbayPublishedListing>;
    end(id: string, organizationId: string | undefined, user: User): Promise<import("./entities/ebay-published-listing.entity.js").EbayPublishedListing>;
    relist(id: string, organizationId: string | undefined, user: User): Promise<import("./entities/ebay-published-listing.entity.js").EbayPublishedListing>;
    refresh(id: string, organizationId: string | undefined, user: User): Promise<import("./entities/ebay-published-listing.entity.js").EbayPublishedListing>;
}
