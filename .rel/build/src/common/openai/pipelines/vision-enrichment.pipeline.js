"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var VisionEnrichmentPipeline_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionEnrichmentPipeline = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_service_js_1 = require("../openai.service.js");
const model_router_js_1 = require("../model-router.js");
const listing_quality_validator_js_1 = require("../listing-quality.validator.js");
const listing_guards_js_1 = require("../listing-guards.js");
const ai_run_log_service_js_1 = require("../ai-run-log.service.js");
const ecu_identification_prompt_js_1 = require("../prompts/ecu-identification.prompt.js");
const MOTOR_PARTS_PROMPT = `Analyze this motor part image and extract:
1. Part title (max 80 chars, eBay-optimized)
2. Brand name
3. Manufacturer Part Number (MPN)
4. OE/OEM Part Number
5. Part type/category
6. Condition (New/Used/Refurbished)
7. Estimated market value (USD)
8. Description (250 chars)
9. Key features (array)
10. Vehicle fitment (make, model, year range, engine if visible)
11. Dimensions if measurable
12. Any visible defects or wear

Return JSON only with these exact keys:
{
  "title": string,
  "brand": string | null,
  "mpn": string | null,
  "oemNumber": string | null,
  "partType": string | null,
  "condition": "New" | "Used" | "Refurbished",
  "priceEstimate": number | null,
  "description": string,
  "features": string[],
  "fitment": { "make": string, "model": string, "yearStart": number, "yearEnd": number, "engine": string | null } | null,
  "dimensions": { "length": string, "width": string, "height": string, "weight": string } | null,
  "defects": string[],
  "confidence": {
    "title": number,
    "brand": number,
    "mpn": number,
    "partType": number,
    "overall": number
  }
}

Include confidence 0.0-1.0 for each field. Be conservative with confidence scores.`;
let VisionEnrichmentPipeline = VisionEnrichmentPipeline_1 = class VisionEnrichmentPipeline {
    openai;
    modelRouter;
    validator;
    runLogService;
    config;
    logger = new common_1.Logger(VisionEnrichmentPipeline_1.name);
    promptVersion;
    constructor(openai, modelRouter, validator, runLogService, config) {
        this.openai = openai;
        this.modelRouter = modelRouter;
        this.validator = validator;
        this.runLogService = runLogService;
        this.config = config;
        this.promptVersion = this.config.get('AI_PROMPT_VERSION', 'enrichment-v1');
    }
    async analyze(imageUrls, partContext = {}, prompt) {
        const useEcuPrompt = (!prompt || prompt === ecu_identification_prompt_js_1.ECU_IDENTIFICATION_PROMPT) &&
            (0, ecu_identification_prompt_js_1.isEcuPartType)(partContext.partType);
        const effectivePrompt = prompt ?? (useEcuPrompt ? ecu_identification_prompt_js_1.ECU_IDENTIFICATION_PROMPT : MOTOR_PARTS_PROMPT);
        const systemPrompt = useEcuPrompt
            ? 'You are an expert at identifying automotive electronic control modules (ECUs, TCMs, BCMs) from their labels and physical appearance.'
            : 'You are an expert automotive parts vision analyst for eBay Motors listings.';
        const route = this.modelRouter.selectVisionRoute(partContext);
        const response = await this.openai.chat({
            userPrompt: effectivePrompt,
            systemPrompt,
            imageUrls,
            imageDetail: partContext.partType === 'single_listing_form' || useEcuPrompt
                ? 'high'
                : undefined,
            model: route.model,
            costLane: route.lane,
            jsonMode: true,
            temperature: 0.1,
            maxTokens: useEcuPrompt ? 2500 : 2000,
        });
        let parsed = typeof response.content === 'object' && response.content
            ? response.content
            : { _raw: response.rawContent };
        const srcPart = {
            partNumber: partContext.partNumber,
            donorMake: partContext.donorMake ?? 'mercedes',
        };
        let guardFixes = [];
        if (parsed.title || parsed.compatibility) {
            const guarded = (0, listing_guards_js_1.applyListingGuards)(parsed, srcPart);
            parsed = guarded.item;
            guardFixes = guarded.fixes;
            if (guardFixes.length) {
                this.logger.debug(`Vision guard fixes: ${guardFixes.join(', ')}`);
            }
        }
        const validation = await this.validator.validateWithTaxonomy(parsed, srcPart);
        await this.runLogService.logRun({
            sku: partContext.sku ?? null,
            partNumber: partContext.partNumber ?? null,
            partType: partContext.partType ?? 'vision_ingestion',
            price: partContext.price ?? null,
            marketplace: partContext.marketplace ?? null,
            lane: route.lane,
            model: route.model,
            attempt: 1,
            promptVersion: this.promptVersion,
            routingPolicyVersion: route.policyVersion,
            inputTokens: response.usage.promptTokens,
            outputTokens: response.usage.completionTokens,
            costUsd: response.estimatedCostUsd,
            latencyMs: response.latencyMs,
            validationScore: validation.score,
            hardFails: validation.hardFails,
            softFails: validation.softFails,
            escalated: false,
            passedGate: validation.pass,
            fitmentRowCount: validation.fitmentRowCount,
            guardFixes,
        });
        const result = {
            raw: parsed,
            provider: 'openai_vision',
            model: route.model,
            lane: route.lane,
            tokensUsed: response.usage.totalTokens,
            latencyMs: response.latencyMs,
            estimatedCostUsd: response.estimatedCostUsd,
            validationScore: validation.score,
            passedGate: validation.pass,
            hardFails: validation.hardFails,
            softFails: validation.softFails,
            guardFixes,
            rawResponse: response,
        };
        if (useEcuPrompt && parsed && typeof parsed === 'object') {
            const partNums = parsed.partNumbers;
            const vehicleApp = parsed.vehicleApplication;
            const ecuConfidence = parsed.confidence;
            result.ecuIdentifiers = {
                partType: parsed.partType ?? null,
                brand: parsed.brand ?? null,
                mpn: partNums?.mpn ?? null,
                oemNumber: partNums?.oemNumber ?? null,
                hardwareNumber: partNums?.hardwareNumber ?? null,
                softwareNumber: partNums?.softwareNumber ?? null,
                otherNumbers: Array.isArray(partNums?.otherNumbers)
                    ? partNums.otherNumbers
                    : [],
                visibleText: Array.isArray(parsed.visibleText)
                    ? parsed.visibleText
                    : [],
                vehicleMake: vehicleApp?.make ?? null,
                vehicleModel: vehicleApp?.model ?? null,
                vehicleYearRange: vehicleApp?.yearRange ?? null,
                confidence: {
                    brand: Number(ecuConfidence?.brand) || 0,
                    partNumbers: Number(ecuConfidence?.partNumbers) || 0,
                    vehicleApplication: Number(ecuConfidence?.vehicleApplication) || 0,
                    overall: Number(ecuConfidence?.overall) || 0,
                },
            };
            this.logger.log(`ECU identification: partType=${result.ecuIdentifiers.partType}, ` +
                `brand=${result.ecuIdentifiers.brand}, mpn=${result.ecuIdentifiers.mpn}, ` +
                `oem=${result.ecuIdentifiers.oemNumber}, hw=${result.ecuIdentifiers.hardwareNumber}`);
        }
        return result;
    }
};
exports.VisionEnrichmentPipeline = VisionEnrichmentPipeline;
exports.VisionEnrichmentPipeline = VisionEnrichmentPipeline = VisionEnrichmentPipeline_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_js_1.OpenAiService,
        model_router_js_1.ModelRouter,
        listing_quality_validator_js_1.ListingQualityValidator,
        ai_run_log_service_js_1.AiRunLogService,
        config_1.ConfigService])
], VisionEnrichmentPipeline);
//# sourceMappingURL=vision-enrichment.pipeline.js.map