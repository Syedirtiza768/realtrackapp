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
var InventoryAutoTriggerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryAutoTriggerService = exports.INLINE_ENRICH_STAGES = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const pipeline_job_entity_js_1 = require("../ingestion/entities/pipeline-job.entity.js");
const enrichment_retry_service_js_1 = require("./enrichment-retry.service.js");
exports.INLINE_ENRICH_STAGES = {
    VISION_LOOKUP: 'vision_lookup',
    ENRICHMENT: 'enrichment',
    GENERATING_US: 'generating_us',
    GENERATING_AU: 'generating_au',
    GENERATING_DE: 'generating_de',
    COMPLETED: 'completed',
    NEEDS_REVIEW: 'needs_review',
    FAILED: 'failed',
};
const INLINE_RUNNING_STAGES = new Set([
    exports.INLINE_ENRICH_STAGES.VISION_LOOKUP,
    exports.INLINE_ENRICH_STAGES.ENRICHMENT,
    exports.INLINE_ENRICH_STAGES.GENERATING_US,
    exports.INLINE_ENRICH_STAGES.GENERATING_AU,
    exports.INLINE_ENRICH_STAGES.GENERATING_DE,
]);
const REENRICHABLE_STAGES = new Set([
    exports.INLINE_ENRICH_STAGES.FAILED,
    exports.INLINE_ENRICH_STAGES.NEEDS_REVIEW,
    exports.INLINE_ENRICH_STAGES.COMPLETED,
    ...INLINE_RUNNING_STAGES,
]);
const RUNNING_PIPELINE_STATUSES = new Set([
    'pending',
    'uploading',
    'vin_decode',
    'category_mapping',
    'enrichment',
    'validation',
    'output_generation',
]);
const RUNNING_OPTIMIZATION_STATUSES = new Set(['pending', 'running']);
let InventoryAutoTriggerService = InventoryAutoTriggerService_1 = class InventoryAutoTriggerService {
    inventoryQueue;
    listingRepo;
    pipelineJobRepo;
    retryService;
    logger = new common_1.Logger(InventoryAutoTriggerService_1.name);
    constructor(inventoryQueue, listingRepo, pipelineJobRepo, retryService) {
        this.inventoryQueue = inventoryQueue;
        this.listingRepo = listingRepo;
        this.pipelineJobRepo = pipelineJobRepo;
        this.retryService = retryService;
    }
    deriveStatus(listing, pipelineJob) {
        const stage = listing
            .enrichmentStage;
        if (stage) {
            if (INLINE_RUNNING_STAGES.has(stage))
                return 'enriching';
            if (stage === exports.INLINE_ENRICH_STAGES.COMPLETED)
                return 'completed';
            if (stage === exports.INLINE_ENRICH_STAGES.NEEDS_REVIEW)
                return 'needs_review';
            if (stage === exports.INLINE_ENRICH_STAGES.FAILED) {
                return this.retryService.getFailureUiClass(listing.enrichmentLastFailureReason, this.parseImageUrls(listing.itemPhotoUrl).length) === 'needs_review'
                    ? 'needs_review'
                    : 'failed';
            }
        }
        if (pipelineJob) {
            const optStatus = pipelineJob
                .optimizationStatus;
            if (optStatus) {
                if (RUNNING_OPTIMIZATION_STATUSES.has(optStatus))
                    return 'enriching';
                if (optStatus === 'completed')
                    return 'completed';
                if (optStatus === 'needs_review')
                    return 'needs_review';
                if (optStatus === 'failed')
                    return 'failed';
            }
            if (pipelineJob.status === 'completed')
                return 'completed';
            if (pipelineJob.status === 'failed')
                return 'failed';
            if (pipelineJob.status &&
                RUNNING_PIPELINE_STATUSES.has(pipelineJob.status)) {
                return 'enriching';
            }
            return 'enriching';
        }
        const imageCount = this.parseImageUrls(listing.itemPhotoUrl).length;
        if (imageCount >= 2)
            return 'ready';
        return 'idle';
    }
    async queryStatus(listingId) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing || listing.deletedAt)
            return 'idle';
        let pipelineJob = null;
        if (listing.pipelineJobId) {
            pipelineJob = await this.pipelineJobRepo.findOne({
                where: { id: listing.pipelineJobId },
            });
        }
        return this.deriveStatus(listing, pipelineJob);
    }
    async queryStatusWithStage(listingId) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing || listing.deletedAt)
            return { status: 'idle', stage: null };
        let pipelineJob = null;
        if (listing.pipelineJobId) {
            pipelineJob = await this.pipelineJobRepo.findOne({
                where: { id: listing.pipelineJobId },
            });
        }
        return {
            status: this.deriveStatus(listing, pipelineJob),
            stage: listing.enrichmentStage,
        };
    }
    async enqueueAutoEnrich(listingId, options) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing || listing.deletedAt) {
            return { queued: false, reason: 'listing_not_found' };
        }
        const imageCount = this.parseImageUrls(listing.itemPhotoUrl).length;
        if (imageCount < 2) {
            this.logger.debug(`Auto-enrich skipped for listing ${listingId}: only ${imageCount} photo(s); two are required for part identification`);
            return { queued: false, reason: 'insufficient_photos' };
        }
        const stage = listing.enrichmentStage;
        const force = options?.force === true;
        if (!force && listing.enrichmentPermanentFail) {
            this.logger.debug(`Auto-enrich skipped for listing ${listingId}: permanently failed (${listing.enrichmentLastFailureReason})`);
            return { queued: false, reason: 'permanently_failed' };
        }
        if (!force) {
            if (stage === exports.INLINE_ENRICH_STAGES.COMPLETED) {
                return { queued: false, reason: 'already_completed' };
            }
            if (stage && INLINE_RUNNING_STAGES.has(stage)) {
                const pendingJobs = await this.inventoryQueue.getJobs([
                    'waiting',
                    'active',
                    'delayed',
                ]);
                const alreadyQueued = pendingJobs.some((job) => job.name === 'auto-enrich' &&
                    job.data.listingId === listingId);
                if (alreadyQueued) {
                    return { queued: false, reason: 'already_running' };
                }
            }
        }
        else if (stage && REENRICHABLE_STAGES.has(stage)) {
            await this.listingRepo.update(listingId, {
                enrichmentStage: null,
            });
            await this.retryService.resetRetryState(listingId);
        }
        const pendingJobs = await this.inventoryQueue.getJobs([
            'waiting',
            'active',
            'delayed',
        ]);
        const duplicate = pendingJobs.some((job) => job.name === 'auto-enrich' &&
            job.data.listingId === listingId);
        if (duplicate) {
            return { queued: false, reason: 'already_queued' };
        }
        await this.inventoryQueue.add('auto-enrich', { listingId, force: force || false }, {
            attempts: 1,
            removeOnComplete: 50,
            removeOnFail: 100,
        });
        this.logger.log(`Auto-enrich job enqueued for listing ${listingId}${force ? ' (force)' : ''}`);
        return { queued: true };
    }
    parseImageUrls(raw) {
        if (!raw?.trim())
            return [];
        return raw
            .split('|')
            .map((u) => u.trim())
            .filter(Boolean);
    }
};
exports.InventoryAutoTriggerService = InventoryAutoTriggerService;
exports.InventoryAutoTriggerService = InventoryAutoTriggerService = InventoryAutoTriggerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('inventory')),
    __param(1, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(2, (0, typeorm_1.InjectRepository)(pipeline_job_entity_js_1.PipelineJob)),
    __metadata("design:paramtypes", [Function, typeorm_2.Repository,
        typeorm_2.Repository,
        enrichment_retry_service_js_1.EnrichmentRetryService])
], InventoryAutoTriggerService);
//# sourceMappingURL=inventory-auto-trigger.service.js.map