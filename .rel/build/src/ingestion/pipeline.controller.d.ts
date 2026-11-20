import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Response } from 'express';
import { PipelineService } from './pipeline.service.js';
import type { CreateSingleListingDto } from './pipeline.service.js';
import { SingleListingFormService } from './services/single-listing-form.service.js';
import type { PartLookupDto } from './services/single-listing-form.service.js';
import { AddIntakePartDto } from './dto/add-intake-part.dto.js';
import type { ListingQualityProfile } from './enterprise-listing-intelligence.service.js';
import type { CombinedOptimizationResult } from './pipeline.service.js';
import type { EnterpriseOptimizationResult } from './pipeline.service.js';
import { User } from '../auth/entities/user.entity.js';
import { RbacService } from '../rbac/rbac.service.js';
import { TeamsService } from '../teams/teams.service.js';
export declare class PipelineController {
    private readonly pipelineService;
    private readonly singleListingForm;
    private readonly rbac;
    private readonly teamsService;
    private readonly events;
    constructor(pipelineService: PipelineService, singleListingForm: SingleListingFormService, rbac: RbacService, teamsService: TeamsService, events: EventEmitter2);
    generateEnterpriseOptimization(id: string, body?: {
        marketplace?: 'US' | 'DE' | 'AU';
        limit?: number;
        aiBudgetListings?: number;
        listingQualityProfile?: ListingQualityProfile;
    }): Promise<EnterpriseOptimizationResult>;
    getOptimizationStatus(id: string, marketplace?: string): Promise<import("../listing-optimization/listing-optimization.types.js").JobOptimizationStatus>;
    getProductOptimization(_jobId: string, productId: string): Promise<import("../listing-optimization/listing-optimization.types.js").ProductOptimizationSummary & {
        fitmentRows: unknown;
        fitmentData: unknown;
        optimizationPayload: unknown;
    }>;
    rerunProductOptimization(productId: string, body?: {
        marketplace?: 'US' | 'DE' | 'AU';
    }): Promise<{
        product: import("../catalog-import/entities/catalog-product.entity.js").CatalogProduct;
    }>;
    markManualReview(productId: string, body?: {
        enabled?: boolean;
    }): Promise<{
        product: import("../catalog-import/entities/catalog-product.entity.js").CatalogProduct;
    }>;
    verifyTitles(id: string): Promise<import("../listing-optimization/title-verification/title-verification.types.js").TitleVerificationSummary>;
    bypassOptimization(id: string): Promise<{
        updatedCount: number;
    }>;
    runCombinedOptimization(id: string, body?: {
        marketplace?: 'US' | 'DE' | 'AU';
        limit?: number;
        aiBudgetListings?: number;
        listingQualityProfile?: ListingQualityProfile;
    }): Promise<CombinedOptimizationResult>;
    uploadAndStart(file: Express.Multer.File, teamId: string, conditionLabel: string, marketplace: string, storeId: string, shippingProfileName: string, returnProfileName: string, paymentProfileName: string, fulfillmentPolicyId: string | undefined, paymentPolicyId: string | undefined, returnPolicyId: string | undefined, verticalRaw: string | undefined, importModeRaw: string | undefined, user: User): Promise<{
        job: import("./entities/pipeline-job.entity.js").PipelineJob;
    }>;
    dryRunPreEnrichedFebest(file: Express.Multer.File): Promise<{
        mode: "pre_enriched_febest_v1";
        filename: string;
        validation: import("./pre-enriched-febest.js").PreEnrichedFebestValidationResult;
    }>;
    singleListingBrands(q?: string): Promise<{
        brands: string[];
    }>;
    singleListingLookupPricing(): Promise<import("./services/single-listing-form.service.js").PartLookupPricingEstimate>;
    singleListingPartLookup(body: PartLookupDto): Promise<import("./services/single-listing-form.service.js").PartLookupResult>;
    addIntakePart(body: AddIntakePartDto, user: User): Promise<{
        listing: import("../listings/listing-record.entity.js").ListingRecord;
    }>;
    createSingleListing(body: CreateSingleListingDto, user: User): Promise<{
        job: import("./entities/pipeline-job.entity.js").PipelineJob;
    }>;
    listJobs(user: User, status?: string, displayStatus?: string, teamIds?: string, limit?: number, offset?: number): Promise<{
        jobs: import("./pipeline.service.js").PipelineJobListItem[];
        total: number;
    }>;
    getJob(id: string, user: User): Promise<{
        job: import("./entities/pipeline-job.entity.js").PipelineJob;
    }>;
    retryJob(id: string, user: User): Promise<{
        job: import("./entities/pipeline-job.entity.js").PipelineJob;
    }>;
    cancelJob(id: string, user: User): Promise<{
        job: import("./entities/pipeline-job.entity.js").PipelineJob;
    }>;
    resumeImport(id: string, user: User): Promise<{
        job: import("./entities/pipeline-job.entity.js").PipelineJob;
    }>;
    deleteJob(id: string, user: User): Promise<{
        deleted: boolean;
    }>;
    getStats(): Promise<import("./pipeline.service.js").PipelineJobSummary>;
    downloadOutput(id: string, template: string, res: Response): Promise<void>;
}
