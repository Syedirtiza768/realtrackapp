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
var EnrichmentRetryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnrichmentRetryService = void 0;
exports.classifyFailureForUi = classifyFailureForUi;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const inventory_auto_trigger_service_js_1 = require("./inventory-auto-trigger.service.js");
const MAX_AUTO_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 2 * 60 * 1000;
const RETRY_MULTIPLIER = 4;
const TRANSIENT_MARKERS = [
    'rate limit',
    'ratelimit',
    'rate_limit',
    'rateLimitExceeded',
    'too many requests',
    '429',
    'throttl',
    'temporarily unavailable',
    'service unavailable',
    'bad gateway',
    'gateway timeout',
    'timed out',
    'timeout',
    'etimedout',
    'econnreset',
    'econnrefused',
    'socket hang up',
    'network error',
    '502',
    '503',
    '504',
    'overloaded',
    'insufficient_quota',
    'context_length_exceeded',
    'circuit open',
];
const PERMANENT_MARKERS = [
    'not found',
    'listing has no sku',
    'cannot enrich',
    'invalid',
    'unauthorized',
    'forbidden',
    '401',
    '403',
    'bad request',
    '400',
    'unprocessable',
    '422',
    'deleted',
    'missing required',
    'no images',
    'validation failed',
    'cannot exceed',
    'cannot read propert',
    'is not a function',
    'is not defined',
];
const DATA_GAP_REASON_MARKERS = [
    'client_error_400',
    'client_error_422',
    'missing_required',
    'no_images',
    'listing_has_no_sku',
    'cannot_enrich',
    'validation_failed',
    'cannot_exceed',
];
const PHOTO_IDENTITY_REVIEW_MARKERS = [
    'photos did not confirm this part number',
    'part number could not be verified from photos',
];
function classifyFailureForUi(reason, imageCount) {
    if (!reason)
        return null;
    const normalizedReason = reason.toLowerCase();
    if (normalizedReason.startsWith('permanent_cannot_read_propert') ||
        normalizedReason.startsWith('permanent_is_not_a_function') ||
        normalizedReason.startsWith('permanent_is_not_defined')) {
        return 'code_bug';
    }
    if (PHOTO_IDENTITY_REVIEW_MARKERS.some((marker) => normalizedReason.includes(marker))) {
        return imageCount !== undefined && imageCount < 2
            ? 'needs_data'
            : 'needs_review';
    }
    if (DATA_GAP_REASON_MARKERS.some((marker) => normalizedReason.includes(marker))) {
        return 'needs_data';
    }
    return 'system';
}
let EnrichmentRetryService = EnrichmentRetryService_1 = class EnrichmentRetryService {
    listingRepo;
    inventoryQueue;
    logger = new common_1.Logger(EnrichmentRetryService_1.name);
    constructor(listingRepo, inventoryQueue) {
        this.listingRepo = listingRepo;
        this.inventoryQueue = inventoryQueue;
    }
    getFailureUiClass(reason, imageCount) {
        return classifyFailureForUi(reason, imageCount);
    }
    classifyError(err) {
        const rawMessage = err instanceof Error ? err.message : String(err);
        const normalizedMessage = rawMessage.toLowerCase();
        const httpStatus = this.extractHttpStatus(err);
        if (httpStatus === 429) {
            return {
                classification: 'transient',
                reason: `rate_limited_429: ${rawMessage.slice(0, 200)}`,
                originalError: rawMessage,
            };
        }
        if (httpStatus !== null && httpStatus >= 500 && httpStatus < 600) {
            return {
                classification: 'transient',
                reason: `server_error_${httpStatus}: ${rawMessage.slice(0, 200)}`,
                originalError: rawMessage,
            };
        }
        if (httpStatus === 400 ||
            httpStatus === 401 ||
            httpStatus === 403 ||
            httpStatus === 422) {
            return {
                classification: 'permanent',
                reason: `client_error_${httpStatus}: ${rawMessage.slice(0, 200)}`,
                originalError: rawMessage,
            };
        }
        for (const marker of TRANSIENT_MARKERS) {
            if (normalizedMessage.includes(marker)) {
                return {
                    classification: 'transient',
                    reason: `transient_${marker.replace(/\s+/g, '_')}: ${rawMessage.slice(0, 200)}`,
                    originalError: rawMessage,
                };
            }
        }
        for (const marker of PERMANENT_MARKERS) {
            if (normalizedMessage.includes(marker)) {
                return {
                    classification: 'permanent',
                    reason: `permanent_${marker.replace(/\s+/g, '_')}: ${rawMessage.slice(0, 200)}`,
                    originalError: rawMessage,
                };
            }
        }
        return {
            classification: 'transient',
            reason: `unclassified: ${rawMessage.slice(0, 200)}`,
            originalError: rawMessage,
        };
    }
    async recordFailure(listingId, err) {
        const failure = this.classifyError(err);
        const now = new Date();
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing) {
            this.logger.warn(`Cannot record failure — listing ${listingId} not found`);
            return { shouldRetry: false, classification: failure.classification };
        }
        if (failure.classification === 'permanent') {
            await this.listingRepo.update(listingId, {
                enrichmentStage: inventory_auto_trigger_service_js_1.INLINE_ENRICH_STAGES.FAILED,
                enrichmentPermanentFail: true,
                enrichmentLastFailureReason: failure.reason,
                enrichmentLastFailureAt: now,
                enrichmentNextRetryAt: null,
            });
            this.logger.warn(`Listing ${listingId} enrichment permanently failed (${failure.classification}): ${failure.reason}`);
            return { shouldRetry: false, classification: 'permanent' };
        }
        const newRetryCount = (listing.enrichmentRetryCount ?? 0) + 1;
        if (newRetryCount >= MAX_AUTO_RETRIES) {
            await this.listingRepo.update(listingId, {
                enrichmentStage: inventory_auto_trigger_service_js_1.INLINE_ENRICH_STAGES.FAILED,
                enrichmentPermanentFail: true,
                enrichmentRetryCount: newRetryCount,
                enrichmentLastFailureReason: `exhausted_${MAX_AUTO_RETRIES}_retries: ${failure.reason}`,
                enrichmentLastFailureAt: now,
                enrichmentNextRetryAt: null,
            });
            this.logger.warn(`Listing ${listingId} exhausted ${MAX_AUTO_RETRIES} auto-retries — marking permanent failure. ` +
                `Last reason: ${failure.reason}`);
            return { shouldRetry: false, classification: 'transient' };
        }
        const delayMs = RETRY_BASE_DELAY_MS * Math.pow(RETRY_MULTIPLIER, newRetryCount - 1);
        const nextRetryAt = new Date(now.getTime() + delayMs);
        await this.listingRepo.update(listingId, {
            enrichmentStage: inventory_auto_trigger_service_js_1.INLINE_ENRICH_STAGES.FAILED,
            enrichmentPermanentFail: false,
            enrichmentRetryCount: newRetryCount,
            enrichmentLastFailureReason: failure.reason,
            enrichmentLastFailureAt: now,
            enrichmentNextRetryAt: nextRetryAt,
        });
        this.logger.log(`Listing ${listingId} transient failure — retry ${newRetryCount}/${MAX_AUTO_RETRIES} ` +
            `scheduled at ${nextRetryAt.toISOString()} (in ${Math.round(delayMs / 1000)}s). ` +
            `Reason: ${failure.reason}`);
        return { shouldRetry: true, classification: 'transient' };
    }
    async resetRetryState(listingId) {
        await this.listingRepo.update(listingId, {
            enrichmentRetryCount: 0,
            enrichmentLastFailureReason: null,
            enrichmentLastFailureAt: null,
            enrichmentNextRetryAt: null,
            enrichmentPermanentFail: false,
        });
    }
    async enqueueDueRetries() {
        const now = new Date();
        const dueListings = await this.listingRepo.find({
            where: {
                enrichmentStage: inventory_auto_trigger_service_js_1.INLINE_ENRICH_STAGES.FAILED,
                enrichmentPermanentFail: false,
                enrichmentNextRetryAt: (0, typeorm_2.LessThanOrEqual)(now),
            },
            select: ['id', 'customLabelSku', 'enrichmentRetryCount'],
        });
        if (dueListings.length === 0) {
            return { scanned: 0, enqueued: 0, skipped: 0 };
        }
        this.logger.log(`Enrichment retry scan: found ${dueListings.length} listing(s) due for retry`);
        const pendingJobs = await this.inventoryQueue.getJobs([
            'waiting',
            'active',
            'delayed',
        ]);
        const queuedListingIds = new Set(pendingJobs
            .filter((job) => job.name === 'auto-enrich')
            .map((job) => job.data.listingId));
        let enqueued = 0;
        let skipped = 0;
        for (const listing of dueListings) {
            try {
                const alreadyQueued = queuedListingIds.has(listing.id);
                if (alreadyQueued) {
                    skipped++;
                    continue;
                }
                await this.listingRepo.update(listing.id, {
                    enrichmentStage: null,
                });
                await this.inventoryQueue.add('auto-enrich', { listingId: listing.id, force: false, isAutoRetry: true }, {
                    attempts: 1,
                    removeOnComplete: 50,
                    removeOnFail: 100,
                });
                enqueued++;
                this.logger.log(`Auto-retry enqueued for listing ${listing.id} (SKU ${listing.customLabelSku ?? 'N/A'}, ` +
                    `retry #${(listing.enrichmentRetryCount ?? 0) + 1})`);
            }
            catch (err) {
                skipped++;
                this.logger.error(`Failed to enqueue auto-retry for listing ${listing.id}: ${err instanceof Error ? err.message : err}`);
            }
        }
        return { scanned: dueListings.length, enqueued, skipped };
    }
    async overridePermanentFailure(listingId) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing)
            return false;
        await this.listingRepo.update(listingId, {
            enrichmentStage: null,
            enrichmentPermanentFail: false,
            enrichmentRetryCount: 0,
            enrichmentLastFailureReason: null,
            enrichmentLastFailureAt: null,
            enrichmentNextRetryAt: null,
        });
        this.logger.log(`Manual override: reset permanent failure for listing ${listingId}`);
        return true;
    }
    async recordSuccess(listingId) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing)
            return;
        if ((listing.enrichmentRetryCount ?? 0) > 0 ||
            listing.enrichmentPermanentFail) {
            await this.resetRetryState(listingId);
            this.logger.log(`Listing ${listingId} enrichment succeeded — retry state cleared ` +
                `(was retry #${listing.enrichmentRetryCount ?? 0})`);
        }
    }
    async getRetryStatus(listingId) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
            select: [
                'id',
                'enrichmentRetryCount',
                'enrichmentPermanentFail',
                'enrichmentLastFailureReason',
                'enrichmentLastFailureAt',
                'enrichmentNextRetryAt',
            ],
        });
        if (!listing)
            return null;
        return {
            retryCount: listing.enrichmentRetryCount ?? 0,
            maxRetries: MAX_AUTO_RETRIES,
            permanentFail: listing.enrichmentPermanentFail ?? false,
            lastFailureReason: listing.enrichmentLastFailureReason,
            lastFailureAt: listing.enrichmentLastFailureAt,
            nextRetryAt: listing.enrichmentNextRetryAt,
            isRateLimit: listing.enrichmentLastFailureReason?.startsWith('rate_limited') ??
                false,
        };
    }
    extractHttpStatus(err) {
        if (!err || typeof err !== 'object')
            return null;
        const e = err;
        if (typeof e.status === 'number')
            return e.status;
        if (typeof e.statusCode === 'number')
            return e.statusCode;
        const response = e.response;
        if (response && typeof response.status === 'number')
            return response.status;
        return null;
    }
};
exports.EnrichmentRetryService = EnrichmentRetryService;
exports.EnrichmentRetryService = EnrichmentRetryService = EnrichmentRetryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(1, (0, bullmq_1.InjectQueue)('inventory')),
    __metadata("design:paramtypes", [typeorm_2.Repository, Function])
], EnrichmentRetryService);
//# sourceMappingURL=enrichment-retry.service.js.map