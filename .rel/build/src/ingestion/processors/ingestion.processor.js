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
var IngestionProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const ingestion_job_entity_js_1 = require("../entities/ingestion-job.entity.js");
const ai_result_entity_js_1 = require("../entities/ai-result.entity.js");
const image_asset_entity_js_1 = require("../../storage/entities/image-asset.entity.js");
const ai_service_js_1 = require("../ai/ai.service.js");
const storage_service_js_1 = require("../../storage/storage.service.js");
const AUTO_APPROVE_THRESHOLD = 0.85;
let IngestionProcessor = IngestionProcessor_1 = class IngestionProcessor extends bullmq_1.WorkerHost {
    jobRepo;
    aiResultRepo;
    assetRepo;
    aiService;
    storageService;
    eventEmitter;
    logger = new common_1.Logger(IngestionProcessor_1.name);
    constructor(jobRepo, aiResultRepo, assetRepo, aiService, storageService, eventEmitter) {
        super();
        this.jobRepo = jobRepo;
        this.aiResultRepo = aiResultRepo;
        this.assetRepo = assetRepo;
        this.aiService = aiService;
        this.storageService = storageService;
        this.eventEmitter = eventEmitter;
    }
    async process(job) {
        const { jobId, assetIds, preferredProvider } = job.data;
        this.logger.log(`Processing ingestion job=${jobId}`);
        await this.jobRepo.update(jobId, {
            status: 'processing',
            attemptCount: () => '"attempt_count" + 1',
        });
        try {
            const assets = await this.assetRepo.findByIds(assetIds);
            const imageUrls = assets.map((a) => this.storageService.getCdnUrl(a.s3Key));
            if (imageUrls.length === 0) {
                throw new Error('No images found for this job');
            }
            await this.jobRepo.update(jobId, { aiStartedAt: new Date() });
            const aiResponse = await this.aiService.analyzeImages(imageUrls, preferredProvider);
            const normalized = this.aiService.normalizeResponse(aiResponse);
            const aiResult = this.aiResultRepo.create({
                jobId,
                rawResponse: aiResponse.raw,
                provider: aiResponse.provider,
                model: aiResponse.model,
                tokensUsed: aiResponse.tokensUsed,
                latencyMs: aiResponse.latencyMs,
                extractedTitle: normalized.title,
                extractedBrand: normalized.brand,
                extractedMpn: normalized.mpn,
                extractedOemNumber: normalized.oemNumber,
                extractedPartType: normalized.partType,
                extractedCondition: normalized.condition,
                extractedPriceEstimate: normalized.priceEstimate,
                extractedDescription: normalized.description,
                extractedFeatures: normalized.features,
                extractedFitmentRaw: normalized.fitmentRaw,
                confidenceTitle: normalized.confidenceTitle,
                confidenceBrand: normalized.confidenceBrand,
                confidenceMpn: normalized.confidenceMpn,
                confidencePartType: normalized.confidencePartType,
                confidenceOverall: normalized.confidenceOverall,
            });
            await this.aiResultRepo.save(aiResult);
            const passedQualityGate = aiResponse.passedGate !== false;
            const reviewStatus = passedQualityGate &&
                normalized.confidenceOverall >= AUTO_APPROVE_THRESHOLD
                ? 'auto_approved'
                : 'needs_review';
            await this.jobRepo.update(jobId, {
                status: 'ai_complete',
                aiProvider: aiResponse.provider,
                aiModel: aiResponse.model,
                aiCompletedAt: new Date(),
                aiCostUsd: aiResponse.estimatedCostUsd,
                reviewStatus,
            });
            this.logger.log(`Ingestion job ${jobId} complete — confidence=${normalized.confidenceOverall.toFixed(2)}, review=${reviewStatus}`);
            this.eventEmitter.emit('ingestion.completed', {
                jobId,
                title: normalized.title,
            });
            if (reviewStatus === 'needs_review') {
                this.eventEmitter.emit('ingestion.review_needed', {
                    jobId,
                    confidence: normalized.confidenceOverall,
                });
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Ingestion job ${jobId} failed: ${message}`);
            this.eventEmitter.emit('ingestion.failed', {
                jobId,
                error: message,
            });
            const job_record = await this.jobRepo.findOneBy({ id: jobId });
            const attemptCount = job_record?.attemptCount ?? 0;
            const backoffMs = [30_000, 120_000, 600_000][Math.min(attemptCount - 1, 2)] ?? 600_000;
            const nextRetryAt = new Date(Date.now() + backoffMs);
            await this.jobRepo.update(jobId, {
                status: 'failed',
                lastError: message.substring(0, 2000),
                nextRetryAt: attemptCount < (job_record?.maxAttempts ?? 3) ? nextRetryAt : null,
            });
            throw err;
        }
    }
};
exports.IngestionProcessor = IngestionProcessor;
exports.IngestionProcessor = IngestionProcessor = IngestionProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('ingestion', { concurrency: 3 }),
    __param(0, (0, typeorm_1.InjectRepository)(ingestion_job_entity_js_1.IngestionJob)),
    __param(1, (0, typeorm_1.InjectRepository)(ai_result_entity_js_1.AiResult)),
    __param(2, (0, typeorm_1.InjectRepository)(image_asset_entity_js_1.ImageAsset)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ai_service_js_1.AiService,
        storage_service_js_1.StorageService,
        event_emitter_1.EventEmitter2])
], IngestionProcessor);
//# sourceMappingURL=ingestion.processor.js.map