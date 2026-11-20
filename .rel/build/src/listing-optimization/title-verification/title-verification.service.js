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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TitleVerificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TitleVerificationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
const pipeline_job_entity_js_1 = require("../../ingestion/entities/pipeline-job.entity.js");
const openai_service_js_1 = require("../../common/openai/openai.service.js");
const title_part_verification_prompt_js_1 = require("../../common/openai/prompts/title-part-verification.prompt.js");
const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite';
let TitleVerificationService = TitleVerificationService_1 = class TitleVerificationService {
    productRepo;
    jobRepo;
    openAi;
    logger = new common_1.Logger(TitleVerificationService_1.name);
    constructor(productRepo, jobRepo, openAi) {
        this.productRepo = productRepo;
        this.jobRepo = jobRepo;
        this.openAi = openAi;
    }
    async verifyJob(jobId) {
        const pipelineJob = await this.jobRepo.findOneBy({ id: jobId });
        if (!pipelineJob) {
            throw new common_1.NotFoundException(`Pipeline job ${jobId} not found`);
        }
        const products = await this.productRepo.find({
            where: { pipelineJobId: jobId },
            select: [
                'id',
                'title',
                'partType',
                'mpn',
                'oemPartNumber',
                'brand',
                'categoryName',
            ],
            order: { id: 'ASC' },
        });
        await this.jobRepo.update(jobId, {
            titleVerificationStatus: 'running',
            titleVerificationTotal: products.length,
            titleVerificationProcessed: 0,
            titleVerificationFlaggedCount: 0,
            titleVerificationCostUsd: 0,
        });
        if (products.length === 0) {
            await this.jobRepo.update(jobId, {
                titleVerificationStatus: 'completed',
            });
            return {
                jobId,
                status: 'completed',
                totalProducts: 0,
                processedProducts: 0,
                flaggedCount: 0,
                unprocessedProductIds: [],
                estimatedCostUsd: 0,
            };
        }
        const model = process.env.TITLE_VERIFICATION_MODEL || DEFAULT_MODEL;
        const batchSize = Math.max(1, Number(process.env.TITLE_VERIFICATION_BATCH_SIZE ?? '25') || 25);
        const concurrency = Math.max(1, Number(process.env.TITLE_VERIFICATION_CONCURRENCY ?? '5') || 5);
        const chunkTimeoutMs = Math.max(1000, Number(process.env.TITLE_VERIFICATION_CHUNK_TIMEOUT_MS ?? '30000') ||
            30000);
        const chunks = [];
        for (let i = 0; i < products.length; i += batchSize) {
            chunks.push(products.slice(i, i + batchSize));
        }
        this.logger.log(`Title verification for job ${jobId}: ${products.length} products, ${chunks.length} batches of up to ${batchSize}, concurrency ${concurrency}, model ${model}`);
        let processed = 0;
        let flaggedCount = 0;
        let costUsd = 0;
        const unprocessedProductIds = [];
        await this.mapWithConcurrency(chunks, concurrency, async (chunk) => {
            const chunkIds = chunk.map((p) => p.id);
            try {
                const items = chunk.map((p) => ({
                    id: p.id,
                    title: p.title,
                    partType: p.partType,
                    mpn: p.mpn,
                    oemPartNumber: p.oemPartNumber,
                    brand: p.brand,
                    categoryName: p.categoryName,
                }));
                const response = await Promise.race([
                    this.openAi.chat({
                        systemPrompt: title_part_verification_prompt_js_1.TITLE_PART_VERIFICATION_PROMPT.systemPrompt,
                        userPrompt: `Verify title/part consistency for these ${items.length} items:\n\n${JSON.stringify(items)}\n\n${title_part_verification_prompt_js_1.TITLE_PART_VERIFICATION_PROMPT.userPrompt}`,
                        jsonMode: true,
                        temperature: title_part_verification_prompt_js_1.TITLE_PART_VERIFICATION_PROMPT.temperature,
                        maxTokens: title_part_verification_prompt_js_1.TITLE_PART_VERIFICATION_PROMPT.maxTokens,
                        model,
                        costLane: 'title-verification',
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`Title verification batch of ${chunk.length} timed out after ${chunkTimeoutMs}ms`)), chunkTimeoutMs)),
                ]);
                costUsd += response.estimatedCostUsd;
                const parsed = response.content;
                const resultsById = new Map();
                for (const r of parsed?.results ?? []) {
                    if (r && typeof r.id === 'string')
                        resultsById.set(r.id, r);
                }
                for (const product of chunk) {
                    const result = resultsById.get(product.id);
                    if (!result) {
                        this.logger.warn(`Title verification: no result returned for product ${product.id} in job ${jobId} — leaving unprocessed`);
                        unprocessedProductIds.push(product.id);
                        continue;
                    }
                    processed += 1;
                    if (result.match === false) {
                        flaggedCount += 1;
                        await this.flagTitleMismatch(product.id, result);
                    }
                }
            }
            catch (err) {
                this.logger.error(`Title verification batch failed for job ${jobId} (${chunk.length} products): ${String(err)}`);
                unprocessedProductIds.push(...chunkIds);
            }
            await this.jobRepo.update(jobId, {
                titleVerificationProcessed: processed,
                titleVerificationFlaggedCount: flaggedCount,
                titleVerificationCostUsd: costUsd,
            });
        });
        const status = unprocessedProductIds.length > 0 ? 'partial' : 'completed';
        await this.jobRepo.update(jobId, {
            titleVerificationStatus: status,
        });
        return {
            jobId,
            status,
            totalProducts: products.length,
            processedProducts: processed,
            flaggedCount,
            unprocessedProductIds,
            estimatedCostUsd: costUsd,
        };
    }
    async flagTitleMismatch(productId, result) {
        const warning = {
            code: 'TITLE_PART_MISMATCH',
            severity: 'warning',
            message: result.issue ?? 'Title does not match identified part',
            field: 'title',
            confidence: result.confidence,
            source: 'title-verification',
            detectedAt: new Date().toISOString(),
        };
        await this.productRepo.query(`UPDATE catalog_products
          SET optimization_warnings = COALESCE(optimization_warnings, '[]'::jsonb) || $2::jsonb,
              manual_review = true,
              optimization_status = 'needs_review',
              "updatedAt" = NOW()
        WHERE id = $1`, [productId, JSON.stringify([warning])]);
    }
    async mapWithConcurrency(items, concurrency, fn) {
        const results = new Array(items.length);
        let nextIndex = 0;
        const worker = async () => {
            while (true) {
                const i = nextIndex++;
                if (i >= items.length)
                    return;
                results[i] = await fn(items[i], i);
            }
        };
        await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
        return results;
    }
};
exports.TitleVerificationService = TitleVerificationService;
exports.TitleVerificationService = TitleVerificationService = TitleVerificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(1, (0, typeorm_1.InjectRepository)(pipeline_job_entity_js_1.PipelineJob)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        openai_service_js_1.OpenAiService])
], TitleVerificationService);
//# sourceMappingURL=title-verification.service.js.map