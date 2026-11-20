export declare class ReviewDecisionDto {
    decision: 'approved' | 'rejected';
    reason?: string;
    corrections?: Record<string, unknown>;
}
