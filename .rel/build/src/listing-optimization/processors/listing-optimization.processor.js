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
var ListingOptimizationProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingOptimizationProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const listing_optimization_service_js_1 = require("../listing-optimization.service.js");
const ebay_fitment_publish_service_js_1 = require("../ebay-fitment-publish.service.js");
const CONCURRENCY = Math.max(1, Number(process.env.LISTING_OPTIMIZATION_CONCURRENCY ?? '3') || 3);
let ListingOptimizationProcessor = ListingOptimizationProcessor_1 = class ListingOptimizationProcessor extends bullmq_1.WorkerHost {
    optimization;
    ebayFitmentPublish;
    logger = new common_1.Logger(ListingOptimizationProcessor_1.name);
    constructor(optimization, ebayFitmentPublish) {
        super();
        this.optimization = optimization;
        this.ebayFitmentPublish = ebayFitmentPublish;
    }
    async process(job) {
        const { jobId, productId, marketplace = 'US', force = false } = job.data;
        if (productId) {
            this.logger.log(`Starting single-product listing optimization for product ${productId} [${marketplace}]${force ? ' (force)' : ''}`);
            try {
                await this.optimization.optimizeProduct(productId, marketplace, {
                    force,
                });
                if (job.data.publishAfterOptimization) {
                    await this.ebayFitmentPublish.publishValidatedFitment(productId, marketplace);
                }
                this.logger.log(`Completed listing optimization for product ${productId} [${marketplace}]`);
            }
            catch (err) {
                this.logger.error(`Listing optimization crashed for product ${productId} [${marketplace}]: ${String(err)}`);
                await this.optimization
                    .markProductOptimizationFailed(productId, String(err))
                    .catch(() => { });
                throw err;
            }
            return;
        }
        if (!jobId) {
            this.logger.error(`Listing optimization job has neither jobId nor productId: ${JSON.stringify(job.data)}`);
            return;
        }
        this.logger.log(`Starting mandatory listing optimization for pipeline job ${jobId} [${marketplace}]`);
        try {
            await this.optimization.enqueueJobOptimization(jobId, marketplace, job, {
                force,
            });
            this.logger.log(`Completed listing optimization for pipeline job ${jobId} [${marketplace}]`);
        }
        catch (err) {
            this.logger.error(`Listing optimization crashed for pipeline job ${jobId} [${marketplace}]: ${String(err)}`);
            await this.optimization
                .markJobOptimizationFailed(jobId, marketplace)
                .catch(() => { });
            throw err;
        }
    }
    async onFailed(job) {
        if (!job)
            return;
        const maxAttempts = job.opts?.attempts ?? 1;
        if (job.attemptsMade < maxAttempts)
            return;
        const { jobId, productId, marketplace = 'US' } = job.data;
        if (productId) {
            this.logger.error(`Listing optimization for product ${productId} [${marketplace}] permanently failed after ${job.attemptsMade} attempts: ${job.failedReason}`);
            await this.optimization
                .markProductOptimizationFailed(productId, job.failedReason ?? 'Optimization failed')
                .catch(() => { });
            return;
        }
        if (!jobId)
            return;
        this.logger.error(`Listing optimization for pipeline job ${jobId} [${marketplace}] permanently failed after ${job.attemptsMade} attempts: ${job.failedReason}`);
        await this.optimization
            .markJobOptimizationFailed(jobId, marketplace)
            .catch(() => { });
    }
};
exports.ListingOptimizationProcessor = ListingOptimizationProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ListingOptimizationProcessor.prototype, "onFailed", null);
exports.ListingOptimizationProcessor = ListingOptimizationProcessor = ListingOptimizationProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('listing-optimization', {
        concurrency: CONCURRENCY,
        lockDuration: 120 * 60 * 1000,
        maxStalledCount: 2,
        stalledInterval: 30_000,
    }),
    __metadata("design:paramtypes", [listing_optimization_service_js_1.ListingOptimizationService,
        ebay_fitment_publish_service_js_1.EbayFitmentPublishService])
], ListingOptimizationProcessor);
//# sourceMappingURL=listing-optimization.processor.js.map