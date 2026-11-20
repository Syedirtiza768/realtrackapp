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
var HeavyJobLimiterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeavyJobLimiterService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const catalog_import_entity_js_1 = require("../../catalog-import/entities/catalog-import.entity.js");
const pipeline_job_entity_js_1 = require("../../ingestion/entities/pipeline-job.entity.js");
const PIPELINE_SLOT_STATUSES = [
    'uploading',
    'vin_decode',
    'category_mapping',
    'enrichment',
    'validation',
    'output_generation',
];
const ACTIVE_IMPORT_STATUSES = ['validating', 'processing', 'paused'];
let HeavyJobLimiterService = HeavyJobLimiterService_1 = class HeavyJobLimiterService {
    pipelineJobRepo;
    importRepo;
    pipelineQueue;
    config;
    logger = new common_1.Logger(HeavyJobLimiterService_1.name);
    constructor(pipelineJobRepo, importRepo, pipelineQueue, config) {
        this.pipelineJobRepo = pipelineJobRepo;
        this.importRepo = importRepo;
        this.pipelineQueue = pipelineQueue;
        this.config = config;
    }
    async assertPipelineSlotAvailable() {
        const max = Number(this.config.get('MAX_CONCURRENT_PIPELINE_JOBS', '2'));
        if (max <= 0)
            return;
        await this.recoverStalePipelineJobs();
        const active = await this.pipelineJobRepo.count({
            where: { status: (0, typeorm_2.In)(PIPELINE_SLOT_STATUSES) },
        });
        if (active >= max) {
            throw new common_1.ServiceUnavailableException(`Pipeline capacity reached (${active}/${max} jobs processing). Cancel a running job from History or wait for it to finish.`);
        }
    }
    async recoverStalePipelineJobs() {
        const staleMinutes = Number(this.config.get('PIPELINE_JOB_STALE_MINUTES', '360'));
        if (staleMinutes <= 0)
            return;
        const cutoff = new Date(Date.now() - staleMinutes * 60_000);
        const stale = await this.pipelineJobRepo.find({
            where: {
                status: (0, typeorm_2.In)(PIPELINE_SLOT_STATUSES),
                updatedAt: (0, typeorm_2.LessThan)(cutoff),
            },
            select: ['id', 'originalFilename', 'status', 'updatedAt'],
            take: 20,
        });
        if (stale.length === 0)
            return;
        for (const job of stale) {
            await this.pipelineJobRepo.update(job.id, {
                status: 'failed',
                lastError: `Job timed out (no progress for ${staleMinutes} minutes). Retry from History.`,
                completedAt: new Date(),
            });
            this.logger.warn(`Marked stale pipeline job ${job.id} (${job.originalFilename}) as failed`);
        }
        try {
            const [queued, active, delayed] = await Promise.all([
                this.pipelineQueue.getWaiting(),
                this.pipelineQueue.getActive(),
                this.pipelineQueue.getDelayed(),
            ]);
            const staleIds = new Set(stale.map((j) => j.id));
            for (const entry of [...queued, ...active, ...delayed]) {
                const jobId = entry.data.jobId;
                if (jobId && staleIds.has(jobId)) {
                    await entry.remove().catch(() => { });
                }
            }
        }
        catch (err) {
            this.logger.warn(`Could not remove stale jobs from BullMQ: ${err instanceof Error ? err.message : err}`);
        }
    }
    async assertCatalogImportSlotAvailable() {
        const max = Number(this.config.get('MAX_CONCURRENT_CATALOG_IMPORTS', '2'));
        if (max <= 0)
            return;
        const active = await this.importRepo.count({
            where: { status: (0, typeorm_2.In)([...ACTIVE_IMPORT_STATUSES]) },
        });
        if (active >= max) {
            throw new common_1.ServiceUnavailableException(`Catalog import capacity reached (${active}/${max} jobs running). Try again shortly.`);
        }
    }
};
exports.HeavyJobLimiterService = HeavyJobLimiterService;
exports.HeavyJobLimiterService = HeavyJobLimiterService = HeavyJobLimiterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(pipeline_job_entity_js_1.PipelineJob)),
    __param(1, (0, typeorm_1.InjectRepository)(catalog_import_entity_js_1.CatalogImport)),
    __param(2, (0, bullmq_1.InjectQueue)('pipeline')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository, Function, config_1.ConfigService])
], HeavyJobLimiterService);
//# sourceMappingURL=heavy-job-limiter.service.js.map