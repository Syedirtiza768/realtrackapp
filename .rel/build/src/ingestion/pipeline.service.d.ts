import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { PipelineJob } from './entities/pipeline-job.entity.js';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import { EnterpriseListingIntelligenceService } from './enterprise-listing-intelligence.service.js';
import type { ListingQualityProfile } from './enterprise-listing-intelligence.service.js';
import { ListingOptimizationService } from '../listing-optimization/listing-optimization.service.js';
import type { JobOptimizationStatus } from '../listing-optimization/listing-optimization.types.js';
import { TitleVerificationService } from '../listing-optimization/title-verification/title-verification.service.js';
import type { TitleVerificationSummary } from '../listing-optimization/title-verification/title-verification.types.js';
import { HeavyJobLimiterService } from '../common/jobs/heavy-job-limiter.service.js';
import { SingleListingFormService } from './services/single-listing-form.service.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { TeamsService } from '../teams/teams.service.js';
import { User } from '../auth/entities/user.entity.js';
import { StoresService } from '../channels/stores.service.js';
import { type PipelineMarketplaceCode } from '../common/marketplaces/pipeline-marketplaces.js';
import { type PipelineDisplayStatus } from './pipeline.constants.js';
import { PRE_ENRICHED_FEBEST_MODE } from './pre-enriched-febest.js';
import { type ProductVertical } from '../verticals/vertical.types.js';
export { PIPELINE_CONDITION_OPTIONS, mapPipelineDisplayStatus, type PipelineDisplayStatus, } from './pipeline.constants.js';
export interface PipelineJobListItem {
    id: string;
    uploadCode: string | null;
    status: string;
    displayStatus: PipelineDisplayStatus;
    originalFilename: string;
    totalParts: number;
    conditionLabel: string | null;
    marketplace: string | null;
    store: {
        id: string;
        storeName: string;
    } | null;
    shippingProfileName: string | null;
    returnProfileName: string | null;
    paymentProfileName: string | null;
    team: {
        id: string;
        name: string;
        color: string;
    } | null;
    uploadedBy: {
        id: string;
        name: string;
    } | null;
    createdAt: Date;
    fileSizeBytes: number | null;
}
export interface PipelineUploadProfileOptions {
    marketplace: PipelineMarketplaceCode;
    storeId: string;
    shippingProfileName: string;
    returnProfileName: string;
    paymentProfileName: string;
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
}
export type PipelineImportMode = 'legacy_gridx' | typeof PRE_ENRICHED_FEBEST_MODE;
export interface CreatePipelineJobDto {
    originalFilename: string;
    storedFilePath: string;
    fileSizeBytes?: number;
}
export interface CreateSingleListingDto {
    sku?: string;
    brand?: string;
    model?: string;
    vin?: string;
    category?: string;
    partNumber?: string;
    partName?: string;
    note?: string;
    price?: number;
    quantity?: number;
    imageUrls?: string;
    uploadedAssetIds?: string[];
}
export interface PipelineJobSummary {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    byStatus: Record<string, number>;
    totalPartsProcessed: number;
    totalEnriched: number;
    totalTokens: number;
}
export interface CombinedOptimizationResult {
    job: PipelineJob;
    enterprise: EnterpriseOptimizationResult;
}
export type EnterpriseOptimizationResult = Awaited<ReturnType<EnterpriseListingIntelligenceService['generateForPipelineJob']>>;
export declare class PipelineService {
    private readonly jobRepo;
    private readonly listingRepo;
    private readonly pipelineQueue;
    private readonly featureFlagService;
    private readonly enterpriseListingIntelligence;
    private readonly listingOptimization;
    private readonly titleVerification;
    private readonly heavyJobLimiter;
    private readonly singleListingForm;
    private readonly teamsService;
    private readonly userRepo;
    private readonly storesService;
    private readonly logger;
    constructor(jobRepo: Repository<PipelineJob>, listingRepo: Repository<ListingRecord>, pipelineQueue: Queue, featureFlagService: FeatureFlagService, enterpriseListingIntelligence: EnterpriseListingIntelligenceService, listingOptimization: ListingOptimizationService, titleVerification: TitleVerificationService, heavyJobLimiter: HeavyJobLimiterService, singleListingForm: SingleListingFormService, teamsService: TeamsService, userRepo: Repository<User>, storesService: StoresService);
    private nextUploadCode;
    private pipelineUploadRoot;
    private ensureJobUploadDir;
    createJobFromUpload(originalFilename: string, fileBuffer: Buffer, userId?: string, teamId?: string, conditionLabel?: string, manageAllTeams?: boolean, profileOptions?: PipelineUploadProfileOptions, user?: User, vertical?: ProductVertical, importMode?: PipelineImportMode): Promise<PipelineJob>;
    createJob(dto: CreatePipelineJobDto, userId?: string): Promise<PipelineJob>;
    private enqueuePipelineJob;
    createSingleJob(dto: CreateSingleListingDto, userId?: string): Promise<PipelineJob>;
    createBatchJobFromListings(listingIds: string[], userId?: string, options?: {
        source?: string;
        forceVision?: boolean;
    }): Promise<PipelineJob>;
    listJobs(status?: string, limit?: number, offset?: number, viewerId?: string, viewAll?: boolean, displayStatus?: string, teamIds?: string[]): Promise<{
        jobs: PipelineJobListItem[];
        total: number;
    }>;
    private enrichJobList;
    getJob(id: string, viewerId?: string, viewAll?: boolean): Promise<PipelineJob>;
    updateProgress(id: string, update: Partial<PipelineJob>): Promise<PipelineJob>;
    cancelJob(id: string, actorId?: string, viewAll?: boolean): Promise<PipelineJob>;
    retryJob(id: string, actorId?: string, viewAll?: boolean): Promise<PipelineJob>;
    deleteJob(id: string, actorId?: string, viewAll?: boolean): Promise<void>;
    resumeImport(id: string, actorId?: string, viewAll?: boolean): Promise<PipelineJob>;
    getStats(): Promise<PipelineJobSummary>;
    generateEnterpriseOptimization(jobId: string, options?: {
        marketplace?: 'US' | 'DE' | 'AU';
        limit?: number;
        aiBudgetListings?: number;
        listingQualityProfile?: ListingQualityProfile;
    }): Promise<EnterpriseOptimizationResult>;
    runCombinedOptimization(jobId: string, options?: {
        marketplace?: 'US' | 'DE' | 'AU';
        limit?: number;
        aiBudgetListings?: number;
        listingQualityProfile?: ListingQualityProfile;
    }): Promise<CombinedOptimizationResult>;
    getOptimizationStatus(jobId: string, marketplace?: string): Promise<JobOptimizationStatus>;
    getProductOptimization(productId: string): Promise<import("../listing-optimization/listing-optimization.types.js").ProductOptimizationSummary & {
        fitmentRows: unknown;
        fitmentData: unknown;
        optimizationPayload: unknown;
    }>;
    rerunProductOptimization(productId: string, marketplace?: 'US' | 'DE' | 'AU'): Promise<import("../catalog-import/entities/catalog-product.entity.js").CatalogProduct>;
    markProductManualReview(productId: string, enabled?: boolean): Promise<import("../catalog-import/entities/catalog-product.entity.js").CatalogProduct>;
    verifyJobTitles(jobId: string): Promise<TitleVerificationSummary>;
    bypassJobOptimization(jobId: string): Promise<{
        updatedCount: number;
    }>;
    private optimizationStatusToEnterpriseResult;
    private normalizeEnterpriseOptions;
}
