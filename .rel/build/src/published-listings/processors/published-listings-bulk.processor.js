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
var PublishedListingsBulkProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsBulkProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const published_listings_action_service_js_1 = require("../services/published-listings-action.service.js");
const published_listings_sync_service_js_1 = require("../services/published-listings-sync.service.js");
const published_listings_health_service_js_1 = require("../services/published-listings-health.service.js");
const published_listings_pricing_service_js_1 = require("../services/published-listings-pricing.service.js");
const ebay_published_listing_bulk_job_entity_js_1 = require("../entities/ebay-published-listing-bulk-job.entity.js");
const ebay_published_listing_bulk_job_item_entity_js_1 = require("../entities/ebay-published-listing-bulk-job-item.entity.js");
const ebay_published_listing_entity_js_1 = require("../entities/ebay-published-listing.entity.js");
const user_entity_js_1 = require("../../auth/entities/user.entity.js");
let PublishedListingsBulkProcessor = PublishedListingsBulkProcessor_1 = class PublishedListingsBulkProcessor extends bullmq_1.WorkerHost {
    jobRepo;
    itemRepo;
    listingRepo;
    userRepo;
    actions;
    sync;
    health;
    pricing;
    logger = new common_1.Logger(PublishedListingsBulkProcessor_1.name);
    constructor(jobRepo, itemRepo, listingRepo, userRepo, actions, sync, health, pricing) {
        super();
        this.jobRepo = jobRepo;
        this.itemRepo = itemRepo;
        this.listingRepo = listingRepo;
        this.userRepo = userRepo;
        this.actions = actions;
        this.sync = sync;
        this.health = health;
        this.pricing = pricing;
    }
    async process(job) {
        const { bulkJobId, organizationId, userId } = job.data;
        const bulkJob = await this.jobRepo.findOneBy({ id: bulkJobId });
        if (!bulkJob)
            return;
        bulkJob.status = 'running';
        await this.jobRepo.save(bulkJob);
        const user = await this.userRepo.findOneBy({ id: userId });
        if (!user) {
            bulkJob.status = 'failed';
            bulkJob.completedAt = new Date();
            await this.jobRepo.save(bulkJob);
            return;
        }
        const items = await this.itemRepo.find({ where: { bulkJobId } });
        let successCount = 0;
        let failureCount = 0;
        for (const item of items) {
            const listing = await this.listingRepo.findOneBy({
                id: item.publishedListingId,
            });
            if (!listing) {
                item.status = 'failed';
                item.errorMessage = 'Listing not found';
                item.processedAt = new Date();
                await this.itemRepo.save(item);
                failureCount += 1;
                continue;
            }
            try {
                await this.processItem(bulkJob, listing, user, organizationId);
                const refreshed = await this.listingRepo.findOneByOrFail({
                    id: listing.id,
                });
                item.status = 'success';
                item.afterSnapshot = {
                    title: refreshed.title,
                    price: refreshed.price,
                    quantityAvailable: refreshed.quantityAvailable,
                    listingStatus: refreshed.listingStatus,
                };
                item.processedAt = new Date();
                await this.itemRepo.save(item);
                successCount += 1;
            }
            catch (e) {
                item.status = 'failed';
                item.errorMessage = e instanceof Error ? e.message : String(e);
                item.processedAt = new Date();
                await this.itemRepo.save(item);
                failureCount += 1;
            }
        }
        bulkJob.successCount = successCount;
        bulkJob.failureCount = failureCount;
        bulkJob.status =
            failureCount === 0
                ? 'completed'
                : successCount === 0
                    ? 'failed'
                    : 'partial';
        bulkJob.completedAt = new Date();
        await this.jobRepo.save(bulkJob);
        this.logger.log(`Bulk job ${bulkJobId} finished: ${successCount} ok, ${failureCount} failed`);
    }
    async processItem(job, listing, user, organizationId) {
        const payload = job.actionPayload ?? {};
        switch (job.actionType) {
            case 'update_price': {
                const mode = payload.mode ?? 'set';
                const value = Number(payload.value ?? 0);
                let newPrice = Number(listing.price ?? 0);
                if (mode === 'set')
                    newPrice = value;
                else if (mode === 'increase_percent')
                    newPrice *= 1 + value / 100;
                else if (mode === 'decrease_percent')
                    newPrice *= 1 - value / 100;
                else if (mode === 'increase_amount')
                    newPrice += value;
                else if (mode === 'decrease_amount')
                    newPrice -= value;
                await this.actions.revise(listing.id, organizationId, user, {
                    price: Math.max(0.01, Math.round(newPrice * 100) / 100),
                });
                break;
            }
            case 'update_quantity':
                await this.actions.revise(listing.id, organizationId, user, {
                    quantity: Number(payload.quantity ?? payload.value ?? 0),
                });
                break;
            case 'update_title':
                await this.actions.revise(listing.id, organizationId, user, {
                    title: String(payload.title ?? ''),
                });
                break;
            case 'update_description':
                await this.actions.revise(listing.id, organizationId, user, {
                    description: String(payload.description ?? ''),
                });
                break;
            case 'update_policies': {
                await this.actions.updatePolicies(listing.id, organizationId, user, {
                    fulfillmentPolicyId: payload.fulfillmentPolicyId,
                    paymentPolicyId: payload.paymentPolicyId,
                    returnPolicyId: payload.returnPolicyId,
                    shippingProfileName: payload.shippingProfileName,
                    returnProfileName: payload.returnProfileName,
                    paymentProfileName: payload.paymentProfileName,
                });
                break;
            }
            case 'end_listing':
                await this.actions.endListing(listing.id, organizationId, user);
                break;
            case 'sync':
                await this.sync.syncListingById(listing.id, organizationId);
                break;
            case 'health_check': {
                const refreshed = await this.sync.syncListingById(listing.id, organizationId);
                refreshed.healthFlags = this.health.computeHealthFlags({
                    title: refreshed.title,
                    imageUrls: refreshed.imageUrls,
                    itemSpecifics: refreshed.itemSpecifics,
                    compatibility: refreshed.compatibility,
                    quantityAvailable: refreshed.quantityAvailable,
                    quantitySold: refreshed.quantitySold,
                    performanceMetrics: refreshed.performanceMetrics,
                    categoryId: refreshed.categoryId,
                    price: refreshed.price,
                    competitorPricing: refreshed.performanceMetrics?.competitorPricing ?? null,
                });
                await this.listingRepo.save(refreshed);
                break;
            }
            case 'competitor_pricing':
                await this.pricing.refreshCompetitorPricing(listing.id, organizationId);
                break;
            default:
                throw new Error(`Unknown bulk action: ${job.actionType}`);
        }
    }
};
exports.PublishedListingsBulkProcessor = PublishedListingsBulkProcessor;
exports.PublishedListingsBulkProcessor = PublishedListingsBulkProcessor = PublishedListingsBulkProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('published-listings-bulk'),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_published_listing_bulk_job_entity_js_1.EbayPublishedListingBulkJob)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_published_listing_bulk_job_item_entity_js_1.EbayPublishedListingBulkJobItem)),
    __param(2, (0, typeorm_1.InjectRepository)(ebay_published_listing_entity_js_1.EbayPublishedListing)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_js_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        published_listings_action_service_js_1.PublishedListingsActionService,
        published_listings_sync_service_js_1.PublishedListingsSyncService,
        published_listings_health_service_js_1.PublishedListingsHealthService,
        published_listings_pricing_service_js_1.PublishedListingsPricingService])
], PublishedListingsBulkProcessor);
//# sourceMappingURL=published-listings-bulk.processor.js.map