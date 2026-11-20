import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PipelineJob } from '../entities/pipeline-job.entity.js';
import { OpenAiService } from '../../common/openai/openai.service.js';
import { ModelRouter } from '../../common/openai/model-router.js';
import { AiRunLogService } from '../../common/openai/ai-run-log.service.js';
import { ImageSearchService } from './image-search.service.js';
import { ImageOptimizerService } from './image-optimizer.service.js';
export interface ImageCandidate {
    url: string;
    localPath?: string;
    source: string;
    width: number;
    height: number;
    format: string;
    relevanceScore: number;
    qualityScore: number;
    hasWatermark: boolean;
    hash: string;
    optimized?: boolean;
    fileSizeBytes?: number;
    accessible?: boolean;
    validationIssues?: string[];
    imageType?: string;
}
export interface ImageValidationResult {
    url: string;
    accessible: boolean;
    statusCode?: number;
    contentType?: string;
    contentLength?: number;
    issues: string[];
}
export interface PartImageResult {
    partNumber: string;
    title: string;
    primaryImage: ImageCandidate | null;
    galleryImages: ImageCandidate[];
    diagramImages: ImageCandidate[];
    confidenceScore: number;
    searchQueries: string[];
    sourceAttribution: Array<{
        url: string;
        source: string;
        localPath?: string;
    }>;
    skipped: boolean;
    skipReason?: string;
    validation?: {
        totalCandidates: number;
        accessible: number;
        meetsResolution: number;
        compliant: number;
        rejected: number;
        issues: string[];
    };
}
export interface ImageEnrichmentProgress {
    totalParts: number;
    processedParts: number;
    enrichedParts: number;
    skippedParts: number;
    failedParts: number;
    totalImagesFound: number;
    totalImagesDownloaded: number;
    cacheHits: number;
    openaiTokensUsed: number;
}
export declare class ImageEnrichmentService {
    private readonly jobRepo;
    private readonly openai;
    private readonly modelRouter;
    private readonly runLogService;
    private readonly config;
    private readonly imageSearch;
    private readonly imageOptimizer;
    private readonly logger;
    private readonly promptVersion;
    constructor(jobRepo: Repository<PipelineJob>, openai: OpenAiService, modelRouter: ModelRouter, runLogService: AiRunLogService, config: ConfigService, imageSearch: ImageSearchService, imageOptimizer: ImageOptimizerService);
    enrichBatch(parts: Array<{
        partNumber: string;
        title: string;
        brand?: string;
        mpn?: string;
        fitment?: string;
        existingImages?: string[];
    }>, jobId?: string, options?: {
        downloadImages?: boolean;
    }): Promise<{
        results: PartImageResult[];
        progress: ImageEnrichmentProgress;
    }>;
    private enrichSinglePart;
    private downloadAndOptimizeCandidates;
    private buildSearchQueries;
    private searchImages;
    private generateStructuredImageUrls;
    private validateAndRankImages;
    private deduplicateImages;
    private buildCacheKey;
    private updateJobProgress;
    getEnrichmentStatus(jobId: string): Promise<ImageEnrichmentProgress | null>;
    validateImageUrls(urls: string[]): Promise<ImageValidationResult[]>;
    private validateSingleImageUrl;
    private routedImageChat;
}
