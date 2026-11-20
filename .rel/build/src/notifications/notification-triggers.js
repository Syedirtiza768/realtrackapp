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
var NotificationTriggers_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationTriggers = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const notifications_service_js_1 = require("./notifications.service.js");
let NotificationTriggers = NotificationTriggers_1 = class NotificationTriggers {
    notifService;
    logger = new common_1.Logger(NotificationTriggers_1.name);
    constructor(notifService) {
        this.notifService = notifService;
    }
    async onIngestionComplete(data) {
        await this.notifService.create({
            type: 'ingestion_complete',
            title: 'Ingestion Complete',
            body: data.title
                ? `AI processing finished for "${data.title}"`
                : 'AI ingestion job completed successfully',
            icon: 'check-circle',
            severity: 'success',
            entityType: 'ingestion_job',
            entityId: data.jobId,
            actionUrl: `/ingestion`,
        });
    }
    async onIngestionFailed(data) {
        await this.notifService.create({
            type: 'ingestion_failed',
            title: 'Ingestion Failed',
            body: data.error ?? 'AI ingestion job encountered an error',
            icon: 'x-circle',
            severity: 'error',
            entityType: 'ingestion_job',
            entityId: data.jobId,
            actionUrl: `/ingestion`,
        });
    }
    async onReviewNeeded(data) {
        await this.notifService.create({
            type: 'ai_review_needed',
            title: 'AI Review Required',
            body: data.confidence
                ? `Low confidence (${(data.confidence * 100).toFixed(0)}%) — manual review needed`
                : 'AI result requires human review',
            icon: 'eye',
            severity: 'warning',
            entityType: 'ingestion_job',
            entityId: data.jobId,
            actionUrl: `/ingestion`,
        });
    }
    async onChannelConnected(data) {
        await this.notifService.create({
            type: 'channel_connected',
            title: `${data.channel} Connected`,
            body: `Marketplace channel ${data.channel} connected successfully`,
            icon: 'link',
            severity: 'success',
            entityType: 'channel',
            entityId: data.connectionId,
        });
    }
    async onChannelError(data) {
        await this.notifService.create({
            type: 'channel_error',
            title: `${data.channel} Error`,
            body: data.error ?? `Error with ${data.channel} connection`,
            icon: 'alert-triangle',
            severity: 'error',
            entityType: 'channel',
            entityId: data.connectionId,
        });
    }
    async onListingPublished(data) {
        await this.notifService.create({
            type: 'listing_published',
            title: 'Listing Published',
            body: `"${data.title ?? 'Listing'}" published to ${data.channel}`,
            icon: 'upload-cloud',
            severity: 'success',
            entityType: 'listing',
            entityId: data.listingId,
            actionUrl: `/catalog`,
        });
    }
    async onLowStock(data) {
        await this.notifService.create({
            type: 'low_stock',
            title: 'Low Stock Alert',
            body: `"${data.title ?? 'Item'}" has ${data.available} left (threshold: ${data.threshold})`,
            icon: 'alert-triangle',
            severity: 'warning',
            entityType: 'listing',
            entityId: data.listingId,
            actionUrl: `/catalog`,
        });
    }
    async onOutOfStock(data) {
        await this.notifService.create({
            type: 'out_of_stock',
            title: 'Out of Stock',
            body: `"${data.title ?? 'Item'}" is out of stock`,
            icon: 'package-x',
            severity: 'error',
            entityType: 'listing',
            entityId: data.listingId,
            actionUrl: `/catalog`,
        });
    }
    async onNewOrder(data) {
        await this.notifService.create({
            type: 'new_order',
            title: 'New Order',
            body: data.total
                ? `New ${data.channel} order — $${data.total}`
                : `New order received from ${data.channel}`,
            icon: 'shopping-cart',
            severity: 'info',
            entityType: 'order',
            entityId: data.orderId,
            actionUrl: `/orders`,
        });
    }
    async onOrderShipped(data) {
        await this.notifService.create({
            type: 'order_shipped',
            title: 'Order Shipped',
            body: data.trackingNumber
                ? `Order shipped — tracking: ${data.trackingNumber}`
                : 'Order has been shipped',
            icon: 'truck',
            severity: 'success',
            entityType: 'order',
            entityId: data.orderId,
            actionUrl: `/orders`,
        });
    }
    async onSystemAlert(data) {
        await this.notifService.create({
            type: 'system_alert',
            title: data.title,
            body: data.body,
            icon: 'info',
            severity: data.severity ?? 'info',
        });
    }
};
exports.NotificationTriggers = NotificationTriggers;
__decorate([
    (0, event_emitter_1.OnEvent)('ingestion.completed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationTriggers.prototype, "onIngestionComplete", null);
__decorate([
    (0, event_emitter_1.OnEvent)('ingestion.failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationTriggers.prototype, "onIngestionFailed", null);
__decorate([
    (0, event_emitter_1.OnEvent)('ingestion.review_needed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationTriggers.prototype, "onReviewNeeded", null);
__decorate([
    (0, event_emitter_1.OnEvent)('channel.connected'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationTriggers.prototype, "onChannelConnected", null);
__decorate([
    (0, event_emitter_1.OnEvent)('channel.error'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationTriggers.prototype, "onChannelError", null);
__decorate([
    (0, event_emitter_1.OnEvent)('listing.published'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationTriggers.prototype, "onListingPublished", null);
__decorate([
    (0, event_emitter_1.OnEvent)('inventory.low_stock'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationTriggers.prototype, "onLowStock", null);
__decorate([
    (0, event_emitter_1.OnEvent)('inventory.out_of_stock'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationTriggers.prototype, "onOutOfStock", null);
__decorate([
    (0, event_emitter_1.OnEvent)('order.new'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationTriggers.prototype, "onNewOrder", null);
__decorate([
    (0, event_emitter_1.OnEvent)('order.shipped'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationTriggers.prototype, "onOrderShipped", null);
__decorate([
    (0, event_emitter_1.OnEvent)('system.alert'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationTriggers.prototype, "onSystemAlert", null);
exports.NotificationTriggers = NotificationTriggers = NotificationTriggers_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [notifications_service_js_1.NotificationsService])
], NotificationTriggers);
//# sourceMappingURL=notification-triggers.js.map