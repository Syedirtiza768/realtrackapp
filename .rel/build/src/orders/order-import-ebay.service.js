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
var EbayOrderImportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayOrderImportService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const store_entity_js_1 = require("../channels/entities/store.entity.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_fulfillment_api_service_js_1 = require("../channels/ebay/ebay-fulfillment-api.service.js");
const orders_service_js_1 = require("./orders.service.js");
const order_entity_js_1 = require("./entities/order.entity.js");
const FIRST_RUN_WINDOW_MS = 60 * 60_000;
const LOOKBACK_MS = 10 * 60_000;
const MAX_RETRY_WINDOW_MS = 7 * 24 * 60 * 60_000;
let EbayOrderImportService = EbayOrderImportService_1 = class EbayOrderImportService {
    storeRepo;
    connectedAccountRepo;
    orderRepo;
    fulfillmentApi;
    ordersService;
    logger = new common_1.Logger(EbayOrderImportService_1.name);
    constructor(storeRepo, connectedAccountRepo, orderRepo, fulfillmentApi, ordersService) {
        this.storeRepo = storeRepo;
        this.connectedAccountRepo = connectedAccountRepo;
        this.orderRepo = orderRepo;
        this.fulfillmentApi = fulfillmentApi;
        this.ordersService = ordersService;
    }
    async importFromAllStores() {
        const stores = await this.resolveStoresToPoll();
        const results = [];
        for (const store of stores) {
            try {
                const result = await this.importFromStore(store.id);
                results.push(result);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.error(`Failed to import orders from store ${store.id}: ${msg}`);
                results.push({ storeId: store.id, imported: 0, errors: 1 });
            }
        }
        return results;
    }
    async resolveStoresToPoll() {
        const active = await this.storeRepo.find({
            where: { channel: 'ebay', status: 'active' },
        });
        const known = new Set(active.map((s) => s.id));
        const accounts = await this.connectedAccountRepo.find({
            where: { connectionStatus: 'active' },
        });
        const missing = [
            ...new Set(accounts
                .map((a) => a.primaryStoreId)
                .filter((id) => !!id && !known.has(id))),
        ];
        if (!missing.length)
            return active;
        const extra = await this.storeRepo.find({
            where: { id: (0, typeorm_2.In)(missing), channel: 'ebay', status: (0, typeorm_2.Not)('archived') },
        });
        return [...active, ...extra];
    }
    async importFromConnectedAccount(ebayAccountId, organizationId) {
        const account = await this.connectedAccountRepo.findOne({
            where: { id: ebayAccountId, organizationId },
        });
        if (!account) {
            throw new common_1.NotFoundException('eBay account not found for this organization');
        }
        if (account.connectionStatus !== 'active') {
            throw new common_1.NotFoundException(`eBay account is not active (${account.connectionStatus})`);
        }
        return this.importFromStore(account.primaryStoreId);
    }
    async importFromStore(storeId) {
        const store = await this.storeRepo.findOneBy({ id: storeId });
        if (!store)
            throw new Error(`Store ${storeId} not found`);
        const runStartedAt = new Date();
        const watermark = store.lastSyncAt ??
            new Date(runStartedAt.getTime() - FIRST_RUN_WINDOW_MS);
        const since = new Date(watermark.getTime() - LOOKBACK_MS);
        this.logger.log(`Importing eBay orders for store ${store.storeName} since ${since.toISOString()}`);
        let imported = 0;
        let errors = 0;
        let earliestFailure = null;
        let offset = 0;
        const limit = 50;
        let hasMore = true;
        while (hasMore) {
            const filter = `creationdate:[${since.toISOString()}..] `;
            const page = await this.fulfillmentApi.getOrders(storeId, {
                filter,
                limit,
                offset,
            });
            const orders = page.orders ?? [];
            for (const ebayOrder of orders) {
                try {
                    const wasNew = await this.importSingleOrder(ebayOrder, store);
                    if (wasNew)
                        imported++;
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    this.logger.error(`Failed to import eBay order ${ebayOrder.orderId} for store ${store.storeName} (will retry next run): ${msg}`);
                    errors++;
                    const createdAt = new Date(ebayOrder.creationDate);
                    if (!Number.isNaN(createdAt.getTime()) &&
                        (!earliestFailure || createdAt < earliestFailure)) {
                        earliestFailure = createdAt;
                    }
                }
            }
            offset += limit;
            hasMore = orders.length === limit && offset < (page.total ?? 0);
        }
        await this.storeRepo.update(store.id, {
            lastSyncAt: this.nextWatermark(store, runStartedAt, earliestFailure),
        });
        this.logger.log(`Store ${store.storeName}: imported ${imported} new orders, ${errors} errors`);
        return { storeId, imported, errors };
    }
    nextWatermark(store, runStartedAt, earliestFailure) {
        if (!earliestFailure)
            return runStartedAt;
        const floor = new Date(runStartedAt.getTime() - MAX_RETRY_WINDOW_MS);
        if (earliestFailure < floor) {
            this.logger.error(`Store ${store.storeName}: giving up retrying eBay orders created before ${floor.toISOString()} — import them manually`);
            return floor;
        }
        return earliestFailure;
    }
    async importSingleOrder(ebayOrder, store) {
        const existing = await this.orderRepo.findOne({
            where: { channel: 'ebay', externalOrderId: ebayOrder.orderId },
        });
        if (existing)
            return false;
        const shipTo = ebayOrder.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
        const contactAddress = shipTo?.contactAddress;
        const fullName = shipTo?.fullName;
        const shipping = {};
        if (fullName)
            shipping.name = fullName;
        if (contactAddress) {
            if (contactAddress.addressLine1)
                shipping.address1 = contactAddress.addressLine1;
            if (contactAddress.addressLine2)
                shipping.address2 = contactAddress.addressLine2;
            if (contactAddress.city)
                shipping.city = contactAddress.city;
            if (contactAddress.stateOrProvince)
                shipping.state = contactAddress.stateOrProvince;
            if (contactAddress.postalCode)
                shipping.zip = contactAddress.postalCode;
            if (contactAddress.countryCode)
                shipping.country = contactAddress.countryCode;
        }
        const items = ebayOrder.lineItems.map((li) => ({
            externalItemId: li.lineItemId,
            externalListingId: li.legacyItemId ?? undefined,
            sku: li.sku ?? undefined,
            title: li.title,
            quantity: li.quantity,
            unitPrice: li.lineItemCost.value,
        }));
        const subtotal = ebayOrder.pricingSummary.subtotal?.value ??
            ebayOrder.pricingSummary.total.value;
        const deliveryCost = ebayOrder.pricingSummary.deliveryCost?.value ?? '0';
        const total = ebayOrder.pricingSummary.total.value;
        const currency = ebayOrder.pricingSummary.total.currency;
        await this.ordersService.importOrder({
            channel: 'ebay',
            connectionId: store.connectionId,
            storeId: store.id,
            externalOrderId: ebayOrder.orderId,
            buyer: { username: ebayOrder.buyer?.username },
            shipping,
            financials: {
                subtotal,
                shippingCost: deliveryCost,
                total,
                currency,
            },
            items,
            orderedAt: new Date(ebayOrder.creationDate),
        });
        return true;
    }
};
exports.EbayOrderImportService = EbayOrderImportService;
exports.EbayOrderImportService = EbayOrderImportService = EbayOrderImportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(1, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(2, (0, typeorm_1.InjectRepository)(order_entity_js_1.Order)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_fulfillment_api_service_js_1.EbayFulfillmentApiService,
        orders_service_js_1.OrdersService])
], EbayOrderImportService);
//# sourceMappingURL=order-import-ebay.service.js.map