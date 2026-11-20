import type { ComplianceDecision, ComplianceFix, ComplianceIssue } from '../fashion-compliance.rules.js';
export declare const FASHION_PIPELINE_STATES: readonly ["UNPUBLISHED", "IMAGES_PROCESSING", "IMAGES_READY", "COMPLIANCE_CHECK", "NEEDS_REVIEW", "BLOCKED", "READY", "PUBLISHING", "PUBLISHED", "FAILED"];
export type FashionPipelineState = (typeof FASHION_PIPELINE_STATES)[number];
export type ImageVariantName = 'original' | 'thumb' | 'small' | 'large' | 'ebay_master';
export interface PipelineImage {
    index: number;
    sourceUrl: string;
    hash: string | null;
    width: number | null;
    height: number | null;
    bytes: number | null;
    format: string | null;
    keys: Partial<Record<ImageVariantName, string>>;
    urls: Partial<Record<ImageVariantName, string>>;
    flags: string[];
    excluded: {
        code: string;
        reason: string;
    } | null;
    error: string | null;
    reused?: boolean;
}
export interface AiSuggestion {
    before: {
        title: string;
        description: string | null;
        brand: string | null;
    };
    after: {
        title: string;
        description: string | null;
        brand: string | null;
    };
    rationale: string;
    model: string | null;
    status: 'pending' | 'applied' | 'rejected' | 'edited';
    createdAt: string;
}
export declare class FashionListingPipeline {
    catalogProductId: string;
    organizationId: string;
    state: FashionPipelineState;
    activeBatchId: string | null;
    lastBatchId: string | null;
    complianceResult: ComplianceDecision | null;
    riskScore: number | null;
    issues: ComplianceIssue[];
    fixes: ComplianceFix[];
    suggestion: AiSuggestion | null;
    images: PipelineImage[];
    visionResult: Record<string, unknown> | null;
    visionFingerprint: string | null;
    ebayMasterUrls: string[];
    ebayImageUrls: string[];
    checkedAt: Date | null;
    approvedByUserId: string | null;
    publishAttempt: number;
    listingJobId: string | null;
    ebayAccountId: string | null;
    marketplaceId: string | null;
    ebayItemId: string | null;
    ebayOfferId: string | null;
    publishedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export type FashionBatchStatus = 'queued' | 'running' | 'completed' | 'cancelled';
export declare class FashionPublishBatch {
    id: string;
    organizationId: string;
    requestedByUserId: string;
    requestedSize: number;
    dryRun: boolean;
    ebayAccountId: string | null;
    marketplaceId: string | null;
    confirmedByUserId: string | null;
    status: FashionBatchStatus;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare class FashionPublishBatchItem {
    id: string;
    batchId: string;
    organizationId: string;
    catalogProductId: string;
    position: number;
    state: FashionPipelineState;
    complianceResult: ComplianceDecision | null;
    riskScore: number | null;
    issueCodes: string[];
    ebayItemId: string | null;
    error: string | null;
    finishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare class FashionComplianceConfigRow {
    organizationId: string;
    config: Record<string, unknown>;
    updatedByUserId: string | null;
    updatedAt: Date;
}
