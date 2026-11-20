export declare class MarketSnapshot {
    id: string;
    masterProductId: string;
    partNumber: string;
    totalListings: number;
    avgPrice: number | null;
    medianPrice: number | null;
    minPrice: number | null;
    maxPrice: number | null;
    recommendedPricing: Record<string, unknown> | null;
    marketInsights: string[];
    confidence: number | null;
    aiCostUsd: number | null;
    capturedAt: Date;
    createdAt: Date;
}
