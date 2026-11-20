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
var FitmentImportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FitmentImportService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const fitment_make_entity_js_1 = require("./entities/fitment-make.entity.js");
const fitment_model_entity_js_1 = require("./entities/fitment-model.entity.js");
const fitment_submodel_entity_js_1 = require("./entities/fitment-submodel.entity.js");
const fitment_year_entity_js_1 = require("./entities/fitment-year.entity.js");
const fitment_engine_entity_js_1 = require("./entities/fitment-engine.entity.js");
let FitmentImportService = FitmentImportService_1 = class FitmentImportService {
    makeRepo;
    modelRepo;
    submodelRepo;
    yearRepo;
    engineRepo;
    fitmentQueue;
    logger = new common_1.Logger(FitmentImportService_1.name);
    constructor(makeRepo, modelRepo, submodelRepo, yearRepo, engineRepo, fitmentQueue) {
        this.makeRepo = makeRepo;
        this.modelRepo = modelRepo;
        this.submodelRepo = submodelRepo;
        this.yearRepo = yearRepo;
        this.engineRepo = engineRepo;
        this.fitmentQueue = fitmentQueue;
    }
    async enqueueBulkImport(rows, userId) {
        const job = await this.fitmentQueue.add('aces-import', { rows, userId }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
            removeOnComplete: 100,
            removeOnFail: 50,
        });
        this.logger.log(`Enqueued ACES import job ${job.id} with ${rows.length} rows`);
        return { jobId: job.id, rowCount: rows.length };
    }
    async processImportBatch(rows) {
        let makesCreated = 0;
        let modelsCreated = 0;
        let submodelsCreated = 0;
        let yearsCreated = 0;
        let enginesCreated = 0;
        for (const row of rows) {
            const makeSlug = this.slugify(row.makeName);
            let make = await this.makeRepo.findOne({ where: { slug: makeSlug } });
            if (!make) {
                make = await this.makeRepo.save(this.makeRepo.create({ name: row.makeName, slug: makeSlug }));
                makesCreated++;
            }
            const modelSlug = this.slugify(row.modelName);
            let model = await this.modelRepo.findOne({
                where: { makeId: make.id, slug: modelSlug },
            });
            if (!model) {
                model = await this.modelRepo.save(this.modelRepo.create({
                    makeId: make.id,
                    name: row.modelName,
                    slug: modelSlug,
                }));
                modelsCreated++;
            }
            if (row.submodelName) {
                const existing = await this.submodelRepo.findOne({
                    where: { modelId: model.id, name: row.submodelName },
                });
                if (!existing) {
                    await this.submodelRepo.save(this.submodelRepo.create({
                        modelId: model.id,
                        name: row.submodelName,
                    }));
                    submodelsCreated++;
                }
            }
            for (let y = row.yearStart; y <= row.yearEnd; y++) {
                const existingYear = await this.yearRepo.findOne({
                    where: { year: y },
                });
                if (!existingYear) {
                    await this.yearRepo.save(this.yearRepo.create({ year: y }));
                    yearsCreated++;
                }
            }
            if (row.engineCode) {
                const existing = await this.engineRepo.findOne({
                    where: { code: row.engineCode },
                });
                if (!existing) {
                    await this.engineRepo.save(this.engineRepo.create({
                        code: row.engineCode,
                        displacementL: row.displacementL ?? null,
                        cylinders: row.cylinders ?? null,
                        fuelType: row.fuelType ?? null,
                        aspiration: row.aspiration ?? null,
                    }));
                    enginesCreated++;
                }
            }
        }
        this.logger.log(`Import batch: ${makesCreated} makes, ${modelsCreated} models, ` +
            `${submodelsCreated} submodels, ${yearsCreated} years, ${enginesCreated} engines`);
        return {
            makesCreated,
            modelsCreated,
            submodelsCreated,
            yearsCreated,
            enginesCreated,
        };
    }
    slugify(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
};
exports.FitmentImportService = FitmentImportService;
exports.FitmentImportService = FitmentImportService = FitmentImportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(fitment_make_entity_js_1.FitmentMake)),
    __param(1, (0, typeorm_1.InjectRepository)(fitment_model_entity_js_1.FitmentModel)),
    __param(2, (0, typeorm_1.InjectRepository)(fitment_submodel_entity_js_1.FitmentSubmodel)),
    __param(3, (0, typeorm_1.InjectRepository)(fitment_year_entity_js_1.FitmentYear)),
    __param(4, (0, typeorm_1.InjectRepository)(fitment_engine_entity_js_1.FitmentEngine)),
    __param(5, (0, bullmq_1.InjectQueue)('fitment')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        bullmq_2.Queue])
], FitmentImportService);
//# sourceMappingURL=fitment-import.service.js.map