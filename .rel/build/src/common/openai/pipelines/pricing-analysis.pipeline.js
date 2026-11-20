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
var PricingAnalysisPipeline_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingAnalysisPipeline = void 0;
const common_1 = require("@nestjs/common");
const openai_service_js_1 = require("../openai.service.js");
const index_js_1 = require("../prompts/index.js");
const pricing_analysis_prompt_js_1 = require("../prompts/pricing-analysis.prompt.js");
let PricingAnalysisPipeline = PricingAnalysisPipeline_1 = class PricingAnalysisPipeline {
    openai;
    logger = new common_1.Logger(PricingAnalysisPipeline_1.name);
    constructor(openai) {
        this.openai = openai;
    }
    async suggestPrice(input) {
        const competitorData = input.competitors
            .map((c) => `- ${c.seller}: ${c.price.toFixed(2)} USD (${c.condition}) — ${c.title}`)
            .join('\n');
        const { systemPrompt, userPrompt } = (0, index_js_1.renderPrompt)(pricing_analysis_prompt_js_1.PRICING_ANALYSIS_PROMPT, {
            productTitle: input.productTitle,
            partNumber: input.partNumber,
            brand: input.brand,
            condition: input.condition,
            costPrice: input.costPrice?.toFixed(2) ?? 'N/A',
            retailPrice: input.retailPrice?.toFixed(2) ?? 'N/A',
            mapPrice: input.mapPrice?.toFixed(2) ?? 'N/A',
            competitorData: competitorData || 'No competitor data available',
            totalListings: String(input.marketSummary.totalListings),
            avgPrice: input.marketSummary.avgPrice?.toFixed(2) ?? 'N/A',
            medianPrice: input.marketSummary.medianPrice?.toFixed(2) ?? 'N/A',
            minPrice: input.marketSummary.minPrice?.toFixed(2) ?? 'N/A',
            maxPrice: input.marketSummary.maxPrice?.toFixed(2) ?? 'N/A',
        });
        const response = await this.openai.chat({
            ...(input.model ? { model: input.model } : {}),
            systemPrompt,
            userPrompt,
            jsonMode: true,
            temperature: pricing_analysis_prompt_js_1.PRICING_ANALYSIS_PROMPT.temperature,
            maxTokens: pricing_analysis_prompt_js_1.PRICING_ANALYSIS_PROMPT.maxTokens,
        });
        const parsed = response.content;
        const result = {
            suggestedPrice: this.num(parsed.suggestedPrice) ?? input.retailPrice ?? 0,
            reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
            marketPosition: this.validPosition(parsed.marketPosition),
            confidence: this.num(parsed.confidence) ?? 0,
            minViablePrice: this.num(parsed.minViablePrice) ?? input.costPrice ?? 0,
            maxRecommendedPrice: this.num(parsed.maxRecommendedPrice) ?? 999999,
            marginPercent: this.num(parsed.marginPercent) ?? 0,
            competitorCount: this.num(parsed.competitorCount) ?? 0,
            pricingStrategy: this.validStrategy(parsed.pricingStrategy),
            actionItems: Array.isArray(parsed.actionItems)
                ? parsed.actionItems
                : [],
            rawResponse: response,
        };
        if (input.mapPrice && result.suggestedPrice < input.mapPrice) {
            result.suggestedPrice = input.mapPrice;
            result.reasoning += ' (adjusted to MAP floor)';
        }
        if (input.costPrice && result.suggestedPrice < input.costPrice) {
            result.suggestedPrice = input.costPrice;
            result.reasoning += ' (adjusted to cost floor)';
        }
        this.logger.log(`Pricing suggestion for "${input.productTitle}": $${result.suggestedPrice.toFixed(2)} ` +
            `(${result.pricingStrategy}, confidence=${result.confidence}) cost=$${response.estimatedCostUsd.toFixed(4)}`);
        return result;
    }
    num(val) {
        const n = Number(val);
        return isNaN(n) ? null : n;
    }
    validPosition(val) {
        const s = String(val);
        if (s === 'below_average' || s === 'average' || s === 'above_average')
            return s;
        return 'average';
    }
    validStrategy(val) {
        const s = String(val);
        if (s === 'undercut' || s === 'match' || s === 'premium' || s === 'value')
            return s;
        return 'match';
    }
};
exports.PricingAnalysisPipeline = PricingAnalysisPipeline;
exports.PricingAnalysisPipeline = PricingAnalysisPipeline = PricingAnalysisPipeline_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_js_1.OpenAiService])
], PricingAnalysisPipeline);
//# sourceMappingURL=pricing-analysis.pipeline.js.map