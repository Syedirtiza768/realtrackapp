export interface AiRawResponse {
    raw: Record<string, unknown>;
    provider: string;
    model: string;
    tokensUsed: number;
    latencyMs: number;
    estimatedCostUsd: number;
    validationScore?: number;
    passedGate?: boolean;
    guardFixes?: string[];
}
export interface NormalizedAiFields {
    title: string | null;
    brand: string | null;
    mpn: string | null;
    oemNumber: string | null;
    partType: string | null;
    condition: string | null;
    priceEstimate: number | null;
    description: string | null;
    features: string[];
    fitmentRaw: Record<string, unknown> | null;
    confidenceTitle: number;
    confidenceBrand: number;
    confidenceMpn: number;
    confidencePartType: number;
    confidenceOverall: number;
}
export interface AiVisionProvider {
    readonly name: string;
    analyzeImages(imageUrls: string[], prompt?: string, partContext?: Record<string, unknown>): Promise<AiRawResponse>;
    estimateCost(imageCount: number): number;
}
