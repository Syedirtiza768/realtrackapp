import type { Queue } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { EbayHostedImage } from '../integrations/ebay/entities/ebay-hosted-image.entity.js';
import { EbayListingJobTarget } from '../integrations/ebay/entities/ebay-listing-job-target.entity.js';
import { ListingActionLog } from '../integrations/ebay/entities/listing-action-log.entity.js';
import { EbayMultiStoreListingService } from '../integrations/ebay/services/ebay-multi-store-listing.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { ListingBuilderService } from '../integrations/ebay/services/listing-builder.service.js';
import { FashionListingsService } from '../verticals/fashion-listings.service.js';
import { VerticalsService } from '../verticals/verticals.service.js';
import { FashionComplianceConfigRow, FashionListingPipeline, FashionPublishBatch, FashionPublishBatchItem, type AiSuggestion } from './entities/fashion-publish.entities.js';
import { type ComplianceDecision, type ComplianceFix, type ComplianceIssue, type ComplianceListing, type FashionComplianceConfig } from './fashion-compliance.rules.js';
import { FashionImagePipelineService } from './fashion-image-pipeline.service.js';
import { FashionVisionCheckService } from './fashion-vision-check.service.js';
export declare const FASHION_BATCH_QUEUE = "fashion-batch-publish";
export declare const MAX_BATCH_SIZE = 500;
export type FashionBatchJob = {
    kind: 'process';
    itemId: string;
} | {
    kind: 'sync';
    itemId: string;
    attempt: number;
};
export declare function listingSnapshot(p: CatalogProduct): ComplianceListing;
export declare class FashionBatchPublishService {
    private readonly db;
    private readonly queue;
    private readonly pipelineRepo;
    private readonly batchRepo;
    private readonly itemRepo;
    private readonly configRepo;
    private readonly productRepo;
    private readonly auditRepo;
    private readonly targetRepo;
    private readonly hostedImageRepo;
    private readonly userRepo;
    private readonly organizations;
    private readonly stores;
    private readonly rbac;
    private readonly verticals;
    private readonly fashion;
    private readonly listings;
    private readonly builder;
    private readonly imagePipeline;
    private readonly vision;
    private readonly logger;
    constructor(db: DataSource, queue: Queue<FashionBatchJob>, pipelineRepo: Repository<FashionListingPipeline>, batchRepo: Repository<FashionPublishBatch>, itemRepo: Repository<FashionPublishBatchItem>, configRepo: Repository<FashionComplianceConfigRow>, productRepo: Repository<CatalogProduct>, auditRepo: Repository<ListingActionLog>, targetRepo: Repository<EbayListingJobTarget>, hostedImageRepo: Repository<EbayHostedImage>, userRepo: Repository<User>, organizations: UserOrganizationService, stores: StoreAccessService, rbac: RbacService, verticals: VerticalsService, fashion: FashionListingsService, listings: EbayMultiStoreListingService, builder: ListingBuilderService, imagePipeline: FashionImagePipelineService, vision: FashionVisionCheckService);
    createBatch(user: User, dto: {
        size: number;
        dryRun: boolean;
        ebayAccountId?: string;
        marketplaceId?: string;
        confirmAuthenticity?: boolean;
        organizationId?: string;
    }): Promise<{
        batchId: string;
        picked: number;
        dryRun: boolean;
        message: string;
    }>;
    processItem(itemId: string): Promise<void>;
    private publish;
    syncItem(itemId: string, attempt: number): Promise<void>;
    private syncPublishing;
    private evaluate;
    private storeEvaluation;
    private buildPreflight;
    private applyFixesToProduct;
    private setState;
    private finish;
    private refreshBatchStatus;
    private audit;
    config(organizationId: string): Promise<FashionComplianceConfig>;
    private org;
    listBatches(user: User, organizationId?: string): Promise<{
        counts: Record<string, number>;
        id: string;
        organizationId: string;
        requestedByUserId: string;
        requestedSize: number;
        dryRun: boolean;
        ebayAccountId: string | null;
        marketplaceId: string | null;
        confirmedByUserId: string | null;
        status: import("./entities/fashion-publish.entities.js").FashionBatchStatus;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    private stateCounts;
    getBatch(user: User, id: string, organizationId?: string): Promise<{
        status: import("./entities/fashion-publish.entities.js").FashionBatchStatus;
        counts: Record<string, number>;
        topIssues: {
            code: string;
            count: number;
        }[];
        items: Record<string, unknown>[];
        id: string;
        organizationId: string;
        requestedByUserId: string;
        requestedSize: number;
        dryRun: boolean;
        ebayAccountId: string | null;
        marketplaceId: string | null;
        confirmedByUserId: string | null;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    reportCsv(user: User, id: string, organizationId?: string): Promise<string>;
    reviewQueue(user: User, state: 'NEEDS_REVIEW' | 'BLOCKED', organizationId?: string, limit?: number): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: ComplianceDecision | null;
        riskScore: number | null;
        issues: ComplianceIssue[];
        fixes: ComplianceFix[];
        suggestion: AiSuggestion | null;
        images: {
            index: number;
            thumb: string | null;
            width: number | null;
            height: number | null;
            flags: string[];
            excluded: {
                code: string;
                reason: string;
            } | null;
            error: string | null;
        }[];
        ebayMasterUrls: string[];
        checkedAt: Date | null;
        lastError: string | null;
        listing: {
            id: string;
            sku: string | null;
            title: string;
            description: string | null;
            brand: string | null;
            brandSpecific: string | null;
            price: number | null;
            categoryName: string | null;
            verticalValidationStatus: string;
        };
    }[]>;
    reviewItem(user: User, productId: string, organizationId?: string): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: ComplianceDecision | null;
        riskScore: number | null;
        issues: ComplianceIssue[];
        fixes: ComplianceFix[];
        suggestion: AiSuggestion | null;
        images: {
            index: number;
            thumb: string | null;
            width: number | null;
            height: number | null;
            flags: string[];
            excluded: {
                code: string;
                reason: string;
            } | null;
            error: string | null;
        }[];
        ebayMasterUrls: string[];
        checkedAt: Date | null;
        lastError: string | null;
        listing: {
            id: string;
            sku: string | null;
            title: string;
            description: string | null;
            brand: string | null;
            brandSpecific: string | null;
            price: number | null;
            categoryName: string | null;
            verticalValidationStatus: string;
        };
    }>;
    private reviewView;
    auditLog(user: User, productId: string, organizationId?: string): Promise<ListingActionLog[]>;
    private loadForReview;
    applySuggestion(user: User, productId: string, edits: {
        title?: string;
        description?: string | null;
        brand?: string | null;
    }, organizationId?: string): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: ComplianceDecision | null;
        riskScore: number | null;
        issues: ComplianceIssue[];
        fixes: ComplianceFix[];
        suggestion: AiSuggestion | null;
        images: {
            index: number;
            thumb: string | null;
            width: number | null;
            height: number | null;
            flags: string[];
            excluded: {
                code: string;
                reason: string;
            } | null;
            error: string | null;
        }[];
        ebayMasterUrls: string[];
        checkedAt: Date | null;
        lastError: string | null;
        listing: {
            id: string;
            sku: string | null;
            title: string;
            description: string | null;
            brand: string | null;
            brandSpecific: string | null;
            price: number | null;
            categoryName: string | null;
            verticalValidationStatus: string;
        };
    }>;
    recheck(user: User, productId: string, organizationId?: string): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: ComplianceDecision | null;
        riskScore: number | null;
        issues: ComplianceIssue[];
        fixes: ComplianceFix[];
        suggestion: AiSuggestion | null;
        images: {
            index: number;
            thumb: string | null;
            width: number | null;
            height: number | null;
            flags: string[];
            excluded: {
                code: string;
                reason: string;
            } | null;
            error: string | null;
        }[];
        ebayMasterUrls: string[];
        checkedAt: Date | null;
        lastError: string | null;
        listing: {
            id: string;
            sku: string | null;
            title: string;
            description: string | null;
            brand: string | null;
            brandSpecific: string | null;
            price: number | null;
            categoryName: string | null;
            verticalValidationStatus: string;
        };
    }>;
    approve(user: User, productId: string, dto: {
        authenticityConfirmed: boolean;
        notes?: string;
    }, organizationId?: string): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: ComplianceDecision | null;
        riskScore: number | null;
        issues: ComplianceIssue[];
        fixes: ComplianceFix[];
        suggestion: AiSuggestion | null;
        images: {
            index: number;
            thumb: string | null;
            width: number | null;
            height: number | null;
            flags: string[];
            excluded: {
                code: string;
                reason: string;
            } | null;
            error: string | null;
        }[];
        ebayMasterUrls: string[];
        checkedAt: Date | null;
        lastError: string | null;
        listing: {
            id: string;
            sku: string | null;
            title: string;
            description: string | null;
            brand: string | null;
            brandSpecific: string | null;
            price: number | null;
            categoryName: string | null;
            verticalValidationStatus: string;
        };
    }>;
    reject(user: User, productId: string, dto: {
        notes: string;
    }, organizationId?: string): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: ComplianceDecision | null;
        riskScore: number | null;
        issues: ComplianceIssue[];
        fixes: ComplianceFix[];
        suggestion: AiSuggestion | null;
        images: {
            index: number;
            thumb: string | null;
            width: number | null;
            height: number | null;
            flags: string[];
            excluded: {
                code: string;
                reason: string;
            } | null;
            error: string | null;
        }[];
        ebayMasterUrls: string[];
        checkedAt: Date | null;
        lastError: string | null;
        listing: {
            id: string;
            sku: string | null;
            title: string;
            description: string | null;
            brand: string | null;
            brandSpecific: string | null;
            price: number | null;
            categoryName: string | null;
            verticalValidationStatus: string;
        };
    }>;
    rejectSuggestion(user: User, productId: string, organizationId?: string): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: ComplianceDecision | null;
        riskScore: number | null;
        issues: ComplianceIssue[];
        fixes: ComplianceFix[];
        suggestion: AiSuggestion | null;
        images: {
            index: number;
            thumb: string | null;
            width: number | null;
            height: number | null;
            flags: string[];
            excluded: {
                code: string;
                reason: string;
            } | null;
            error: string | null;
        }[];
        ebayMasterUrls: string[];
        checkedAt: Date | null;
        lastError: string | null;
        listing: {
            id: string;
            sku: string | null;
            title: string;
            description: string | null;
            brand: string | null;
            brandSpecific: string | null;
            price: number | null;
            categoryName: string | null;
            verticalValidationStatus: string;
        };
    }>;
    retryItem(user: User, itemId: string, organizationId?: string): Promise<{
        itemId: string;
        state: "UNPUBLISHED";
    }>;
    getConfig(user: User, organizationId?: string): Promise<{
        effective: FashionComplianceConfig;
        override: Record<string, unknown>;
        updatedAt: Date | null;
    }>;
    putConfig(user: User, override: Partial<FashionComplianceConfig>, organizationId?: string): Promise<{
        effective: FashionComplianceConfig;
        override: Record<string, unknown>;
        updatedAt: Date | null;
    }>;
}
