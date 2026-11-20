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
var IngestionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const job_visibility_js_1 = require("../common/utils/job-visibility.js");
const image_asset_entity_js_1 = require("../storage/entities/image-asset.entity.js");
const ingestion_job_entity_js_1 = require("./entities/ingestion-job.entity.js");
const ai_result_entity_js_1 = require("./entities/ai-result.entity.js");
let IngestionService = IngestionService_1 = class IngestionService {
    jobRepo;
    aiResultRepo;
    assetRepo;
    ingestionQueue;
    logger = new common_1.Logger(IngestionService_1.name);
    constructor(jobRepo, aiResultRepo, assetRepo, ingestionQueue) {
        this.jobRepo = jobRepo;
        this.aiResultRepo = aiResultRepo;
        this.assetRepo = assetRepo;
        this.ingestionQueue = ingestionQueue;
    }
    async createJob(dto, userId) {
        const assets = await this.assetRepo.findByIds(dto.assetIds);
        if (assets.length !== dto.assetIds.length) {
            const found = new Set(assets.map((a) => a.id));
            const missing = dto.assetIds.filter((id) => !found.has(id));
            throw new common_1.NotFoundException(`Image assets not found: ${missing.join(', ')}`);
        }
        const job = this.jobRepo.create({
            mode: dto.mode,
            sourceType: dto.source ?? 'upload',
            imageCount: dto.assetIds.length,
            createdBy: userId ?? null,
            status: 'pending',
            reviewStatus: 'pending',
        });
        const saved = await this.jobRepo.save(job);
        await this.assetRepo.update(dto.assetIds.map((id) => id), { jobId: saved.id });
        await this.ingestionQueue.add('process-image', {
            jobId: saved.id,
            assetIds: dto.assetIds,
            mode: dto.mode,
            preferredProvider: dto.preferredProvider ?? 'openai',
        }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
            removeOnComplete: 100,
            removeOnFail: 200,
        });
        this.logger.log(`Created ingestion job ${saved.id} with ${dto.assetIds.length} image(s)`);
        return saved;
    }
    async listJobs(status, limit = 20, offset = 0, viewerId, viewAll = true) {
        const qb = this.jobRepo
            .createQueryBuilder('j')
            .orderBy('j.createdAt', 'DESC');
        if (status) {
            qb.andWhere('j.status = :status', { status });
        }
        if (viewerId) {
            (0, job_visibility_js_1.applyCreatedByVisibility)(qb, 'j', viewerId, viewAll);
        }
        qb.take(limit).skip(offset);
        const [jobs, total] = await qb.getManyAndCount();
        return { jobs, total };
    }
    async getJob(id, viewerId, viewAll = true) {
        const job = await this.jobRepo.findOneBy({ id });
        if (!job) {
            throw new common_1.NotFoundException(`Ingestion job ${id} not found`);
        }
        if (viewerId && !(0, job_visibility_js_1.canViewJob)(job.createdBy, viewerId, viewAll)) {
            throw new common_1.ForbiddenException('You do not have access to this ingestion job');
        }
        const aiResult = await this.aiResultRepo.findOneBy({ jobId: id });
        const images = await this.assetRepo.find({
            where: { jobId: id },
            order: { sortOrder: 'ASC' },
        });
        return { job, aiResult, images };
    }
    async retryJob(id, actorId, viewAll = true) {
        const job = await this.jobRepo.findOneBy({ id });
        if (!job) {
            throw new common_1.NotFoundException(`Ingestion job ${id} not found`);
        }
        if (actorId) {
            (0, job_visibility_js_1.assertCanAccessJob)(job.createdBy, actorId, viewAll);
        }
        if (job.status !== 'failed') {
            throw new Error(`Job ${id} is not in failed state (current: ${job.status})`);
        }
        const assets = await this.assetRepo.find({ where: { jobId: id } });
        const assetIds = assets.map((a) => a.id);
        job.status = 'pending';
        job.attemptCount = 0;
        job.lastError = null;
        job.nextRetryAt = null;
        job.createdBy = (0, job_visibility_js_1.withCreatedByBackfill)(job.createdBy, actorId);
        await this.jobRepo.save(job);
        await this.ingestionQueue.add('process-image', {
            jobId: id,
            assetIds,
            mode: job.mode,
            preferredProvider: job.aiProvider?.replace('_vision', '') ??
                'openai',
        }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
        });
        this.logger.log(`Retried ingestion job ${id}`);
        return job;
    }
    async cancelJob(id, actorId, viewAll = true) {
        const job = await this.jobRepo.findOneBy({ id });
        if (!job) {
            throw new common_1.NotFoundException(`Ingestion job ${id} not found`);
        }
        if (actorId) {
            (0, job_visibility_js_1.assertCanAccessJob)(job.createdBy, actorId, viewAll);
        }
        if (!['pending', 'processing', 'uploading'].includes(job.status)) {
            throw new Error(`Cannot cancel job in status: ${job.status}`);
        }
        job.status = 'cancelled';
        job.createdBy = (0, job_visibility_js_1.withCreatedByBackfill)(job.createdBy, actorId);
        await this.jobRepo.save(job);
        this.logger.log(`Cancelled ingestion job ${id}`);
        return job;
    }
    async getStats() {
        const result = await this.jobRepo
            .createQueryBuilder('job')
            .select('job.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .groupBy('job.status')
            .getRawMany();
        const stats = {};
        for (const row of result) {
            stats[row.status] = parseInt(row.count, 10);
        }
        return stats;
    }
};
exports.IngestionService = IngestionService;
exports.IngestionService = IngestionService = IngestionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ingestion_job_entity_js_1.IngestionJob)),
    __param(1, (0, typeorm_1.InjectRepository)(ai_result_entity_js_1.AiResult)),
    __param(2, (0, typeorm_1.InjectRepository)(image_asset_entity_js_1.ImageAsset)),
    __param(3, (0, bullmq_1.InjectQueue)('ingestion')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository, Function])
], IngestionService);
//# sourceMappingURL=ingestion.service.js.map