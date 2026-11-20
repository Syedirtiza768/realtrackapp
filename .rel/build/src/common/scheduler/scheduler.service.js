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
var SchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const scheduler_leader_service_js_1 = require("./scheduler-leader.service.js");
const price_monitor_service_js_1 = require("../../pricing-intelligence/price-monitor.service.js");
const sellerpundit_policy_sync_service_js_1 = require("../../integrations/sellerpundit/sellerpundit-policy-sync.service.js");
const sellerpundit_token_sync_service_js_1 = require("../../integrations/sellerpundit/sellerpundit-token-sync.service.js");
const sellerpundit_auth_service_js_1 = require("../../integrations/sellerpundit/sellerpundit-auth.service.js");
const ebay_policy_sync_service_js_1 = require("../../integrations/ebay/services/ebay-policy-sync.service.js");
const connected_ebay_account_entity_js_1 = require("../../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_category_keyword_audit_service_js_1 = require("../../channels/ebay/ebay-category-keyword-audit.service.js");
let SchedulerService = SchedulerService_1 = class SchedulerService {
    storageCleanupQueue;
    inventoryQueue;
    ordersQueue;
    dashboardQueue;
    channelsQueue;
    accountRepo;
    leader;
    spPolicySync;
    spTokenSync;
    spAuth;
    nativePolicySync;
    categoryKeywordAudit;
    priceMonitor;
    logger = new common_1.Logger(SchedulerService_1.name);
    constructor(storageCleanupQueue, inventoryQueue, ordersQueue, dashboardQueue, channelsQueue, accountRepo, leader, spPolicySync, spTokenSync, spAuth, nativePolicySync, categoryKeywordAudit, priceMonitor) {
        this.storageCleanupQueue = storageCleanupQueue;
        this.inventoryQueue = inventoryQueue;
        this.ordersQueue = ordersQueue;
        this.dashboardQueue = dashboardQueue;
        this.channelsQueue = channelsQueue;
        this.accountRepo = accountRepo;
        this.leader = leader;
        this.spPolicySync = spPolicySync;
        this.spTokenSync = spTokenSync;
        this.spAuth = spAuth;
        this.nativePolicySync = nativePolicySync;
        this.categoryKeywordAudit = categoryKeywordAudit;
        this.priceMonitor = priceMonitor;
    }
    async scheduleCategoryKeywordAudit() {
        await this.leader.runIfLeader('category-keyword-audit-daily', 3600, async () => {
            const findings = await this.categoryKeywordAudit.auditCategoryKeywords();
            if (findings.length > 0) {
                this.logger.error(`Category keyword audit found ${findings.length} drifted categor${findings.length === 1 ? 'y' : 'ies'} — see EbayCategoryKeywordAuditService logs above for details.`);
            }
        });
    }
    async scheduleStorageCleanup() {
        await this.leader.runIfLeader('storage-cleanup-daily', 3600, async () => {
            const jobId = `storage-cleanup-${new Date().toISOString().slice(0, 10)}`;
            await this.storageCleanupQueue.add('cleanup', {}, {
                jobId,
                removeOnComplete: 10,
                removeOnFail: 10,
            });
            this.logger.log(`Enqueued storage cleanup job: ${jobId}`);
        });
    }
    async scheduleInventoryLowStockAlert() {
        await this.leader.runIfLeader('inventory-low-stock-check', 14_000, async () => {
            const jobId = `low-stock-alert-${Date.now()}`;
            await this.inventoryQueue.add('low-stock-alert', {}, {
                jobId,
                removeOnComplete: 50,
                removeOnFail: 20,
            });
            this.logger.log(`Enqueued low stock alert check: ${jobId}`);
        });
    }
    async scheduleInventoryDuplicateScan() {
        await this.leader.runIfLeader('inventory-duplicate-scan', 3600, async () => {
            const jobId = `duplicate-scan-${new Date().toISOString().slice(0, 10)}`;
            await this.inventoryQueue.add('duplicate-scan', {}, {
                jobId,
                removeOnComplete: 10,
                removeOnFail: 10,
            });
            this.logger.log(`Enqueued inventory duplicate scan: ${jobId}`);
        });
    }
    async scheduleEnrichmentRetryScan() {
        await this.leader.runIfLeader('enrichment-retry-scan', 240, async () => {
            const jobId = `enrichment-retry-scan-${Date.now()}`;
            await this.inventoryQueue.add('enrichment-retry-scan', {}, {
                jobId,
                removeOnComplete: 20,
                removeOnFail: 10,
            });
        });
    }
    async scheduleOrderImport() {
        await this.leader.runIfLeader('order-import-from-channels', 240, async () => {
            const jobId = `order-import-${Date.now()}`;
            await this.ordersQueue.add('import-from-channels', {}, {
                jobId,
                removeOnComplete: 100,
                removeOnFail: 50,
            });
            this.logger.log(`Enqueued order import from channels: ${jobId}`);
        });
    }
    async scheduleOrderAutoComplete() {
        await this.leader.runIfLeader('order-auto-complete', 3600, async () => {
            const jobId = `order-auto-complete-${new Date().toISOString().slice(0, 10)}`;
            await this.ordersQueue.add('auto-complete', {}, {
                jobId,
                removeOnComplete: 10,
                removeOnFail: 10,
            });
            this.logger.log(`Enqueued order auto-complete: ${jobId}`);
        });
    }
    async scheduleDashboardRecompute() {
        await this.leader.runIfLeader('dashboard-recompute', 1700, async () => {
            const jobId = `dashboard-recompute-${Date.now()}`;
            await this.dashboardQueue.add('recompute-summary', {}, {
                jobId,
                removeOnComplete: 50,
                removeOnFail: 20,
            });
            this.logger.log(`Enqueued dashboard recompute: ${jobId}`);
        });
    }
    async scheduleDailySalesRollup() {
        await this.leader.runIfLeader('dashboard-daily-rollup', 3600, async () => {
            const jobId = `daily-sales-rollup-${new Date().toISOString().slice(0, 10)}`;
            await this.dashboardQueue.add('daily-sales-rollup', {}, {
                jobId,
                removeOnComplete: 10,
                removeOnFail: 10,
            });
            this.logger.log(`Enqueued daily sales rollup: ${jobId}`);
        });
    }
    async scheduleListingRefresh() {
        await this.leader.runIfLeader('listing-refresh-48h', 3600, async () => {
            const jobId = `listing-refresh-${new Date().toISOString().slice(0, 10)}`;
            await this.channelsQueue.add('refresh-stale-offers', {}, {
                jobId,
                removeOnComplete: 10,
                removeOnFail: 10,
            });
            this.logger.log(`Enqueued listing refresh for stale offers: ${jobId}`);
        });
    }
    async scheduleChannelInventorySync() {
        await this.leader.runIfLeader('channel-inventory-sync', 7000, async () => {
            const jobId = `channel-inventory-sync-${Date.now()}`;
            await this.channelsQueue.add('sync-inventory', {}, {
                jobId,
                removeOnComplete: 50,
                removeOnFail: 20,
            });
            this.logger.log(`Enqueued channel inventory sync: ${jobId}`);
        });
    }
    async scheduleCompetitorPriceCollection() {
        await this.leader.runIfLeader('pricing-collect-competitor', 14_000, async () => {
            if (!this.priceMonitor) {
                this.logger.debug('PriceMonitorService not available — skipping competitor price collection');
                return;
            }
            try {
                this.logger.log('Starting scheduled competitor price collection');
                const result = await this.priceMonitor.collectAllCompetitorPrices();
                this.logger.log(`Competitor price collection complete: ${result.processed} products, ${result.collected} prices, ${result.errors} errors`);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.error(`Scheduled competitor price collection failed: ${msg}`);
            }
        });
    }
    async scheduleSellerpunditPolicySync() {
        await this.leader.runIfLeader('sellerpundit-policy-sync', 28_000, async () => {
            const accounts = await this.accountRepo.find({
                where: { connectionSource: 'sellerpundit' },
            });
            if (!accounts.length) {
                this.logger.debug('No SellerPundit accounts — skipping policy sync');
                return;
            }
            this.logger.log(`SellerPundit auto-sync: refreshing policies for ${accounts.length} account(s)`);
            let ok = 0;
            let failed = 0;
            for (const account of accounts) {
                try {
                    await this.spTokenSync.ensureFreshAccessToken(account.id, {
                        force: true,
                    });
                }
                catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    this.logger.warn(`SellerPundit token refresh failed for account ${account.id} (${account.accountDisplayName ?? account.ebayUserId}): ${msg}`);
                }
                try {
                    const result = await this.spPolicySync.syncPolicies(account.id, account.organizationId);
                    if (result.ok) {
                        ok++;
                        this.logger.log(`SellerPundit policies synced for ${account.accountDisplayName ?? account.id}: ${result.synced} policy row(s)`);
                    }
                    else {
                        failed++;
                        this.logger.warn(`SellerPundit policy sync returned not-ok for ${account.id}: ${result.message}`);
                    }
                }
                catch (e) {
                    failed++;
                    const msg = e instanceof Error ? e.message : String(e);
                    this.logger.error(`SellerPundit policy sync failed for account ${account.id} (${account.accountDisplayName ?? account.ebayUserId}): ${msg}`);
                }
            }
            this.logger.log(`SellerPundit auto-sync complete: ${ok} ok, ${failed} failed`);
        });
    }
    async scheduleNativeOAuthPolicySync() {
        await this.leader.runIfLeader('native-oauth-policy-sync', 28_000, async () => {
            const accounts = await this.accountRepo.find({
                where: { connectionSource: 'native_oauth' },
            });
            if (!accounts.length) {
                this.logger.debug('No native OAuth accounts — skipping policy sync');
                return;
            }
            const now = Date.now();
            const fourHoursMs = 4 * 60 * 60 * 1000;
            const eligible = accounts.filter((a) => {
                if (!a.lastSuccessfulSyncAt)
                    return true;
                return now - new Date(a.lastSuccessfulSyncAt).getTime() > fourHoursMs;
            });
            if (!eligible.length) {
                this.logger.debug('All native OAuth accounts recently synced — skipping');
                return;
            }
            this.logger.log(`Native OAuth auto-sync: refreshing policies for ${eligible.length} account(s)`);
            let ok = 0;
            let failed = 0;
            for (const account of eligible) {
                try {
                    const result = await this.nativePolicySync.syncPolicies(account.id, account.organizationId);
                    if (result.ok) {
                        ok++;
                        this.logger.log(`Native OAuth policies synced for ${account.accountDisplayName ?? account.id}: ${result.synced} policy row(s)`);
                    }
                    else {
                        failed++;
                        this.logger.warn(`Native OAuth policy sync returned not-ok for ${account.id}: ${result.message}`);
                    }
                }
                catch (e) {
                    failed++;
                    const msg = e instanceof Error ? e.message : String(e);
                    this.logger.error(`Native OAuth policy sync failed for account ${account.id} (${account.accountDisplayName ?? account.ebayUserId}): ${msg}`);
                }
            }
            this.logger.log(`Native OAuth auto-sync complete: ${ok} ok, ${failed} failed`);
        });
    }
};
exports.SchedulerService = SchedulerService;
__decorate([
    (0, schedule_1.Cron)('0 5 * * *', { name: 'category-keyword-audit-daily' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleCategoryKeywordAudit", null);
__decorate([
    (0, schedule_1.Cron)('0 3 * * *', { name: 'storage-cleanup-daily' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleStorageCleanup", null);
__decorate([
    (0, schedule_1.Cron)('0 */4 * * *', { name: 'inventory-low-stock-check' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleInventoryLowStockAlert", null);
__decorate([
    (0, schedule_1.Cron)('0 4 * * *', { name: 'inventory-duplicate-scan' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleInventoryDuplicateScan", null);
__decorate([
    (0, schedule_1.Cron)('*/5 * * * *', { name: 'enrichment-retry-scan' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleEnrichmentRetryScan", null);
__decorate([
    (0, schedule_1.Cron)(process.env.ORDER_IMPORT_CRON ?? '*/5 * * * *', {
        name: 'order-import-from-channels',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleOrderImport", null);
__decorate([
    (0, schedule_1.Cron)('0 2 * * *', { name: 'order-auto-complete' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleOrderAutoComplete", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_30_MINUTES, { name: 'dashboard-recompute' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleDashboardRecompute", null);
__decorate([
    (0, schedule_1.Cron)('0 1 * * *', { name: 'dashboard-daily-rollup' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleDailySalesRollup", null);
__decorate([
    (0, schedule_1.Cron)('0 0 */2 * *', { name: 'listing-refresh-48h' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleListingRefresh", null);
__decorate([
    (0, schedule_1.Cron)('0 */2 * * *', { name: 'channel-inventory-sync' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleChannelInventorySync", null);
__decorate([
    (0, schedule_1.Cron)('30 */4 * * *', { name: 'pricing-collect-competitor' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleCompetitorPriceCollection", null);
__decorate([
    (0, schedule_1.Cron)('0 */8 * * *', { name: 'sellerpundit-policy-sync' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleSellerpunditPolicySync", null);
__decorate([
    (0, schedule_1.Cron)('0 */8 * * *', { name: 'native-oauth-policy-sync' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "scheduleNativeOAuthPolicySync", null);
exports.SchedulerService = SchedulerService = SchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('storage-cleanup')),
    __param(1, (0, bullmq_1.InjectQueue)('inventory')),
    __param(2, (0, bullmq_1.InjectQueue)('orders')),
    __param(3, (0, bullmq_1.InjectQueue)('dashboard')),
    __param(4, (0, bullmq_1.InjectQueue)('channels')),
    __param(5, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(12, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue,
        typeorm_2.Repository,
        scheduler_leader_service_js_1.SchedulerLeaderService,
        sellerpundit_policy_sync_service_js_1.SellerpunditPolicySyncService,
        sellerpundit_token_sync_service_js_1.SellerpunditTokenSyncService,
        sellerpundit_auth_service_js_1.SellerpunditAuthService,
        ebay_policy_sync_service_js_1.EbayPolicySyncService,
        ebay_category_keyword_audit_service_js_1.EbayCategoryKeywordAuditService,
        price_monitor_service_js_1.PriceMonitorService])
], SchedulerService);
//# sourceMappingURL=scheduler.service.js.map