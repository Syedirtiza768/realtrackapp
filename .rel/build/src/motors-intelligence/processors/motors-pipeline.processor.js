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
var MotorsPipelineProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotorsPipelineProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const motors_intelligence_service_1 = require("../services/motors-intelligence.service");
const ebay_enrichment_service_1 = require("../services/ebay-enrichment.service");
let MotorsPipelineProcessor = MotorsPipelineProcessor_1 = class MotorsPipelineProcessor extends bullmq_1.WorkerHost {
    motorsService;
    ebayEnrichmentService;
    logger = new common_1.Logger(MotorsPipelineProcessor_1.name);
    constructor(motorsService, ebayEnrichmentService) {
        super();
        this.motorsService = motorsService;
        this.ebayEnrichmentService = ebayEnrichmentService;
    }
    async process(job) {
        const { motorsProductId, stage = 'full', connectionId } = job.data;
        this.logger.log(`Processing Motors pipeline job ${job.id} for product ${motorsProductId} (stage: ${stage})`);
        try {
            await job.updateProgress(0);
            switch (stage) {
                case 'full': {
                    await job.updateProgress(10);
                    const result = await this.motorsService.runPipeline(motorsProductId);
                    if (result.status !== 'failed') {
                        await job.updateProgress(80);
                        try {
                            const enrichment = await this.ebayEnrichmentService.enrichProduct(motorsProductId);
                            this.logger.log(`eBay enrichment completed for ${motorsProductId}: ` +
                                `category=${enrichment.categoryId}, aspects=${enrichment.aspects.length}, ` +
                                `confidence=${enrichment.enrichmentConfidence}`);
                        }
                        catch (err) {
                            this.logger.warn(`eBay enrichment failed (non-blocking): ${err.message}`);
                        }
                    }
                    await job.updateProgress(100);
                    return result;
                }
                case 'enrichment':
                    await job.updateProgress(10);
                    const enrichResult = await this.ebayEnrichmentService.enrichProduct(motorsProductId);
                    await job.updateProgress(100);
                    return enrichResult;
                case 'publish':
                    if (!connectionId) {
                        throw new Error('connectionId required for publish stage');
                    }
                    await job.updateProgress(10);
                    const publishResult = await this.motorsService.publish(motorsProductId, connectionId);
                    await job.updateProgress(100);
                    return publishResult;
                default:
                    await job.updateProgress(10);
                    const defaultResult = await this.motorsService.runPipeline(motorsProductId);
                    await job.updateProgress(100);
                    return defaultResult;
            }
        }
        catch (error) {
            this.logger.error(`Pipeline job ${job.id} failed for product ${motorsProductId}: ${error.message}`, error.stack);
            throw error;
        }
    }
};
exports.MotorsPipelineProcessor = MotorsPipelineProcessor;
exports.MotorsPipelineProcessor = MotorsPipelineProcessor = MotorsPipelineProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('motors-pipeline'),
    __metadata("design:paramtypes", [motors_intelligence_service_1.MotorsIntelligenceService,
        ebay_enrichment_service_1.EbayEnrichmentService])
], MotorsPipelineProcessor);
//# sourceMappingURL=motors-pipeline.processor.js.map