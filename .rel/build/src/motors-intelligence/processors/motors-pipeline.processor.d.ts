import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MotorsIntelligenceService } from '../services/motors-intelligence.service';
import { EbayEnrichmentService } from '../services/ebay-enrichment.service';
export interface MotorsPipelineJobData {
    motorsProductId: string;
    stage?: 'full' | 'extraction' | 'identity' | 'fitment' | 'enrichment' | 'listing' | 'compliance' | 'publish';
    connectionId?: string;
}
export declare class MotorsPipelineProcessor extends WorkerHost {
    private readonly motorsService;
    private readonly ebayEnrichmentService;
    private readonly logger;
    constructor(motorsService: MotorsIntelligenceService, ebayEnrichmentService: EbayEnrichmentService);
    process(job: Job<MotorsPipelineJobData>): Promise<any>;
}
