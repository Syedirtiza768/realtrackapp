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
var EbayOrderSyncProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayOrderSyncProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const ebay_sync_service_js_1 = require("../services/ebay-sync.service.js");
let EbayOrderSyncProcessor = EbayOrderSyncProcessor_1 = class EbayOrderSyncProcessor extends bullmq_1.WorkerHost {
    sync;
    logger = new common_1.Logger(EbayOrderSyncProcessor_1.name);
    constructor(sync) {
        super();
        this.sync = sync;
    }
    async process(job) {
        this.logger.log(`Order sync for account ${job.data.ebayAccountId} (job ${job.id})`);
        return this.sync.importOrdersFromEbay(job.data);
    }
};
exports.EbayOrderSyncProcessor = EbayOrderSyncProcessor;
exports.EbayOrderSyncProcessor = EbayOrderSyncProcessor = EbayOrderSyncProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('ebay-order-sync'),
    __metadata("design:paramtypes", [ebay_sync_service_js_1.EbaySyncService])
], EbayOrderSyncProcessor);
//# sourceMappingURL=ebay-order-sync.processor.js.map