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
var OrderFulfillmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderFulfillmentService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const order_entity_js_1 = require("./entities/order.entity.js");
const order_item_entity_js_1 = require("./entities/order-item.entity.js");
const store_entity_js_1 = require("../channels/entities/store.entity.js");
const ebay_fulfillment_api_service_js_1 = require("../channels/ebay/ebay-fulfillment-api.service.js");
const orders_service_js_1 = require("./orders.service.js");
let OrderFulfillmentService = OrderFulfillmentService_1 = class OrderFulfillmentService {
    orderRepo;
    itemRepo;
    storeRepo;
    fulfillmentApi;
    ordersService;
    eventEmitter;
    logger = new common_1.Logger(OrderFulfillmentService_1.name);
    constructor(orderRepo, itemRepo, storeRepo, fulfillmentApi, ordersService, eventEmitter) {
        this.orderRepo = orderRepo;
        this.itemRepo = itemRepo;
        this.storeRepo = storeRepo;
        this.fulfillmentApi = fulfillmentApi;
        this.ordersService = ordersService;
        this.eventEmitter = eventEmitter;
    }
    async markShipped(orderId, tracking) {
        const { order, items } = await this.ordersService.findOne(orderId);
        if (!order.storeId || order.channel !== 'ebay' || !order.externalOrderId) {
            return this.ordersService.updateShipping(orderId, {
                trackingNumber: tracking.trackingNumber,
                trackingCarrier: tracking.carrier,
            });
        }
        try {
            const lineItems = items.map((item) => ({
                lineItemId: item.externalItemId ?? item.id,
                quantity: item.quantity,
            }));
            await this.fulfillmentApi.createShippingFulfillment(order.storeId, order.externalOrderId, {
                lineItems,
                shippingCarrierCode: tracking.carrier,
                trackingNumber: tracking.trackingNumber,
            });
            this.logger.log(`Pushed tracking to eBay for order ${order.externalOrderId}: ${tracking.carrier} ${tracking.trackingNumber}`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to push tracking to eBay for order ${orderId}: ${msg}`);
        }
        const updated = await this.ordersService.updateShipping(orderId, {
            trackingNumber: tracking.trackingNumber,
            trackingCarrier: tracking.carrier,
        });
        this.eventEmitter.emit('order.shipped', {
            orderId: order.id,
            channel: order.channel,
            storeId: order.storeId,
            trackingNumber: tracking.trackingNumber,
            carrier: tracking.carrier,
        });
        return updated;
    }
    async bulkShip(items) {
        const results = [];
        for (const item of items) {
            try {
                await this.markShipped(item.orderId, {
                    carrier: item.carrier,
                    trackingNumber: item.trackingNumber,
                });
                results.push({ orderId: item.orderId, success: true });
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                results.push({ orderId: item.orderId, success: false, error: msg });
            }
        }
        const successCount = results.filter((r) => r.success).length;
        this.logger.log(`Bulk shipped ${successCount}/${items.length} orders`);
        return results;
    }
    async bulkCancel(orderIds, reason = 'Cancelled in bulk') {
        const results = [];
        for (const orderId of orderIds) {
            try {
                await this.ordersService.transitionStatus(orderId, 'cancelled', reason);
                results.push({ orderId, success: true });
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                results.push({ orderId, success: false, error: msg });
            }
        }
        return results;
    }
    async processTrackingCsv(csvContent) {
        const lines = csvContent
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        if (lines.length < 2) {
            throw new common_1.BadRequestException('CSV must have a header row and at least one data row');
        }
        const headerLine = lines[0].toLowerCase();
        const headers = headerLine.split(',').map((h) => h.trim());
        const orderIdIdx = headers.findIndex((h) => h === 'orderid' ||
            h === 'order_id' ||
            h === 'externalorderid' ||
            h === 'external_order_id');
        const trackingIdx = headers.findIndex((h) => h === 'trackingnumber' || h === 'tracking_number' || h === 'tracking');
        const carrierIdx = headers.findIndex((h) => h === 'carrier' ||
            h === 'shippingcarriercode' ||
            h === 'shipping_carrier');
        if (orderIdIdx < 0 || trackingIdx < 0) {
            throw new common_1.BadRequestException('CSV must include columns: orderId (or externalOrderId), trackingNumber');
        }
        const errors = [];
        let succeeded = 0;
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim());
            const orderIdValue = cols[orderIdIdx] ?? '';
            const trackingNumber = cols[trackingIdx] ?? '';
            const carrier = carrierIdx >= 0 ? (cols[carrierIdx] ?? 'OTHER') : 'OTHER';
            if (!orderIdValue || !trackingNumber) {
                errors.push({
                    row: i + 1,
                    orderId: orderIdValue,
                    error: 'Missing orderId or trackingNumber',
                });
                continue;
            }
            try {
                let order = await this.orderRepo.findOneBy({ id: orderIdValue });
                if (!order) {
                    order = await this.orderRepo.findOneBy({
                        externalOrderId: orderIdValue,
                    });
                }
                if (!order) {
                    errors.push({
                        row: i + 1,
                        orderId: orderIdValue,
                        error: 'Order not found',
                    });
                    continue;
                }
                await this.markShipped(order.id, { carrier, trackingNumber });
                succeeded++;
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                errors.push({ row: i + 1, orderId: orderIdValue, error: msg });
            }
        }
        const processed = lines.length - 1;
        this.logger.log(`CSV tracking upload: ${succeeded}/${processed} succeeded, ${errors.length} errors`);
        return {
            processed,
            succeeded,
            failed: errors.length,
            errors,
        };
    }
};
exports.OrderFulfillmentService = OrderFulfillmentService;
exports.OrderFulfillmentService = OrderFulfillmentService = OrderFulfillmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(order_entity_js_1.Order)),
    __param(1, (0, typeorm_1.InjectRepository)(order_item_entity_js_1.OrderItem)),
    __param(2, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_fulfillment_api_service_js_1.EbayFulfillmentApiService,
        orders_service_js_1.OrdersService,
        event_emitter_1.EventEmitter2])
], OrderFulfillmentService);
//# sourceMappingURL=order-fulfillment.service.js.map