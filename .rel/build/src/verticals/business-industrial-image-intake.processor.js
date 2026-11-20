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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessIndustrialImageIntakeProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const business_industrial_image_intake_service_js_1 = require("./business-industrial-image-intake.service.js");
let BusinessIndustrialImageIntakeProcessor = class BusinessIndustrialImageIntakeProcessor extends bullmq_1.WorkerHost {
    intake;
    constructor(intake) {
        super();
        this.intake = intake;
    }
    async process(job) {
        if (job.name === 'import-drive')
            await this.intake.processDriveJob(job.data.jobId, job.data.maxItems, job.data.autoCreateDrafts ?? true, job.data.skipFolderNames ?? []);
        else
            await this.intake.processJob(job.data.jobId);
        return { jobId: job.data.jobId };
    }
};
exports.BusinessIndustrialImageIntakeProcessor = BusinessIndustrialImageIntakeProcessor;
exports.BusinessIndustrialImageIntakeProcessor = BusinessIndustrialImageIntakeProcessor = __decorate([
    (0, bullmq_1.Processor)('business-industrial-image-intake', { concurrency: 2 }),
    __metadata("design:paramtypes", [business_industrial_image_intake_service_js_1.BusinessIndustrialImageIntakeService])
], BusinessIndustrialImageIntakeProcessor);
//# sourceMappingURL=business-industrial-image-intake.processor.js.map