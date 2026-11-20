import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import type { Queue } from 'bullmq';
import { EbayListingJob } from '../entities/ebay-listing-job.entity.js';
import { EbayListingJobTarget } from '../entities/ebay-listing-job-target.entity.js';
import { EbayListingValidationService } from './ebay-listing-validation.service.js';
import { CatalogPublishResolverService } from './catalog-publish-resolver.service.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayTradingQuotaService } from './ebay-trading-quota.service.js';
type PublishTargetInput = {
    ebayAccountId: string;
    marketplaceId: string;
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
    merchantLocationKey?: string;
    requestedFulfillmentPolicyName?: string;
    requestedPaymentPolicyName?: string;
    requestedReturnPolicyName?: string;
};
export declare class EbayMultiStoreListingService {
    private readonly jobRepo;
    private readonly targetRepo;
    private readonly accountRepo;
    private readonly config;
    private readonly validation;
    private readonly publishResolver;
    private readonly publishQueue;
    private readonly tradingQuota;
    constructor(jobRepo: Repository<EbayListingJob>, targetRepo: Repository<EbayListingJobTarget>, accountRepo: Repository<ConnectedEbayAccount>, config: ConfigService, validation: EbayListingValidationService, publishResolver: CatalogPublishResolverService, publishQueue: Queue, tradingQuota: EbayTradingQuotaService);
    private dailyTargetLimit;
    private countTodayTargets;
    private assertTradingCapacity;
    createBulkPublishJob(input: {
        organizationId: string;
        requestedByUserId: string;
        listingIds: string[];
        storeIds: string[];
        policyOverrides?: Pick<PublishTargetInput, 'requestedFulfillmentPolicyName' | 'requestedPaymentPolicyName' | 'requestedReturnPolicyName'>;
        policyOverridesByStore?: Record<string, Pick<PublishTargetInput, 'requestedFulfillmentPolicyName' | 'requestedPaymentPolicyName' | 'requestedReturnPolicyName'>>;
        marketplaceByStore?: Record<string, string>;
        idempotencyKey?: string;
    }): Promise<{
        job: EbayListingJob;
        targetCount: number;
        dailyLimit: number;
        dailyUsed: number;
        skipped: Array<{
            listingId: string;
            reason: string;
        }>;
    }>;
    private resolveCanonicalProductId;
    validateTargets(input: {
        organizationId: string;
        catalogProductId: string;
        targets: PublishTargetInput[];
    }): Promise<{
        results: Record<string, unknown>[];
    }>;
    createPublishJob(input: {
        organizationId: string;
        requestedByUserId: string;
        catalogProductId: string;
        sourceListingId?: string;
        targets: PublishTargetInput[];
        idempotencyKey?: string;
    }): Promise<{
        job: EbayListingJob;
        skipped: {
            ebayAccountId: string;
            marketplaceId: string;
            errors: string[];
        }[];
    }>;
    getJob(jobId: string, organizationId: string): Promise<EbayListingJob>;
    getJobTargets(jobId: string, organizationId: string): Promise<{
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
}
export {};
