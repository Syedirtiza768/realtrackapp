export declare class CreateFashionBatchDto {
    size: number;
    dryRun: boolean;
    ebayAccountId?: string;
    marketplaceId?: string;
    confirmAuthenticity?: boolean;
    organizationId?: string;
}
export declare class ApplySuggestionDto {
    title?: string;
    description?: string | null;
    brand?: string | null;
}
export declare class ApproveListingDto {
    authenticityConfirmed: boolean;
    notes?: string;
}
export declare class RejectListingDto {
    notes: string;
}
export declare class ReviewQueueQueryDto {
    state?: 'NEEDS_REVIEW' | 'BLOCKED';
    organizationId?: string;
}
export declare class ComplianceConfigDto {
    config: Record<string, unknown>;
}
