import { Repository } from 'typeorm';
import { AiEnhancement } from './entities/ai-enhancement.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { EnrichmentPipeline } from '../common/openai/pipelines/enrichment.pipeline.js';
import { ListingGenerationPipeline } from '../common/openai/pipelines/listing-generation.pipeline.js';
import { OpenAiService } from '../common/openai/openai.service.js';
import { AiRunLogService } from '../common/openai/ai-run-log.service.js';
export declare class AiEnhancementService {
    private readonly enhancementRepo;
    private readonly listingRepo;
    private readonly enrichmentPipeline;
    private readonly listingGenPipeline;
    private readonly openAiService;
    private readonly aiRunLogService;
    private readonly logger;
    constructor(enhancementRepo: Repository<AiEnhancement>, listingRepo: Repository<ListingRecord>, enrichmentPipeline: EnrichmentPipeline, listingGenPipeline: ListingGenerationPipeline, openAiService: OpenAiService, aiRunLogService: AiRunLogService);
    getEnhancements(filters: {
        listingId?: string;
        enhancementType?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        items: AiEnhancement[];
        total: number;
    }>;
    getEnhancement(id: string): Promise<AiEnhancement>;
    getListingEnhancements(listingId: string): Promise<AiEnhancement[]>;
    requestEnhancement(data: {
        listingId: string;
        enhancementType: AiEnhancement['enhancementType'];
        inputData?: Record<string, unknown>;
    }): Promise<AiEnhancement>;
    bulkRequestEnhancements(listingIds: string[], enhancementType: AiEnhancement['enhancementType']): Promise<{
        results: Array<{
            listingId: string;
            enhancementId?: string;
            status: string;
            error?: string;
        }>;
    }>;
    private processEnhancement;
    approveEnhancement(enhancementId: string, approvedBy?: string): Promise<AiEnhancement>;
    applyEnhancement(enhancementId: string): Promise<{
        enhancement: AiEnhancement;
        listing: ListingRecord;
    }>;
    rejectEnhancement(enhancementId: string, reason: string): Promise<AiEnhancement>;
    getStats(): Promise<Record<string, unknown>>;
    private generateEnhancement;
    private generateListingContent;
    private generateItemSpecificsAI;
    private generateFitmentDetectionAI;
    private fallbackListingContent;
    private fallbackItemSpecifics;
    private fallbackFitmentDetection;
    private generateImageEnhancement;
    private buildInputData;
    private getOriginalValue;
    private applyToListing;
    private str;
}
