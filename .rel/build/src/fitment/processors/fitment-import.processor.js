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
var FitmentImportProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FitmentImportProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const fitment_import_service_js_1 = require("../fitment-import.service.js");
let FitmentImportProcessor = class FitmentImportProcessor extends bullmq_1.WorkerHost {
    static { FitmentImportProcessor_1 = this; }
    importService;
    logger = new common_1.Logger(FitmentImportProcessor_1.name);
    static BATCH_SIZE = 1000;
    constructor(importService) {
        super();
        this.importService = importService;
    }
    async process(job) {
        const { rows } = job.data;
        this.logger.log(`Processing ACES import job ${job.id}: ${rows.length} rows`);
        const totalBatches = Math.ceil(rows.length / FitmentImportProcessor_1.BATCH_SIZE);
        let totalMakes = 0;
        let totalModels = 0;
        let totalSubmodels = 0;
        let totalYears = 0;
        let totalEngines = 0;
        for (let i = 0; i < totalBatches; i++) {
            const start = i * FitmentImportProcessor_1.BATCH_SIZE;
            const batch = rows.slice(start, start + FitmentImportProcessor_1.BATCH_SIZE);
            const result = await this.importService.processImportBatch(batch);
            totalMakes += result.makesCreated;
            totalModels += result.modelsCreated;
            totalSubmodels += result.submodelsCreated;
            totalYears += result.yearsCreated;
            totalEngines += result.enginesCreated;
            await job.updateProgress(Math.round(((i + 1) / totalBatches) * 100));
        }
        this.logger.log(`ACES import complete: ${totalMakes} makes, ${totalModels} models, ` +
            `${totalSubmodels} submodels, ${totalYears} years, ${totalEngines} engines`);
    }
};
exports.FitmentImportProcessor = FitmentImportProcessor;
exports.FitmentImportProcessor = FitmentImportProcessor = FitmentImportProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('fitment', { concurrency: 1 }),
    __metadata("design:paramtypes", [fitment_import_service_js_1.FitmentImportService])
], FitmentImportProcessor);
//# sourceMappingURL=fitment-import.processor.js.map