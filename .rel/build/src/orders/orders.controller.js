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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const orders_service_js_1 = require("./orders.service.js");
const order_fulfillment_service_js_1 = require("./order-fulfillment.service.js");
const order_import_ebay_service_js_1 = require("./order-import-ebay.service.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const orders_dto_js_1 = require("./dto/orders.dto.js");
let OrdersController = class OrdersController {
    ordersService;
    fulfillmentService;
    ebayImportService;
    constructor(ordersService, fulfillmentService, ebayImportService) {
        this.ordersService = ordersService;
        this.fulfillmentService = fulfillmentService;
        this.ebayImportService = ebayImportService;
    }
    findAll(dto) {
        return this.ordersService.findAll(dto);
    }
    getStats() {
        return this.ordersService.getStats();
    }
    findOne(id) {
        return this.ordersService.findOne(id);
    }
    updateStatus(id, dto) {
        return this.ordersService.transitionStatus(id, dto.status, dto.reason);
    }
    updateShipping(id, dto) {
        return this.ordersService.updateShipping(id, dto);
    }
    refund(id, dto) {
        return this.ordersService.processRefund(id, dto);
    }
    shipOrder(id, dto) {
        return this.fulfillmentService.markShipped(id, {
            carrier: dto.trackingCarrier ?? 'OTHER',
            trackingNumber: dto.trackingNumber,
        });
    }
    bulkShip(dto) {
        return this.fulfillmentService.bulkShip(dto.items);
    }
    bulkCancel(dto) {
        return this.fulfillmentService.bulkCancel(dto.orderIds, dto.reason);
    }
    trackingUpload(dto) {
        return this.fulfillmentService.processTrackingCsv(dto.csvContent);
    }
    importEbayOrders(dto) {
        if (dto.storeId) {
            return this.ebayImportService.importFromStore(dto.storeId);
        }
        return this.ebayImportService.importFromAllStores();
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('orders.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List orders (paginated, filtered)' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [orders_dto_js_1.OrdersQueryDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('orders.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Order count by status' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('orders.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Order detail with items' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('orders.update'),
    (0, swagger_1.ApiOperation)({ summary: 'Transition order status (FSM enforced)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, orders_dto_js_1.UpdateOrderStatusDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Patch)(':id/shipping'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('orders.ship'),
    (0, swagger_1.ApiOperation)({
        summary: 'Add/update tracking number (auto-ships if processing)',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, orders_dto_js_1.UpdateShippingDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "updateShipping", null);
__decorate([
    (0, common_1.Post)(':id/refund'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('orders.refund'),
    (0, swagger_1.ApiOperation)({ summary: 'Process refund' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, orders_dto_js_1.RefundDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "refund", null);
__decorate([
    (0, common_1.Post)(':id/ship'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('orders.ship'),
    (0, swagger_1.ApiOperation)({
        summary: 'Mark single order as shipped (pushes tracking to eBay)',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, orders_dto_js_1.UpdateShippingDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "shipOrder", null);
__decorate([
    (0, common_1.Post)('bulk/ship'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('orders.ship'),
    (0, swagger_1.ApiOperation)({ summary: 'Bulk ship multiple orders with tracking info' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [orders_dto_js_1.BulkShipDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "bulkShip", null);
__decorate([
    (0, common_1.Post)('bulk/cancel'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('orders.update'),
    (0, swagger_1.ApiOperation)({ summary: 'Bulk cancel multiple orders' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [orders_dto_js_1.BulkCancelDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "bulkCancel", null);
__decorate([
    (0, common_1.Post)('bulk/tracking-upload'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('orders.ship'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload CSV tracking file to bulk-ship orders' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [orders_dto_js_1.CsvTrackingUploadDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "trackingUpload", null);
__decorate([
    (0, common_1.Post)('import/ebay'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('orders.import'),
    (0, swagger_1.ApiOperation)({
        summary: 'Manually trigger eBay order import (all stores or one store)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [orders_dto_js_1.ManualImportDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "importEbayOrders", null);
exports.OrdersController = OrdersController = __decorate([
    (0, swagger_1.ApiTags)('orders'),
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [orders_service_js_1.OrdersService,
        order_fulfillment_service_js_1.OrderFulfillmentService,
        order_import_ebay_service_js_1.EbayOrderImportService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map