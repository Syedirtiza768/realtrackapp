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
var EbayInventorySyncProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayInventorySyncProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const ebay_sync_service_js_1 = require("../services/ebay-sync.service.js");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_listing_sync_log_entity_js_1 = require("../entities/ebay-listing-sync-log.entity.js");
let EbayInventorySyncProcessor = EbayInventorySyncProcessor_1 = class EbayInventorySyncProcessor extends bullmq_1.WorkerHost {
    sync;
    syncLogRepo;
    logger = new common_1.Logger(EbayInventorySyncProcessor_1.name);
    constructor(sync, syncLogRepo) {
        super();
        this.sync = sync;
        this.syncLogRepo = syncLogRepo;
    }
    async process(job) {
        const { ebayAccountId, organizationId } = job.data;
        let syncLogId = job.data.syncLogId;
        if (!syncLogId) {
            const running = await this.syncLogRepo.findOne({
                where: {
                    ebayAccountId,
                    organizationId,
                    status: 'running',
                    syncType: 'listings',
                },
                order: { startedAt: 'DESC' },
            });
            syncLogId = running?.id;
        }
        if (!syncLogId) {
            const row = await this.syncLogRepo.save(this.syncLogRepo.create({
                organizationId,
                ebayAccountId,
                syncType: 'listings',
                status: 'running',
                triggeredByUserId: job.data.userId ?? null,
                marketplaceId: job.data.marketplaceId ?? null,
            }));
            syncLogId = row.id;
        }
        this.logger.log(`Starting inventory sync for account ${ebayAccountId} (job ${job.id})`);
        return this.sync.syncListingsFromEbay(job.data, syncLogId);
    }
};
exports.EbayInventorySyncProcessor = EbayInventorySyncProcessor;
exports.EbayInventorySyncProcessor = EbayInventorySyncProcessor = EbayInventorySyncProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('ebay-inventory-sync'),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_listing_sync_log_entity_js_1.EbayListingSyncLog)),
    __metadata("design:paramtypes", [ebay_sync_service_js_1.EbaySyncService,
        typeorm_2.Repository])
], EbayInventorySyncProcessor);
//# sourceMappingURL=ebay-inventory-sync.processor.js.map