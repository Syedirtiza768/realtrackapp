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
var ChannelStockSyncProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelStockSyncProcessor = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const channel_stock_sync_service_js_1 = require("./channel-stock-sync.service.js");
let ChannelStockSyncProcessor = ChannelStockSyncProcessor_1 = class ChannelStockSyncProcessor extends bullmq_1.WorkerHost {
    sync;
    logger = new common_1.Logger(ChannelStockSyncProcessor_1.name);
    constructor(sync) {
        super();
        this.sync = sync;
    }
    async process(job) {
        switch (job.name) {
            case 'sweep': {
                let total = 0;
                for (let i = 0; i < 20; i++) {
                    const r = await this.sync.sweep(job.data.organizationId);
                    total += r.processed;
                    if (r.processed === 0)
                        break;
                }
                return { processed: total };
            }
            case 'drift':
                return this.sync.driftCheck(job.data.organizationId);
            default:
                this.logger.warn(`Unknown job ${job.name}`);
                return null;
        }
    }
};
exports.ChannelStockSyncProcessor = ChannelStockSyncProcessor;
exports.ChannelStockSyncProcessor = ChannelStockSyncProcessor = ChannelStockSyncProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(channel_stock_sync_service_js_1.STOCK_CHANNEL_SYNC_QUEUE, { concurrency: 1 }),
    __metadata("design:paramtypes", [channel_stock_sync_service_js_1.ChannelStockSyncService])
], ChannelStockSyncProcessor);
//# sourceMappingURL=channel-stock-sync.processor.js.map