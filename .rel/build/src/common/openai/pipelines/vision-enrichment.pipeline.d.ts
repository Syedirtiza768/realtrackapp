import { ConfigService } from '@nestjs/config';
import { OpenAiService } from '../openai.service.js';
import { ModelRouter } from '../model-router.js';
import { ListingQualityValidator } from '../listing-quality.validator.js';
import { AiRunLogService } from '../ai-run-log.service.js';
import type { PartContext } from '../ai-routing-policy.types.js';
import type { OpenAiChatResponse } from '../openai.types.js';
export interface EcuIdentifiers {
    partType: string | null;
    brand: string | null;
    mpn: string | null;
    oemNumber: string | null;
    hardwareNumber: string | null;
    softwareNumber: string | null;
    otherNumbers: string[];
    visibleText: string[];
    vehicleMake: string | null;
    vehicleModel: string | null;
    vehicleYearRange: string | null;
    confidence: {
        brand: number;
        partNumbers: number;
        vehicleApplication: number;
        overall: number;
    };
}
export interface VisionEnrichmentResult {
    raw: Record<string, unknown>;
    provider: string;
    model: string;
    lane: string;
    tokensUsed: number;
    latencyMs: number;
    estimatedCostUsd: number;
    validationScore: number;
    passedGate: boolean;
    hardFails: string[];
    softFails: string[];
    guardFixes: string[];
    rawResponse: OpenAiChatResponse;
    ecuIdentifiers?: EcuIdentifiers;
}
export declare class VisionEnrichmentPipeline {
    private readonly openai;
    private readonly modelRouter;
    private readonly validator;
    private readonly runLogService;
    private readonly config;
    private readonly logger;
    private readonly promptVersion;
    constructor(openai: OpenAiService, modelRouter: ModelRouter, validator: ListingQualityValidator, runLogService: AiRunLogService, config: ConfigService);
    analyze(imageUrls: string[], partContext?: PartContext, prompt?: string): Promise<VisionEnrichmentResult>;
}
