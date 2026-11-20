export declare enum CandidateStatus {
    PENDING = "pending",
    SELECTED = "selected",
    REJECTED = "rejected",
    MERGED = "merged"
}
export declare class ProductCandidate {
    id: string;
    motorsProductId: string;
    status: CandidateStatus;
    rank: number;
    brand: string | null;
    mpn: string | null;
    mpnNormalized: string | null;
    oemPartNumber: string | null;
    productType: string | null;
    productFamily: string | null;
    placement: string | null;
    condition: string | null;
    source: string;
    sourceReference: string | null;
    exactMpnScore: number;
    brandMatchScore: number;
    ocrMpnScore: number;
    visualFamilyScore: number;
    dimensionMatchScore: number;
    supplierDescSimilarityScore: number;
    fitmentConsistencyScore: number;
    compositeScore: number;
    candidateData: Record<string, any> | null;
    scoringBreakdown: Record<string, any> | null;
    rejectionReason: string | null;
    createdAt: Date;
}
