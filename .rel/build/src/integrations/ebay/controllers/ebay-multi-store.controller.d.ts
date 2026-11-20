import { Repository } from 'typeorm';
import { User } from '../../../auth/entities/user.entity.js';
import { EbayPublishJobDto, EbayValidateDto } from '../dto/ebay-integrations.dto.js';
import { EbayMultiStoreListingService } from '../services/ebay-multi-store-listing.service.js';
import { EbayIntegrationPermissionsService } from '../services/ebay-integration-permissions.service.js';
import { EbayListingChannel } from '../entities/ebay-listing-channel.entity.js';
import { EbayApiError } from '../entities/ebay-api-error.entity.js';
import { ListingActionLog } from '../entities/listing-action-log.entity.js';
import { EbayBulkPublishJobDto } from '../dto/ebay-integrations.dto.js';
export declare class EbayMultiStoreController {
    private readonly listings;
    private readonly permissions;
    private readonly channelRepo;
    private readonly errorRepo;
    private readonly logRepo;
    constructor(listings: EbayMultiStoreListingService, permissions: EbayIntegrationPermissionsService, channelRepo: Repository<EbayListingChannel>, errorRepo: Repository<EbayApiError>, logRepo: Repository<ListingActionLog>);
    validate(dto: EbayValidateDto, user: User): Promise<{
        results: Record<string, unknown>[];
    }>;
    publish(dto: EbayPublishJobDto, user: User): Promise<{
        jobId: string;
        status: import("../entities/ebay-listing-job.entity.js").EbayListingJobStatus;
        skippedTargets: {
            ebayAccountId: string;
            marketplaceId: string;
            errors: string[];
        }[];
    }>;
    publishBulk(dto: EbayBulkPublishJobDto, user: User): Promise<{
        jobId: string;
        status: import("../entities/ebay-listing-job.entity.js").EbayListingJobStatus;
        targetCount: number;
        dailyLimit: number;
        dailyUsed: number;
        dailyRemaining: number;
        skipped: {
            listingId: string;
            reason: string;
        }[];
    }>;
    getJob(id: string, organizationId: string | undefined, user: User): Promise<import("../entities/ebay-listing-job.entity.js").EbayListingJob>;
    getJobTargets(id: string, organizationId: string | undefined, user: User): Promise<{
        id: string;
        catalogProductId: string | null;
        ebayAccountId: string | null;
        marketplaceId: string;
        vertical: "fashion" | "business_industrial" | "automotive" | null;
        storeId: string | null;
        storeName: string | null;
        status: import("../entities/ebay-listing-job-target.entity.js").EbayListingJobTargetStatus;
        resultPayload: Record<string, unknown> | null;
        errorPayload: Record<string, unknown> | null;
        errorMessage: string | null;
        lastErrorMessage: string | null;
    }[]>;
    listChannels(organizationId: string | undefined, user: User, ebayAccountId?: string, marketplaceId?: string, status?: string, limit?: string): Promise<{
        total: number;
        items: EbayListingChannel[];
    }>;
    listErrors(organizationId: string | undefined, user: User, limit?: string): Promise<{
        items: EbayApiError[];
    }>;
    activity(organizationId: string | undefined, user: User, limit?: string): Promise<{
        items: ListingActionLog[];
    }>;
}
