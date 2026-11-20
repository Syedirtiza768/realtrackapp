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
var ListingGenerationPipeline_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingGenerationPipeline = void 0;
const common_1 = require("@nestjs/common");
const openai_service_js_1 = require("../openai.service.js");
const index_js_1 = require("../prompts/index.js");
const listing_generation_prompt_js_1 = require("../prompts/listing-generation.prompt.js");
const listing_generation_de_prompt_js_1 = require("../prompts/listing-generation-de.prompt.js");
const listing_generation_batch_prompt_js_1 = require("../prompts/listing-generation-batch.prompt.js");
const listing_generation_batch_de_prompt_js_1 = require("../prompts/listing-generation-batch-de.prompt.js");
let ListingGenerationPipeline = ListingGenerationPipeline_1 = class ListingGenerationPipeline {
    openai;
    logger = new common_1.Logger(ListingGenerationPipeline_1.name);
    constructor(openai) {
        this.openai = openai;
    }
    async generate(productData, categoryName, condition, options) {
        const marketplace = options?.marketplace ?? 'US';
        const promptTemplate = marketplace === 'DE'
            ? listing_generation_de_prompt_js_1.LISTING_GENERATION_DE_PROMPT
            : listing_generation_prompt_js_1.LISTING_GENERATION_PROMPT;
        const { systemPrompt, userPrompt } = (0, index_js_1.renderPrompt)(promptTemplate, {
            productData: JSON.stringify(productData),
            categoryName,
            condition,
            sellerCountry: options?.sellerCountry ?? 'US',
        });
        const response = await this.openai.chat({
            systemPrompt,
            userPrompt,
            jsonMode: true,
            temperature: options?.temperature ?? promptTemplate.temperature,
            ...(typeof promptTemplate.maxTokens === 'number'
                ? { maxTokens: promptTemplate.maxTokens }
                : {}),
        });
        const parsed = response.content;
        const pricing = (parsed.pricePositioning ?? {});
        const result = {
            title: parsed.title ?? 'Untitled',
            subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle : null,
            description: parsed.description ?? '',
            itemSpecifics: typeof parsed.itemSpecifics === 'object' && parsed.itemSpecifics
                ? parsed.itemSpecifics
                : {},
            bulletPoints: Array.isArray(parsed.bulletPoints)
                ? parsed.bulletPoints
                : [],
            searchTerms: Array.isArray(parsed.searchTerms)
                ? parsed.searchTerms
                : [],
            pricePositioning: {
                suggestedPrice: typeof pricing.suggestedPrice === 'number'
                    ? pricing.suggestedPrice
                    : null,
                rationale: typeof pricing.rationale === 'string' ? pricing.rationale : null,
            },
            rawResponse: response,
        };
        this.logger.log(`Generated listing: "${result.title}" cost=$${response.estimatedCostUsd.toFixed(4)}`);
        return result;
    }
    async generateBatch(items) {
        if (items.length === 0)
            return [];
        const batchSize = Math.max(1, Number(process.env.LISTING_GENERATION_BATCH_SIZE ?? '5') || 5);
        const results = new Array(items.length);
        let i = 0;
        while (i < items.length) {
            const marketplace = items[i].options?.marketplace ?? 'US';
            let end = i + 1;
            while (end < items.length &&
                end - i < batchSize &&
                (items[end].options?.marketplace ?? 'US') === marketplace) {
                end++;
            }
            const chunk = items.slice(i, end);
            if (chunk.length === 1) {
                results[i] = await this.generate(chunk[0].productData, chunk[0].categoryName, chunk[0].condition, chunk[0].options);
            }
            else {
                const chunkResults = await this.generateChunk(chunk, marketplace);
                for (let j = 0; j < chunk.length; j++)
                    results[i + j] = chunkResults[j];
            }
            i = end;
        }
        return results;
    }
    async generateChunk(chunk, marketplace) {
        const promptTemplate = marketplace === 'DE'
            ? listing_generation_batch_de_prompt_js_1.LISTING_GENERATION_BATCH_DE_PROMPT
            : listing_generation_batch_prompt_js_1.LISTING_GENERATION_BATCH_PROMPT;
        const itemsData = chunk.map((item, index) => ({
            index,
            productData: item.productData,
            categoryName: item.categoryName,
            condition: item.condition,
            sellerCountry: item.options?.sellerCountry ?? 'US',
        }));
        const { systemPrompt, userPrompt } = (0, index_js_1.renderPrompt)(promptTemplate, {
            itemsData: JSON.stringify(itemsData),
        });
        try {
            const response = await this.openai.chat({
                systemPrompt,
                userPrompt,
                jsonMode: true,
                temperature: chunk[0].options?.temperature ?? promptTemplate.temperature,
                maxTokens: (promptTemplate.maxTokens ?? 2000) * Math.max(1, chunk.length),
            });
            const parsed = response.content;
            const rawResults = Array.isArray(parsed?.results) ? parsed.results : null;
            if (!rawResults || rawResults.length !== chunk.length) {
                throw new Error(`Batch response had ${rawResults?.length ?? 0} results, expected ${chunk.length}`);
            }
            const byIndex = new Map();
            for (const r of rawResults) {
                if (typeof r.index === 'number')
                    byIndex.set(r.index, r);
            }
            return chunk.map((_, index) => this.toListingResult(byIndex.get(index) ?? rawResults[index], response));
        }
        catch (err) {
            this.logger.warn(`Batched listing generation failed for chunk of ${chunk.length}, falling back to per-item calls: ${String(err)}`);
            const fallback = [];
            for (const item of chunk) {
                fallback.push(await this.generate(item.productData, item.categoryName, item.condition, item.options));
            }
            return fallback;
        }
    }
    toListingResult(parsed, rawResponse) {
        const p = parsed ?? {};
        const pricing = (p.pricePositioning ?? {});
        return {
            title: p.title ?? 'Untitled',
            subtitle: typeof p.subtitle === 'string' ? p.subtitle : null,
            description: p.description ?? '',
            itemSpecifics: typeof p.itemSpecifics === 'object' && p.itemSpecifics
                ? p.itemSpecifics
                : {},
            bulletPoints: Array.isArray(p.bulletPoints)
                ? p.bulletPoints
                : [],
            searchTerms: Array.isArray(p.searchTerms)
                ? p.searchTerms
                : [],
            pricePositioning: {
                suggestedPrice: typeof pricing.suggestedPrice === 'number'
                    ? pricing.suggestedPrice
                    : null,
                rationale: typeof pricing.rationale === 'string' ? pricing.rationale : null,
            },
            rawResponse,
        };
    }
};
exports.ListingGenerationPipeline = ListingGenerationPipeline;
exports.ListingGenerationPipeline = ListingGenerationPipeline = ListingGenerationPipeline_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_js_1.OpenAiService])
], ListingGenerationPipeline);
//# sourceMappingURL=listing-generation.pipeline.js.map