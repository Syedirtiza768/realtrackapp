"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeavyJobLimiterModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const catalog_import_entity_js_1 = require("../../catalog-import/entities/catalog-import.entity.js");
const pipeline_job_entity_js_1 = require("../../ingestion/entities/pipeline-job.entity.js");
const heavy_job_limiter_service_js_1 = require("./heavy-job-limiter.service.js");
let HeavyJobLimiterModule = class HeavyJobLimiterModule {
};
exports.HeavyJobLimiterModule = HeavyJobLimiterModule;
exports.HeavyJobLimiterModule = HeavyJobLimiterModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([pipeline_job_entity_js_1.PipelineJob, catalog_import_entity_js_1.CatalogImport]),
            bullmq_1.BullModule.registerQueue({ name: 'pipeline' }),
        ],
        providers: [heavy_job_limiter_service_js_1.HeavyJobLimiterService],
        exports: [heavy_job_limiter_service_js_1.HeavyJobLimiterService],
    })
], HeavyJobLimiterModule);
//# sourceMappingURL=heavy-job-limiter.module.js.map