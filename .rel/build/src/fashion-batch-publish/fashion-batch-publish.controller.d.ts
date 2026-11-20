import { User } from '../auth/entities/user.entity.js';
import { ApplySuggestionDto, ApproveListingDto, ComplianceConfigDto, CreateFashionBatchDto, RejectListingDto, ReviewQueueQueryDto } from './fashion-batch-publish.dto.js';
import { FashionBatchPublishService } from './fashion-batch-publish.service.js';
import type { FashionComplianceConfig } from './fashion-compliance.rules.js';
export declare class FashionBatchPublishController {
    private readonly batches;
    constructor(batches: FashionBatchPublishService);
    create(dto: CreateFashionBatchDto, user: User): Promise<{
        batchId: string;
        picked: number;
        dryRun: boolean;
        message: string;
    }>;
    list(user: User, organizationId?: string): Promise<{
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
    get(id: string, user: User, organizationId?: string): Promise<{
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
    report(id: string, user: User, organizationId?: string): Promise<string>;
    retry(itemId: string, user: User, organizationId?: string): Promise<{
        itemId: string;
        state: "UNPUBLISHED";
    }>;
    queue(user: User, q: ReviewQueueQueryDto): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: import("./fashion-compliance.rules.js").ComplianceDecision | null;
        riskScore: number | null;
        issues: import("./fashion-compliance.rules.js").ComplianceIssue[];
        fixes: import("./fashion-compliance.rules.js").ComplianceFix[];
        suggestion: import("./entities/fashion-publish.entities.js").AiSuggestion | null;
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
    item(id: string, user: User, organizationId?: string): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: import("./fashion-compliance.rules.js").ComplianceDecision | null;
        riskScore: number | null;
        issues: import("./fashion-compliance.rules.js").ComplianceIssue[];
        fixes: import("./fashion-compliance.rules.js").ComplianceFix[];
        suggestion: import("./entities/fashion-publish.entities.js").AiSuggestion | null;
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
    audit(id: string, user: User, organizationId?: string): Promise<import("../integrations/ebay/entities/listing-action-log.entity.js").ListingActionLog[]>;
    applySuggestion(id: string, dto: ApplySuggestionDto, user: User, organizationId?: string): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: import("./fashion-compliance.rules.js").ComplianceDecision | null;
        riskScore: number | null;
        issues: import("./fashion-compliance.rules.js").ComplianceIssue[];
        fixes: import("./fashion-compliance.rules.js").ComplianceFix[];
        suggestion: import("./entities/fashion-publish.entities.js").AiSuggestion | null;
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
    rejectSuggestion(id: string, user: User, organizationId?: string): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: import("./fashion-compliance.rules.js").ComplianceDecision | null;
        riskScore: number | null;
        issues: import("./fashion-compliance.rules.js").ComplianceIssue[];
        fixes: import("./fashion-compliance.rules.js").ComplianceFix[];
        suggestion: import("./entities/fashion-publish.entities.js").AiSuggestion | null;
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
    recheck(id: string, user: User, organizationId?: string): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: import("./fashion-compliance.rules.js").ComplianceDecision | null;
        riskScore: number | null;
        issues: import("./fashion-compliance.rules.js").ComplianceIssue[];
        fixes: import("./fashion-compliance.rules.js").ComplianceFix[];
        suggestion: import("./entities/fashion-publish.entities.js").AiSuggestion | null;
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
    approve(id: string, dto: ApproveListingDto, user: User, organizationId?: string): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: import("./fashion-compliance.rules.js").ComplianceDecision | null;
        riskScore: number | null;
        issues: import("./fashion-compliance.rules.js").ComplianceIssue[];
        fixes: import("./fashion-compliance.rules.js").ComplianceFix[];
        suggestion: import("./entities/fashion-publish.entities.js").AiSuggestion | null;
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
    reject(id: string, dto: RejectListingDto, user: User, organizationId?: string): Promise<{
        catalogProductId: string;
        state: "FAILED" | "PUBLISHED" | "UNPUBLISHED" | "READY" | "NEEDS_REVIEW" | "BLOCKED" | "IMAGES_PROCESSING" | "IMAGES_READY" | "COMPLIANCE_CHECK" | "PUBLISHING";
        complianceResult: import("./fashion-compliance.rules.js").ComplianceDecision | null;
        riskScore: number | null;
        issues: import("./fashion-compliance.rules.js").ComplianceIssue[];
        fixes: import("./fashion-compliance.rules.js").ComplianceFix[];
        suggestion: import("./entities/fashion-publish.entities.js").AiSuggestion | null;
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
    getConfig(user: User, organizationId?: string): Promise<{
        effective: FashionComplianceConfig;
        override: Record<string, unknown>;
        updatedAt: Date | null;
    }>;
    putConfig(dto: ComplianceConfigDto, user: User, organizationId?: string): Promise<{
        effective: FashionComplianceConfig;
        override: Record<string, unknown>;
        updatedAt: Date | null;
    }>;
}
