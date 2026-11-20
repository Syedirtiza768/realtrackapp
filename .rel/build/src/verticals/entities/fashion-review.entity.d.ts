export type FashionReviewStatus = 'pending' | 'approved' | 'rejected' | 'quarantined';
export declare class FashionReview {
    id: string;
    organizationId: string;
    catalogProductId: string;
    status: FashionReviewStatus;
    authenticityConfirmed: boolean;
    evidenceKeys: string[];
    reviewedByUserId: string | null;
    notes: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
