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
var CompetitiveAnalysisPipeline_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompetitiveAnalysisPipeline = void 0;
const common_1 = require("@nestjs/common");
const openai_service_js_1 = require("../openai.service.js");
const index_js_1 = require("../prompts/index.js");
const competitive_analysis_prompt_js_1 = require("../prompts/competitive-analysis.prompt.js");
let CompetitiveAnalysisPipeline = CompetitiveAnalysisPipeline_1 = class CompetitiveAnalysisPipeline {
    openai;
    logger = new common_1.Logger(CompetitiveAnalysisPipeline_1.name);
    constructor(openai) {
        this.openai = openai;
    }
    async analyze(productTitle, partNumber, condition, competitorData) {
        const { systemPrompt, userPrompt } = (0, index_js_1.renderPrompt)(competitive_analysis_prompt_js_1.COMPETITIVE_ANALYSIS_PROMPT, {
            productTitle,
            partNumber,
            condition,
            competitorData: JSON.stringify(competitorData, null, 2),
        });
        const response = await this.openai.chat({
            systemPrompt,
            userPrompt,
            jsonMode: true,
            temperature: competitive_analysis_prompt_js_1.COMPETITIVE_ANALYSIS_PROMPT.temperature,
            maxTokens: competitive_analysis_prompt_js_1.COMPETITIVE_ANALYSIS_PROMPT.maxTokens,
        });
        const parsed = response.content;
        const summary = (parsed.marketSummary ?? {});
        const pricing = (parsed.recommendedPricing ?? {});
        const breakdown = (parsed.conditionBreakdown ?? {});
        const result = {
            marketSummary: {
                totalListings: this.num(summary.totalListings) ?? 0,
                avgPrice: this.num(summary.avgPrice),
                medianPrice: this.num(summary.medianPrice),
                minPrice: this.num(summary.minPrice),
                maxPrice: this.num(summary.maxPrice),
                priceStdDev: this.num(summary.priceStdDev),
            },
            conditionBreakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [
                k,
                { count: this.num(v.count) ?? 0, avgPrice: this.num(v.avgPrice) },
            ])),
            recommendedPricing: {
                competitive: this.num(pricing.competitive),
                premium: this.num(pricing.premium),
                aggressive: this.num(pricing.aggressive),
                rationale: typeof pricing.rationale === 'string' ? pricing.rationale : null,
            },
            marketInsights: Array.isArray(parsed.marketInsights)
                ? parsed.marketInsights
                : [],
            listingOptimizations: Array.isArray(parsed.listingOptimizations)
                ? parsed.listingOptimizations
                : [],
            confidence: this.num(parsed.confidence) ?? 0,
            rawResponse: response,
        };
        this.logger.log(`Competitive analysis for "${productTitle}": avg=$${result.marketSummary.avgPrice} confidence=${result.confidence} cost=$${response.estimatedCostUsd.toFixed(4)}`);
        return result;
    }
    num(val) {
        const n = Number(val);
        return isNaN(n) ? null : n;
    }
};
exports.CompetitiveAnalysisPipeline = CompetitiveAnalysisPipeline;
exports.CompetitiveAnalysisPipeline = CompetitiveAnalysisPipeline = CompetitiveAnalysisPipeline_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_js_1.OpenAiService])
], CompetitiveAnalysisPipeline);
//# sourceMappingURL=competitive-analysis.pipeline.js.map