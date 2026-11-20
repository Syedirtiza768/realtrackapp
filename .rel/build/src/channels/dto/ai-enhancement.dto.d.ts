export declare class RequestEnhancementDto {
    listingId: string;
    enhancementType: string;
    inputData?: Record<string, unknown>;
}
export declare class BulkRequestEnhancementDto {
    listingIds: string[];
    enhancementType: string;
}
export declare class ApproveEnhancementDto {
    approvedBy?: string;
}
export declare class RejectEnhancementDto {
    reason: string;
}
export declare class EnhancementQueryDto {
    listingId?: string;
    enhancementType?: string;
    status?: string;
    limit?: number;
    offset?: number;
}
