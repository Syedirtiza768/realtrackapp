import { Repository } from 'typeorm';
import type { Queue } from 'bullmq';
import { ListingRecord } from '../listings/listing-record.entity.js';
export type EnrichmentFailureClass = 'transient' | 'permanent';
export interface EnrichmentFailureInfo {
    classification: EnrichmentFailureClass;
    reason: string;
    originalError: string;
}
export type FailureUiClass = 'code_bug' | 'needs_data' | 'needs_review' | 'system';
export declare function classifyFailureForUi(reason: string | null | undefined, imageCount?: number): FailureUiClass | null;
export declare class EnrichmentRetryService {
    private readonly listingRepo;
    private readonly inventoryQueue;
    private readonly logger;
    constructor(listingRepo: Repository<ListingRecord>, inventoryQueue: Queue);
    getFailureUiClass(reason: string | null | undefined, imageCount?: number): FailureUiClass | null;
    classifyError(err: unknown): EnrichmentFailureInfo;
    recordFailure(listingId: string, err: unknown): Promise<{
        shouldRetry: boolean;
        classification: EnrichmentFailureClass;
    }>;
    resetRetryState(listingId: string): Promise<void>;
    enqueueDueRetries(): Promise<{
        scanned: number;
        enqueued: number;
        skipped: number;
    }>;
    overridePermanentFailure(listingId: string): Promise<boolean>;
    recordSuccess(listingId: string): Promise<void>;
    getRetryStatus(listingId: string): Promise<{
        retryCount: number;
        maxRetries: number;
        permanentFail: boolean;
        lastFailureReason: string | null;
        lastFailureAt: Date | null;
        nextRetryAt: Date | null;
        isRateLimit: boolean;
    } | null>;
    private extractHttpStatus;
}
