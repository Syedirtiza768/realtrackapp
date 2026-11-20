import { ConfigService } from '@nestjs/config';
import { OpenAiService } from '../openai.service.js';
import { ModelRouter } from '../model-router.js';
import { ListingQualityValidator } from '../listing-quality.validator.js';
import { AiRunLogService } from '../ai-run-log.service.js';
import { ListingGuardAuditService } from '../listing-guard-audit.service.js';
import { EnrichmentCacheService } from '../enrichment-cache.service.js';
import type { OpenAiChatResponse } from '../openai.types.js';
import type { RunMode } from '../ai-routing-policy.types.js';
export interface EnrichmentResult {
    title: string | null;
    brand: string | null;
    mpn: string | null;
    oemNumber: string | null;
    partType: string | null;
    placement: string | null;
    condition: string | null;
    description: string | null;
    features: string[];
    suggestedCategory: string | null;
    itemSpecifics: Record<string, string>;
    searchKeywords: string[];
    confidence: Record<string, number>;
    compatibility?: Array<Record<string, unknown>>;
    validationScore?: number;
    passedGate?: boolean;
    hardFails?: string[];
    softFails?: string[];
    escalated?: boolean;
    model?: string;
    lane?: string;
    guardFixes?: string[];
    rawResponse: OpenAiChatResponse;
}
export declare class EnrichmentPipeline {
    private readonly openai;
    private readonly modelRouter;
    private readonly validator;
    private readonly runLogService;
    private readonly guardAudit;
    private readonly enrichmentCache;
    private readonly config;
    private readonly logger;
    private readonly promptVersion;
    constructor(openai: OpenAiService, modelRouter: ModelRouter, validator: ListingQualityValidator, runLogService: AiRunLogService, guardAudit: ListingGuardAuditService, enrichmentCache: EnrichmentCacheService, config: ConfigService);
    enrich(rawData: Record<string, unknown>, options?: {
        runMode?: RunMode;
        marketplace?: string;
        enhancementId?: string;
        productId?: string;
        importId?: string;
    }): Promise<EnrichmentResult>;
    private buildResultFromParsed;
    enrichBatch(items: Record<string, unknown>[], options?: {
        runMode?: RunMode;
        marketplace?: string;
    }): Promise<EnrichmentResult[]>;
    private str;
    private withHallucinationCheck;
    private withBrowseEvidence;
}
