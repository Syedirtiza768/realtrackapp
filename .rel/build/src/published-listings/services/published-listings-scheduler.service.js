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
var PublishedListingsSchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsSchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const scheduler_leader_service_js_1 = require("../../common/scheduler/scheduler-leader.service.js");
const connected_ebay_account_entity_js_1 = require("../../integrations/ebay/entities/connected-ebay-account.entity.js");
const published_listings_sync_service_js_1 = require("./published-listings-sync.service.js");
let PublishedListingsSchedulerService = PublishedListingsSchedulerService_1 = class PublishedListingsSchedulerService {
    accountRepo;
    sync;
    leader;
    logger = new common_1.Logger(PublishedListingsSchedulerService_1.name);
    constructor(accountRepo, sync, leader) {
        this.accountRepo = accountRepo;
        this.sync = sync;
        this.leader = leader;
    }
    async scheduleDeltaSync() {
        await this.runSync('delta');
    }
    async scheduleFullSync() {
        await this.runSync('full');
    }
    async runSync(mode) {
        if (process.env.PUBLISHED_LISTINGS_SYNC_DISABLED === '1' ||
            process.env.PUBLISHED_LISTINGS_SYNC_DISABLED === 'true') {
            this.logger.debug('Published listings sync cron disabled via env');
            return;
        }
        await this.leader.runIfLeader('published-listings-sync', 12 * 60_000, async () => {
            const scopedIds = (process.env.PUBLISHED_LISTINGS_SYNC_ACCOUNT_IDS || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            let accounts;
            if (scopedIds.length > 0) {
                const found = await this.accountRepo.find({
                    where: scopedIds.map((id) => ({ id, connectionStatus: 'active' })),
                });
                const byId = new Map(found.map((a) => [a.id, a]));
                accounts = scopedIds
                    .map((id) => byId.get(id))
                    .filter((a) => Boolean(a));
            }
            else {
                accounts = await this.accountRepo.find({
                    where: { connectionStatus: 'active' },
                });
            }
            for (const account of accounts) {
                try {
                    await this.sync.enqueueSync({
                        organizationId: account.organizationId,
                        ebayAccountId: account.id,
                        trigger: 'scheduled',
                        syncMode: mode,
                    });
                }
                catch (e) {
                    this.logger.warn(`Failed to enqueue ${mode} sync for ${account.id}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            this.logger.log(`Enqueued ${mode} published listings sync for ${accounts.length} eBay account(s)`);
        });
    }
};
exports.PublishedListingsSchedulerService = PublishedListingsSchedulerService;
__decorate([
    (0, schedule_1.Cron)(process.env.PUBLISHED_LISTINGS_SYNC_CRON ?? '*/15 * * * *', {
        name: 'published-listings-sync',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PublishedListingsSchedulerService.prototype, "scheduleDeltaSync", null);
__decorate([
    (0, schedule_1.Cron)(process.env.PUBLISHED_LISTINGS_FULL_SYNC_CRON ?? '0 3 * * 0', {
        name: 'published-listings-full-sync',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PublishedListingsSchedulerService.prototype, "scheduleFullSync", null);
exports.PublishedListingsSchedulerService = PublishedListingsSchedulerService = PublishedListingsSchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        published_listings_sync_service_js_1.PublishedListingsSyncService,
        scheduler_leader_service_js_1.SchedulerLeaderService])
], PublishedListingsSchedulerService);
//# sourceMappingURL=published-listings-scheduler.service.js.map