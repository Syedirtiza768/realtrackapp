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
var ReviewService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ingestion_job_entity_js_1 = require("../entities/ingestion-job.entity.js");
const ai_result_entity_js_1 = require("../entities/ai-result.entity.js");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
let ReviewService = ReviewService_1 = class ReviewService {
    jobRepo;
    aiResultRepo;
    listingRepo;
    dataSource;
    logger = new common_1.Logger(ReviewService_1.name);
    constructor(jobRepo, aiResultRepo, listingRepo, dataSource) {
        this.jobRepo = jobRepo;
        this.aiResultRepo = aiResultRepo;
        this.listingRepo = listingRepo;
        this.dataSource = dataSource;
    }
    async listForReview(limit = 20) {
        return this.jobRepo.find({
            where: { reviewStatus: 'needs_review' },
            order: { createdAt: 'ASC' },
            take: limit,
        });
    }
    async approve(jobId, dto, reviewerId) {
        const job = await this.jobRepo.findOneBy({ id: jobId });
        if (!job)
            throw new common_1.NotFoundException(`Job ${jobId} not found`);
        const aiResult = await this.aiResultRepo.findOneBy({ jobId });
        if (!aiResult)
            throw new common_1.NotFoundException(`No AI result for job ${jobId}`);
        return this.dataSource.transaction(async (manager) => {
            const corrections = dto.corrections ?? {};
            const title = corrections['title'] ??
                aiResult.extractedTitle ??
                'Untitled Part';
            const brand = corrections['brand'] ?? aiResult.extractedBrand;
            const mpn = corrections['mpn'] ?? aiResult.extractedMpn;
            const listing = manager.create(listing_record_entity_js_1.ListingRecord, {
                title,
                cBrand: brand,
                cManufacturerPartNumber: mpn,
                cOeOemPartNumber: aiResult.extractedOemNumber,
                cType: aiResult.extractedPartType,
                conditionId: aiResult.extractedCondition,
                startPrice: aiResult.extractedPriceEstimate?.toString(),
                description: aiResult.extractedDescription,
                status: 'draft',
                sourceFileName: 'ai-ingestion',
                sourceFilePath: 'ai-ingestion',
                origin: listing_record_entity_js_1.ListingOrigin.PIPELINE_IMPORT,
                sourceRowNumber: 0,
            });
            const savedListing = await manager.save(listing);
            job.status = 'approved';
            job.reviewStatus = 'approved';
            job.reviewedBy = reviewerId ?? null;
            job.reviewedAt = new Date();
            job.reviewNotes = dto.reason ?? null;
            job.listingId = savedListing.id;
            await manager.save(job);
            this.logger.log(`Job ${jobId} approved → listing ${savedListing.id} created`);
            return { job, listing: savedListing };
        });
    }
    async reject(jobId, dto, reviewerId) {
        const job = await this.jobRepo.findOneBy({ id: jobId });
        if (!job)
            throw new common_1.NotFoundException(`Job ${jobId} not found`);
        job.status = 'rejected';
        job.reviewStatus = 'rejected';
        job.reviewedBy = reviewerId ?? null;
        job.reviewedAt = new Date();
        job.reviewNotes = dto.reason ?? null;
        await this.jobRepo.save(job);
        this.logger.log(`Job ${jobId} rejected: ${dto.reason ?? 'no reason'}`);
        return job;
    }
};
exports.ReviewService = ReviewService;
exports.ReviewService = ReviewService = ReviewService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ingestion_job_entity_js_1.IngestionJob)),
    __param(1, (0, typeorm_1.InjectRepository)(ai_result_entity_js_1.AiResult)),
    __param(2, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], ReviewService);
//# sourceMappingURL=review.service.js.map