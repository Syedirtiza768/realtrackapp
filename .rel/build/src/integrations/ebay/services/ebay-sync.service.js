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
var EbaySyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbaySyncService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const connected_ebay_account_entity_js_1 = require("../entities/connected-ebay-account.entity.js");
const ebay_listing_channel_entity_js_1 = require("../entities/ebay-listing-channel.entity.js");
const ebay_listing_sync_log_entity_js_1 = require("../entities/ebay-listing-sync-log.entity.js");
const ebay_inventory_api_service_js_1 = require("../../../channels/ebay/ebay-inventory-api.service.js");
const order_import_ebay_service_js_1 = require("../../../orders/order-import-ebay.service.js");
const ebay_policy_sync_service_js_1 = require("./ebay-policy-sync.service.js");
const listing_action_log_writer_service_js_1 = require("./listing-action-log-writer.service.js");
let EbaySyncService = EbaySyncService_1 = class EbaySyncService {
    accountRepo;
    channelRepo;
    syncLogRepo;
    inventoryApi;
    policySync;
    orderImport;
    logWriter;
    inventorySyncQueue;
    orderSyncQueue;
    logger = new common_1.Logger(EbaySyncService_1.name);
    constructor(accountRepo, channelRepo, syncLogRepo, inventoryApi, policySync, orderImport, logWriter, inventorySyncQueue, orderSyncQueue) {
        this.accountRepo = accountRepo;
        this.channelRepo = channelRepo;
        this.syncLogRepo = syncLogRepo;
        this.inventoryApi = inventoryApi;
        this.policySync = policySync;
        this.orderImport = orderImport;
        this.logWriter = logWriter;
        this.inventorySyncQueue = inventorySyncQueue;
        this.orderSyncQueue = orderSyncQueue;
    }
    async enqueueListingSync(ebayAccountId, organizationId, userId, marketplaceId) {
        const account = await this.accountRepo.findOne({
            where: { id: ebayAccountId, organizationId },
        });
        if (!account) {
            throw new common_1.NotFoundException('eBay account not found');
        }
        if (account.connectionStatus !== 'active') {
            throw new common_1.NotFoundException(`Account is not active (${account.connectionStatus}). Reconnect before syncing.`);
        }
        const syncLog = await this.syncLogRepo.save(this.syncLogRepo.create({
            organizationId,
            ebayAccountId,
            marketplaceId: marketplaceId ?? null,
            syncType: 'listings',
            status: 'running',
            triggeredByUserId: userId ?? null,
        }));
        const job = await this.inventorySyncQueue.add('sync-listings', {
            ebayAccountId,
            organizationId,
            userId: userId ?? null,
            marketplaceId: marketplaceId ?? null,
            syncLogId: syncLog.id,
        }, {
            jobId: `ebay-inv-sync-${ebayAccountId}-${Date.now()}`,
            removeOnComplete: 100,
            removeOnFail: 200,
        });
        return { jobId: job.id ?? '', syncLogId: syncLog.id };
    }
    async syncListingsFromEbay(payload, syncLogId) {
        const account = await this.accountRepo.findOne({
            where: {
                id: payload.ebayAccountId,
                organizationId: payload.organizationId,
            },
            relations: ['marketplaces'],
        });
        if (!account) {
            throw new common_1.NotFoundException('eBay account not found');
        }
        const storeId = account.primaryStoreId;
        const warnings = [];
        const errors = [];
        let processed = 0;
        let updated = 0;
        let failed = 0;
        const channels = await this.channelRepo.find({
            where: {
                ebayAccountId: account.id,
                organizationId: payload.organizationId,
            },
        });
        const channelBySku = new Map();
        for (const ch of channels) {
            const sku = (ch.ebayInventorySku ?? ch.internalSku ?? '').trim();
            if (!sku)
                continue;
            const list = channelBySku.get(sku) ?? [];
            list.push(ch);
            channelBySku.set(sku, list);
        }
        const limit = 50;
        let offset = 0;
        let totalOffers = 0;
        try {
            for (;;) {
                const page = await this.inventoryApi.getItems(storeId, limit, offset);
                const items = page.inventoryItems ?? [];
                if (!items.length)
                    break;
                for (const item of items) {
                    const sku = item.sku?.trim();
                    if (!sku)
                        continue;
                    processed += 1;
                    try {
                        const { offers } = await this.inventoryApi.getOffersBySku(storeId, sku, 100, 0);
                        totalOffers += offers.length;
                        for (const offer of offers) {
                            const mp = offer.marketplaceId ?? payload.marketplaceId ?? null;
                            if (payload.marketplaceId && mp && mp !== payload.marketplaceId) {
                                continue;
                            }
                            const matches = channelBySku.get(sku) ?? [];
                            const target = matches.find((c) => c.marketplaceId === mp) ?? matches[0];
                            if (!target) {
                                warnings.push({
                                    sku,
                                    message: 'Offer found on eBay but no local ebay_listing_channel row — publish from catalog to link.',
                                    offerId: offer.offerId,
                                });
                                continue;
                            }
                            target.ebayInventorySku = sku;
                            target.offerId = offer.offerId ?? target.offerId;
                            target.listingId = offer.listingId ?? target.listingId;
                            if (offer.pricingSummary?.price?.value != null) {
                                target.channelPrice = String(offer.pricingSummary.price.value);
                            }
                            if (offer.availableQuantity != null) {
                                target.channelQuantity = offer.availableQuantity;
                            }
                            const status = (offer.status ?? '').toUpperCase();
                            if (status === 'PUBLISHED' || offer.listingId) {
                                target.listingStatus = 'published';
                                target.publishedAt = target.publishedAt ?? new Date();
                            }
                            else if (status === 'ENDED' || status === 'WITHDRAWN') {
                                target.listingStatus = 'ended';
                            }
                            target.lastSyncedAt = new Date();
                            await this.channelRepo.save(target);
                            updated += 1;
                        }
                    }
                    catch (e) {
                        failed += 1;
                        errors.push({
                            sku,
                            message: e instanceof Error ? e.message : String(e),
                        });
                    }
                }
                const next = page.next ?? '';
                if (!next || items.length < limit)
                    break;
                offset += limit;
            }
            const status = failed > 0 && updated > 0
                ? 'partial'
                : failed > 0
                    ? 'failed'
                    : 'success';
            const logRow = await this.syncLogRepo.findOneByOrFail({ id: syncLogId });
            logRow.status = status;
            logRow.itemsProcessed = processed;
            logRow.itemsUpdated = updated;
            logRow.itemsFailed = failed;
            logRow.warnings = warnings;
            logRow.errors = errors;
            logRow.rawSummary = { totalOffers };
            logRow.finishedAt = new Date();
            await this.syncLogRepo.save(logRow);
            await this.accountRepo.update(account.id, {
                lastListingsFetchedCount: totalOffers,
                lastErrorMessage: status === 'failed'
                    ? (errors[0]?.message ?? 'Sync failed')
                    : null,
            });
            await this.logWriter.write({
                organizationId: payload.organizationId,
                ebayAccountId: account.id,
                userId: payload.userId ?? null,
                action: 'listing_sync',
                result: status,
                afterSnapshot: { processed, updated, failed, totalOffers },
            });
            return { processed, updated, failed };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const failRow = await this.syncLogRepo.findOneByOrFail({ id: syncLogId });
            failRow.status = 'failed';
            failRow.itemsProcessed = processed;
            failRow.itemsUpdated = updated;
            failRow.itemsFailed = failed + 1;
            failRow.errors = [...errors, { message: msg }];
            failRow.finishedAt = new Date();
            await this.syncLogRepo.save(failRow);
            await this.accountRepo.update(account.id, {
                lastErrorMessage: msg,
            });
            throw e;
        }
    }
    async enqueueOrderSync(ebayAccountId, organizationId, userId) {
        const account = await this.accountRepo.findOne({
            where: { id: ebayAccountId, organizationId },
        });
        if (!account) {
            throw new common_1.NotFoundException('eBay account not found');
        }
        if (account.connectionStatus !== 'active') {
            throw new common_1.NotFoundException(`Account is not active (${account.connectionStatus}). Reconnect before syncing orders.`);
        }
        const job = await this.orderSyncQueue.add('sync-orders', { ebayAccountId, organizationId, userId: userId ?? null }, {
            jobId: `ebay-order-sync-${ebayAccountId}-${Date.now()}`,
            removeOnComplete: 100,
            removeOnFail: 200,
        });
        return { jobId: job.id ?? '' };
    }
    async importOrdersFromEbay(payload) {
        const result = await this.orderImport.importFromConnectedAccount(payload.ebayAccountId, payload.organizationId);
        await this.accountRepo.update(payload.ebayAccountId, {
            lastErrorMessage: result.errors > 0 ? `${result.errors} order(s) failed to import` : null,
        });
        await this.logWriter.write({
            organizationId: payload.organizationId,
            ebayAccountId: payload.ebayAccountId,
            userId: payload.userId ?? null,
            action: 'order_sync',
            result: result.errors > 0 ? 'partial' : 'success',
            afterSnapshot: result,
        });
        return result;
    }
    async syncPolicies(ebayAccountId, organizationId, userId) {
        const result = await this.policySync.syncPolicies(ebayAccountId, organizationId, userId);
        if (result.ok) {
            await this.accountRepo.update(ebayAccountId, {
                lastPoliciesFetchedCount: result.synced,
            });
        }
        return result;
    }
    async listSyncLogs(ebayAccountId, organizationId, limit = 20) {
        return this.syncLogRepo.find({
            where: { ebayAccountId, organizationId },
            order: { startedAt: 'DESC' },
            take: limit,
        });
    }
};
exports.EbaySyncService = EbaySyncService;
exports.EbaySyncService = EbaySyncService = EbaySyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_listing_channel_entity_js_1.EbayListingChannel)),
    __param(2, (0, typeorm_1.InjectRepository)(ebay_listing_sync_log_entity_js_1.EbayListingSyncLog)),
    __param(7, (0, bullmq_1.InjectQueue)('ebay-inventory-sync')),
    __param(8, (0, bullmq_1.InjectQueue)('ebay-order-sync')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_inventory_api_service_js_1.EbayInventoryApiService,
        ebay_policy_sync_service_js_1.EbayPolicySyncService,
        order_import_ebay_service_js_1.EbayOrderImportService,
        listing_action_log_writer_service_js_1.ListingActionLogWriterService, Function, Function])
], EbaySyncService);
//# sourceMappingURL=ebay-sync.service.js.map