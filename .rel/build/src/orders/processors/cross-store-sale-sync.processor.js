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
var CrossStoreSaleSyncProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossStoreSaleSyncProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const cross_store_sale_sync_service_js_1 = require("../cross-store-sale-sync.service.js");
const cross_store_sale_sync_util_js_1 = require("../cross-store-sale-sync.util.js");
let CrossStoreSaleSyncProcessor = CrossStoreSaleSyncProcessor_1 = class CrossStoreSaleSyncProcessor extends bullmq_1.WorkerHost {
    sync;
    logger = new common_1.Logger(CrossStoreSaleSyncProcessor_1.name);
    constructor(sync) {
        super();
        this.sync = sync;
    }
    async process(job) {
        if (!(await this.sync.enabled()))
            return { results: 0 };
        try {
            const results = await this.sync.syncOrder(job.data.orderId);
            return { results: results.length };
        }
        catch (err) {
            const message = err.message ?? String(err);
            const attempts = job.opts.attempts ?? 1;
            if (job.attemptsMade + 1 >= attempts) {
                this.logger.error(`Cross-store sale sync gave up on order ${job.data.orderId}: ${message}`);
                await this.sync.notifyGaveUp(job.data.orderId, message);
            }
            throw err;
        }
    }
};
exports.CrossStoreSaleSyncProcessor = CrossStoreSaleSyncProcessor;
exports.CrossStoreSaleSyncProcessor = CrossStoreSaleSyncProcessor = CrossStoreSaleSyncProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(cross_store_sale_sync_util_js_1.CROSS_STORE_SALE_SYNC_QUEUE, { concurrency: 1 }),
    __metadata("design:paramtypes", [cross_store_sale_sync_service_js_1.CrossStoreSaleSyncService])
], CrossStoreSaleSyncProcessor);
//# sourceMappingURL=cross-store-sale-sync.processor.js.map