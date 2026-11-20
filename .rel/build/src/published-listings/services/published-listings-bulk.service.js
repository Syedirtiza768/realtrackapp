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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsBulkService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_2 = require("typeorm");
const ebay_published_listing_entity_js_1 = require("../entities/ebay-published-listing.entity.js");
const ebay_published_listing_bulk_job_entity_js_1 = require("../entities/ebay-published-listing-bulk-job.entity.js");
const ebay_published_listing_bulk_job_item_entity_js_1 = require("../entities/ebay-published-listing-bulk-job-item.entity.js");
let PublishedListingsBulkService = class PublishedListingsBulkService {
    listingRepo;
    jobRepo;
    itemRepo;
    bulkQueue;
    constructor(listingRepo, jobRepo, itemRepo, bulkQueue) {
        this.listingRepo = listingRepo;
        this.jobRepo = jobRepo;
        this.itemRepo = itemRepo;
        this.bulkQueue = bulkQueue;
    }
    async createBulkJob(organizationId, user, dto) {
        if (!dto.listingIds.length) {
            throw new common_1.BadRequestException('At least one listing is required');
        }
        const listings = await this.listingRepo.find({
            where: {
                id: (0, typeorm_2.In)(dto.listingIds),
                organizationId,
            },
        });
        if (listings.length !== dto.listingIds.length) {
            throw new common_1.NotFoundException('One or more listings not found');
        }
        const job = await this.jobRepo.save(this.jobRepo.create({
            organizationId,
            requestedByUserId: user.id,
            actionType: dto.action,
            status: 'pending',
            actionPayload: dto.payload ?? null,
            totalItems: listings.length,
        }));
        for (const listing of listings) {
            await this.itemRepo.save(this.itemRepo.create({
                bulkJobId: job.id,
                publishedListingId: listing.id,
                status: 'pending',
                beforeSnapshot: this.snapshot(listing),
            }));
        }
        await this.bulkQueue.add('process-bulk', { bulkJobId: job.id, organizationId, userId: user.id }, { jobId: `pub-bulk-${job.id}`, removeOnComplete: 100, removeOnFail: 200 });
        return job;
    }
    async getJob(jobId, organizationId) {
        const job = await this.jobRepo.findOne({
            where: { id: jobId, organizationId },
        });
        if (!job)
            throw new common_1.NotFoundException('Bulk job not found');
        const items = await this.itemRepo.find({
            where: { bulkJobId: job.id },
            order: { createdAt: 'ASC' },
        });
        return { job, items };
    }
    snapshot(listing) {
        return {
            title: listing.title,
            price: listing.price,
            quantityAvailable: listing.quantityAvailable,
            listingStatus: listing.listingStatus,
        };
    }
};
exports.PublishedListingsBulkService = PublishedListingsBulkService;
exports.PublishedListingsBulkService = PublishedListingsBulkService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_published_listing_entity_js_1.EbayPublishedListing)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_published_listing_bulk_job_entity_js_1.EbayPublishedListingBulkJob)),
    __param(2, (0, typeorm_1.InjectRepository)(ebay_published_listing_bulk_job_item_entity_js_1.EbayPublishedListingBulkJobItem)),
    __param(3, (0, bullmq_1.InjectQueue)('published-listings-bulk')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository, Function])
], PublishedListingsBulkService);
//# sourceMappingURL=published-listings-bulk.service.js.map