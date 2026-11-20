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
var EnrichmentPipeline_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnrichmentPipeline = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_service_js_1 = require("../openai.service.js");
const model_router_js_1 = require("../model-router.js");
const listing_quality_validator_js_1 = require("../listing-quality.validator.js");
const listing_guards_js_1 = require("../listing-guards.js");
const ai_run_log_service_js_1 = require("../ai-run-log.service.js");
const listing_guard_audit_service_js_1 = require("../listing-guard-audit.service.js");
const index_js_1 = require("../prompts/index.js");
const motors_enrichment_prompt_js_1 = require("../prompts/motors-enrichment.prompt.js");
const enrichment_cache_service_js_1 = require("../enrichment-cache.service.js");
const token_optimization_js_1 = require("../token-optimization.js");
let EnrichmentPipeline = EnrichmentPipeline_1 = class EnrichmentPipeline {
    openai;
    modelRouter;
    validator;
    runLogService;
    guardAudit;
    enrichmentCache;
    config;
    logger = new common_1.Logger(EnrichmentPipeline_1.name);
    promptVersion;
    constructor(openai, modelRouter, validator, runLogService, guardAudit, enrichmentCache, config) {
        this.openai = openai;
        this.modelRouter = modelRouter;
        this.validator = validator;
        this.runLogService = runLogService;
        this.guardAudit = guardAudit;
        this.enrichmentCache = enrichmentCache;
        this.config = config;
        this.promptVersion = this.config.get('AI_PROMPT_VERSION', 'enrichment-v2-compact');
    }
    async enrich(rawData, options) {
        const partContext = {
            sku: this.str(rawData.sku) ?? undefined,
            partNumber: this.str(rawData.partNumber ?? rawData.mpn) ?? undefined,
            partName: this.str(rawData.partName ?? rawData.title) ?? undefined,
            partType: this.str(rawData.partType) ?? undefined,
            price: typeof rawData.price === 'number'
                ? rawData.price
                : Number(rawData.price) || undefined,
            marketplace: options?.marketplace ?? 'US',
        };
        partContext.partType = partContext.partType ?? (0, model_router_js_1.inferPartType)(partContext);
        const thresholds = this.modelRouter.getThresholds();
        const profile = (0, token_optimization_js_1.getEnrichmentProfile)(partContext.price, thresholds.lowValueMaxPrice);
        const mpn = partContext.partNumber;
        const cached = this.enrichmentCache.get(mpn, this.promptVersion, profile);
        if (cached) {
            this.logger.debug(`Enrichment cache hit for MPN ${mpn} profile=${profile}`);
            return this.buildResultFromParsed(cached, partContext, {
                model: 'cache',
                lane: 'cache',
                escalated: false,
                guardFixes: [],
                rawResponse: {
                    content: cached,
                    rawContent: (0, token_optimization_js_1.compactJson)(cached),
                    model: 'cache',
                    finishReason: 'cache_hit',
                    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                    latencyMs: 0,
                    estimatedCostUsd: 0,
                },
                validation: this.withBrowseEvidence(this.withHallucinationCheck(await this.validator.validateWithTaxonomy(cached, {
                    partNumber: partContext.partNumber,
                    donorMake: this.str(rawData.donorMake ?? rawData.brand) ?? 'mercedes',
                }, {
                    compactProfile: profile === 'compact',
                    ebayCategoryId: this.str(rawData.ebayCategoryId ?? rawData.categoryId) ??
                        null,
                }), cached, partContext.partNumber), rawData),
            });
        }
        const promptTemplate = profile === 'compact'
            ? motors_enrichment_prompt_js_1.MOTORS_ENRICHMENT_COMPACT_PROMPT
            : motors_enrichment_prompt_js_1.MOTORS_ENRICHMENT_FULL_PROMPT;
        const route = this.modelRouter.selectRoute(partContext, options?.runMode ?? 'default');
        let attempt = 1;
        let model = route.model;
        let lane = route.lane;
        let escalated = false;
        const runOnce = async (useModel, useLane, useAttempt) => {
            const { systemPrompt, userPrompt } = (0, index_js_1.renderPrompt)(promptTemplate, {
                rawData: (0, token_optimization_js_1.compactJson)(rawData),
            });
            const response = await this.openai.chat({
                systemPrompt,
                userPrompt,
                model: useModel,
                costLane: useLane,
                jsonMode: true,
                temperature: promptTemplate.temperature,
                ...(typeof promptTemplate.maxTokens === 'number'
                    ? { maxTokens: promptTemplate.maxTokens }
                    : {}),
            });
            let parsed = response.content;
            const srcPart = {
                partNumber: partContext.partNumber,
                donorMake: this.str(rawData.donorMake ?? rawData.brand) ?? 'mercedes',
                condition: this.str(rawData.condition),
            };
            let guardFixes = [];
            if (parsed.title || parsed.compatibility) {
                const beforeGuard = { ...parsed };
                const guarded = (0, listing_guards_js_1.applyListingGuards)(parsed, srcPart);
                parsed = guarded.item;
                guardFixes = guarded.fixes;
                if (guardFixes.length) {
                    await this.guardAudit.logGuardFixes(guardFixes, {
                        productId: options?.productId ?? this.str(rawData.productId) ?? null,
                        importId: options?.importId ?? this.str(rawData.importId) ?? null,
                        sku: partContext.sku ?? null,
                        before: beforeGuard,
                        after: parsed,
                    });
                }
            }
            const ebayCategoryId = this.str(rawData.ebayCategoryId ?? rawData.categoryId) ?? undefined;
            const validation = this.withBrowseEvidence(this.withHallucinationCheck(await this.validator.validateWithTaxonomy(parsed, srcPart, {
                ebayCategoryId,
                compactProfile: profile === 'compact',
            }), parsed, partContext.partNumber), rawData);
            await this.runLogService.logRun({
                sku: partContext.sku ?? null,
                partNumber: partContext.partNumber ?? null,
                partType: partContext.partType ?? null,
                price: partContext.price ?? null,
                marketplace: partContext.marketplace ?? null,
                enhancementId: options?.enhancementId ?? null,
                lane: useLane,
                model: useModel,
                attempt: useAttempt,
                promptVersion: this.promptVersion,
                routingPolicyVersion: route.policyVersion,
                inputTokens: response.usage.promptTokens,
                outputTokens: response.usage.completionTokens,
                costUsd: response.estimatedCostUsd,
                latencyMs: response.latencyMs,
                validationScore: validation.score,
                hardFails: validation.hardFails,
                softFails: validation.softFails,
                escalated: useAttempt > 1,
                passedGate: validation.pass,
                fitmentRowCount: validation.fitmentRowCount,
                guardFixes,
            });
            return { parsed, response, validation, guardFixes };
        };
        let { parsed, response, validation, guardFixes } = await runOnce(model, lane, attempt);
        if (!validation.pass && validation.escalate) {
            const escalationModel = this.modelRouter.getEscalationModel(model, lane);
            if (escalationModel) {
                attempt = 2;
                escalated = true;
                model = escalationModel;
                lane = 'escalation';
                this.logger.warn(`Escalating enrichment for ${partContext.sku ?? partContext.partNumber} → ${model}`);
                ({ parsed, response, validation, guardFixes } = await runOnce(model, lane, attempt));
            }
        }
        if (mpn) {
            this.enrichmentCache.set(mpn, this.promptVersion, profile, parsed);
        }
        const result = this.buildResultFromParsed(parsed, partContext, {
            model,
            lane,
            escalated,
            guardFixes,
            rawResponse: response,
            validation,
        });
        this.logger.log(`Enriched product: title="${result.title}" model=${model} profile=${profile} score=${validation.score} pass=${validation.pass} cost=$${response.estimatedCostUsd.toFixed(4)}`);
        return result;
    }
    buildResultFromParsed(parsed, partContext, meta) {
        return {
            title: this.str(parsed.title),
            brand: this.str(parsed.brand),
            mpn: this.str(parsed.mpn),
            oemNumber: this.str(parsed.oemNumber),
            partType: this.str(parsed.partType ?? parsed.type) ??
                partContext.partType ??
                null,
            placement: this.str(parsed.placement),
            condition: this.str(parsed.condition),
            description: this.str(parsed.description),
            features: Array.isArray(parsed.features)
                ? parsed.features
                : [],
            suggestedCategory: this.str(parsed.suggestedCategory),
            itemSpecifics: typeof parsed.itemSpecifics === 'object' && parsed.itemSpecifics
                ? parsed.itemSpecifics
                : {},
            searchKeywords: Array.isArray(parsed.searchKeywords)
                ? parsed.searchKeywords
                : [],
            confidence: typeof parsed.confidence === 'object' && parsed.confidence
                ? parsed.confidence
                : {},
            compatibility: Array.isArray(parsed.compatibility)
                ? parsed.compatibility
                : undefined,
            validationScore: meta.validation.score,
            passedGate: meta.validation.pass,
            hardFails: meta.validation.hardFails,
            softFails: meta.validation.softFails,
            escalated: meta.escalated,
            model: meta.model,
            lane: meta.lane,
            guardFixes: meta.guardFixes,
            rawResponse: meta.rawResponse,
        };
    }
    async enrichBatch(items, options) {
        const results = [];
        for (let i = 0; i < items.length; i++) {
            this.logger.debug(`Enriching item ${i + 1}/${items.length}`);
            results.push(await this.enrich(items[i], options));
        }
        return results;
    }
    str(val) {
        return typeof val === 'string' && val.trim().length > 0 ? val.trim() : null;
    }
    withHallucinationCheck(validation, parsed, providedPartNumber) {
        const brand = this.str(parsed.brand);
        if (!brand)
            return validation;
        const normalize = (v) => (v ?? '').toLowerCase().replace(/[\s\-]/g, '');
        const outputNumber = this.str(parsed.oemNumber ?? parsed.mpn);
        if (providedPartNumber &&
            outputNumber &&
            normalize(outputNumber) === normalize(providedPartNumber)) {
            return validation;
        }
        const warnings = (0, listing_guards_js_1.detectHallucinatedPartNumbers)([
            {
                oemPartNumber: this.str(parsed.oemNumber ?? parsed.mpn) ?? undefined,
                partName: this.str(parsed.partType ?? parsed.type) ?? undefined,
            },
        ], brand);
        if (warnings.length === 0)
            return validation;
        const hardFails = [
            ...validation.hardFails,
            ...warnings.map((w) => `HALLUCINATED_PART_NUMBER: ${w}`),
        ];
        return {
            ...validation,
            hardFails,
            pass: false,
            escalate: true,
        };
    }
    withBrowseEvidence(validation, rawData) {
        const checked = rawData.browseCatalogChecked === true;
        const found = rawData.browseCatalogFound === true;
        if (!checked || found)
            return validation;
        return {
            ...validation,
            softFails: [...validation.softFails, 'NOT_FOUND_ON_EBAY_CATALOG'],
        };
    }
};
exports.EnrichmentPipeline = EnrichmentPipeline;
exports.EnrichmentPipeline = EnrichmentPipeline = EnrichmentPipeline_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_js_1.OpenAiService,
        model_router_js_1.ModelRouter,
        listing_quality_validator_js_1.ListingQualityValidator,
        ai_run_log_service_js_1.AiRunLogService,
        listing_guard_audit_service_js_1.ListingGuardAuditService,
        enrichment_cache_service_js_1.EnrichmentCacheService,
        config_1.ConfigService])
], EnrichmentPipeline);
//# sourceMappingURL=enrichment.pipeline.js.map