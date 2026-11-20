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
var InventoryRealtimeSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryRealtimeSyncService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const feature_flag_service_js_1 = require("../common/feature-flags/feature-flag.service.js");
let InventoryRealtimeSyncService = InventoryRealtimeSyncService_1 = class InventoryRealtimeSyncService {
    inventoryQueue;
    featureFlags;
    logger = new common_1.Logger(InventoryRealtimeSyncService_1.name);
    constructor(inventoryQueue, featureFlags) {
        this.inventoryQueue = inventoryQueue;
        this.featureFlags = featureFlags;
    }
    async handleInventoryChange(payload) {
        const enabled = await this.featureFlags.isEnabled('inventory_real_time_sync');
        if (!enabled) {
            this.logger.debug('inventory_real_time_sync flag disabled — skipping');
            return;
        }
        this.logger.log(`Inventory change from ${payload.channel}: ${payload.externalId} → qty=${payload.quantityAvailable ?? '?'}`);
        await this.inventoryQueue.add('reconcile', {
            trigger: 'webhook',
            channel: payload.channel,
            externalId: payload.externalId,
            sku: payload.sku,
            quantityAvailable: payload.quantityAvailable,
            listingIds: [],
        }, {
            jobId: `webhook-inv-${payload.channel}-${payload.externalId}-${Date.now()}`,
            delay: 2000,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
        });
    }
    async handleOrderCreated(payload) {
        const enabled = await this.featureFlags.isEnabled('inventory_real_time_sync');
        if (!enabled)
            return;
        this.logger.log(`New order ${payload.orderId} from ${payload.channel} — enqueuing reconcile`);
        await this.inventoryQueue.add('reconcile', {
            trigger: 'order_created',
            channel: payload.channel,
            orderId: payload.orderId,
            listingIds: [],
        }, {
            jobId: `order-inv-${payload.orderId}-${Date.now()}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
        });
    }
    async processEbayInventoryWebhook(body) {
        const metadata = body['metadata'];
        const notification = body['notification'];
        if (!notification)
            return;
        const topic = metadata?.['topic'] ?? '';
        if (!topic.includes('INVENTORY') && !topic.includes('ITEM'))
            return;
        const itemId = notification['itemId'] ?? '';
        const quantity = notification['availableQuantity'];
        if (itemId) {
            await this.handleWebhookPayload('ebay', itemId, undefined, quantity);
        }
    }
    async processShopifyInventoryWebhook(topic, body) {
        if (!topic.includes('inventory') && !topic.includes('products'))
            return;
        const inventoryItemId = body['inventory_item_id'];
        const sku = body['sku'];
        const available = body['available'];
        const externalId = inventoryItemId ?? (body['id'] ? String(body['id']) : '');
        if (externalId) {
            await this.handleWebhookPayload('shopify', externalId, sku, available);
        }
    }
    async processAmazonInventoryWebhook(body) {
        const detail = body['detail'];
        if (!detail)
            return;
        const sku = detail['SellerSKU'] ?? '';
        const available = detail['FulfillableQuantity'];
        if (sku) {
            await this.handleWebhookPayload('amazon', sku, sku, available);
        }
    }
    async processWalmartInventoryWebhook(body) {
        const sku = body['sku'] ?? '';
        const quantity = body['quantity'];
        const available = quantity?.['amount'];
        if (sku) {
            await this.handleWebhookPayload('walmart', sku, sku, available);
        }
    }
    async handleWebhookPayload(channel, externalId, sku, quantityAvailable) {
        await this.handleInventoryChange({
            channel,
            externalId,
            sku,
            quantityAvailable,
            source: 'webhook',
        });
    }
};
exports.InventoryRealtimeSyncService = InventoryRealtimeSyncService;
__decorate([
    (0, event_emitter_1.OnEvent)('webhook.inventory_change'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InventoryRealtimeSyncService.prototype, "handleInventoryChange", null);
__decorate([
    (0, event_emitter_1.OnEvent)('order.new'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InventoryRealtimeSyncService.prototype, "handleOrderCreated", null);
exports.InventoryRealtimeSyncService = InventoryRealtimeSyncService = InventoryRealtimeSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('inventory')),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        feature_flag_service_js_1.FeatureFlagService])
], InventoryRealtimeSyncService);
//# sourceMappingURL=inventory-realtime-sync.service.js.map