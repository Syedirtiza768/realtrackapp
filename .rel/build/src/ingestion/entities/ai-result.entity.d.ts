import { IngestionJob } from './ingestion-job.entity.js';
export declare class AiResult {
    id: string;
    jobId: string;
    job?: IngestionJob;
    rawResponse: Record<string, unknown>;
    provider: string;
    model: string;
    tokensUsed: number | null;
    latencyMs: number | null;
    extractedTitle: string | null;
    extractedBrand: string | null;
    extractedMpn: string | null;
    extractedOemNumber: string | null;
    extractedPartType: string | null;
    extractedCondition: string | null;
    extractedPriceEstimate: number | null;
    extractedDescription: string | null;
    extractedFeatures: string[] | null;
    extractedFitmentRaw: Record<string, unknown> | null;
    confidenceTitle: number | null;
    confidenceBrand: number | null;
    confidenceMpn: number | null;
    confidencePartType: number | null;
    confidenceOverall: number;
    matchedExistingId: string | null;
    matchConfidence: number | null;
    createdAt: Date;
}
