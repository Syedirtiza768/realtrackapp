import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { PipelineJob } from '../ingestion/entities/pipeline-job.entity.js';
import { EnrichmentRetryService } from './enrichment-retry.service.js';
export type EnrichmentStatus = 'idle' | 'ready' | 'enriching' | 'completed' | 'needs_review' | 'failed';
export declare const INLINE_ENRICH_STAGES: {
    readonly VISION_LOOKUP: "vision_lookup";
    readonly ENRICHMENT: "enrichment";
    readonly GENERATING_US: "generating_us";
    readonly GENERATING_AU: "generating_au";
    readonly GENERATING_DE: "generating_de";
    readonly COMPLETED: "completed";
    readonly NEEDS_REVIEW: "needs_review";
    readonly FAILED: "failed";
};
export type InlineEnrichStage = (typeof INLINE_ENRICH_STAGES)[keyof typeof INLINE_ENRICH_STAGES];
export declare class InventoryAutoTriggerService {
    private readonly inventoryQueue;
    private readonly listingRepo;
    private readonly pipelineJobRepo;
    private readonly retryService;
    private readonly logger;
    constructor(inventoryQueue: Queue, listingRepo: Repository<ListingRecord>, pipelineJobRepo: Repository<PipelineJob>, retryService: EnrichmentRetryService);
    deriveStatus(listing: Pick<ListingRecord, 'itemPhotoUrl' | 'cOeOemPartNumber' | 'cManufacturerPartNumber' | 'cBrand' | 'pipelineJobId' | 'enrichmentLastFailureReason'> & {
        enrichmentStage?: string | null;
    }, pipelineJob?: PipelineJob | null): EnrichmentStatus;
    queryStatus(listingId: string): Promise<EnrichmentStatus>;
    queryStatusWithStage(listingId: string): Promise<{
        status: EnrichmentStatus;
        stage: string | null;
    }>;
    enqueueAutoEnrich(listingId: string, options?: {
        force?: boolean;
    }): Promise<{
        queued: boolean;
        reason?: string;
    }>;
    private parseImageUrls;
}
