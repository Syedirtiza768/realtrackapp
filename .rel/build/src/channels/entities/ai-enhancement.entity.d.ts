import { ListingRecord } from '../../listings/listing-record.entity.js';
export declare class AiEnhancement {
    id: string;
    listingId: string;
    listing: ListingRecord;
    enhancementType: 'title_optimization' | 'description_generation' | 'item_specifics' | 'fitment_detection' | 'image_enhancement';
    status: 'requested' | 'processing' | 'generated' | 'approved' | 'rejected';
    inputData: Record<string, unknown>;
    originalValue: string | null;
    enhancedValue: string | null;
    enhancedData: Record<string, unknown> | null;
    diff: Record<string, unknown> | null;
    provider: string | null;
    model: string | null;
    confidenceScore: number | null;
    tokensUsed: number | null;
    latencyMs: number | null;
    costUsd: number | null;
    version: number;
    enhancementVersion: number;
    approvedBy: string | null;
    approvedAt: Date | null;
    appliedAt: Date | null;
    rejectionReason: string | null;
    createdAt: Date;
    updatedAt: Date;
}
