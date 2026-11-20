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
exports.FashionBatchPublishProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const fashion_batch_publish_service_js_1 = require("./fashion-batch-publish.service.js");
let FashionBatchPublishProcessor = class FashionBatchPublishProcessor extends bullmq_1.WorkerHost {
    batches;
    constructor(batches) {
        super();
        this.batches = batches;
    }
    async process(job) {
        if (job.data.kind === 'sync')
            return this.batches.syncItem(job.data.itemId, job.data.attempt);
        return this.batches.processItem(job.data.itemId);
    }
};
exports.FashionBatchPublishProcessor = FashionBatchPublishProcessor;
exports.FashionBatchPublishProcessor = FashionBatchPublishProcessor = __decorate([
    (0, bullmq_1.Processor)(fashion_batch_publish_service_js_1.FASHION_BATCH_QUEUE, {
        concurrency: Number(process.env.FASHION_BATCH_CONCURRENCY ?? 3),
    }),
    __metadata("design:paramtypes", [fashion_batch_publish_service_js_1.FashionBatchPublishService])
], FashionBatchPublishProcessor);
//# sourceMappingURL=fashion-batch-publish.processor.js.map