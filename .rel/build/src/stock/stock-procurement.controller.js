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
exports.StockProcurementController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const stock_dto_js_1 = require("./dto/stock.dto.js");
const stock_access_service_js_1 = require("./stock-access.service.js");
const suppliers_service_js_1 = require("./suppliers.service.js");
const procurement_service_js_1 = require("./procurement.service.js");
const order_stock_service_js_1 = require("./order-stock.service.js");
const channel_stock_sync_service_js_1 = require("./channel-stock-sync.service.js");
class LinkLineDto {
    itemId;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], LinkLineDto.prototype, "itemId", void 0);
let StockProcurementController = class StockProcurementController {
    access;
    suppliers;
    procurement;
    orders;
    channels;
    constructor(access, suppliers, procurement, orders, channels) {
        this.access = access;
        this.suppliers = suppliers;
        this.procurement = procurement;
        this.orders = orders;
        this.channels = channels;
    }
    scope(user, organizationId) {
        return this.access.scope(user, organizationId);
    }
    async listSuppliers(user, org, inactive) {
        return this.suppliers.list(await this.scope(user, org), inactive === 'true');
    }
    async createSupplier(user, dto, org) {
        return this.suppliers.create(await this.scope(user, org), dto);
    }
    async updateSupplier(user, id, dto, org) {
        return this.suppliers.update(await this.scope(user, org), id, dto);
    }
    async procurementSummary(user, org) {
        return this.procurement.summary(await this.scope(user, org));
    }
    async listRequests(user, q, org) {
        return this.procurement.listRequests(await this.scope(user, org), q);
    }
    async createRequest(user, dto, org) {
        return this.procurement.createRequest(await this.scope(user, org), dto);
    }
    async updateRequest(user, id, dto, org) {
        return this.procurement.updateRequest(await this.scope(user, org), id, dto);
    }
    async cancelRequest(user, id, org) {
        return this.procurement.cancelRequest(await this.scope(user, org), id);
    }
    async dropship(user, id, dto, org) {
        return this.procurement.markDropshipped(await this.scope(user, org), id, dto);
    }
    async reorder(user, org) {
        return this.procurement.reorderSuggestions(await this.scope(user, org), false);
    }
    async createReorder(user, dto, org) {
        return this.procurement.reorderSuggestions(await this.scope(user, org), dto.createRequests ?? true);
    }
    async createPo(user, dto, org) {
        return this.procurement.createPurchaseOrder(await this.scope(user, org), dto);
    }
    async poFromRequests(user, dto, org) {
        return this.procurement.purchaseOrdersFromRequests(await this.scope(user, org), dto);
    }
    async orderPo(user, id, org) {
        return this.procurement.orderPurchaseOrder(await this.scope(user, org), id);
    }
    async receivePo(user, id, dto, org) {
        return this.procurement.receivePurchaseOrder(await this.scope(user, org), id, dto);
    }
    async cancelPo(user, id, org) {
        return this.procurement.cancelPurchaseOrder(await this.scope(user, org), id);
    }
    async exceptions(user, org) {
        return this.orders.exceptions(await this.scope(user, org));
    }
    async pickList(user, warehouseId, org) {
        return this.orders.pickList(await this.scope(user, org), warehouseId);
    }
    async orderStock(user, orderId, org) {
        return this.orders.orderStock(await this.scope(user, org), orderId);
    }
    async allocate(user, orderId, org) {
        await this.orders.orderStock(await this.scope(user, org), orderId);
        return this.orders.allocateOrder(orderId, { reclaimOpenRequests: true });
    }
    async pick(user, orderId, org) {
        return this.orders.pickOrder(await this.scope(user, org), orderId);
    }
    async linkLine(user, orderId, orderItemId, dto, org) {
        return this.orders.linkLine(await this.scope(user, org), orderId, orderItemId, dto.itemId);
    }
    async channelSync(user, storeId, status, driftOnly, limit, offset, org) {
        return this.channels.list(await this.scope(user, org), {
            storeId,
            status,
            driftOnly: driftOnly === 'true',
            limit: limit ? Number(limit) : undefined,
            offset: offset ? Number(offset) : undefined,
        });
    }
    async channelSummary(user, org) {
        return this.channels.summary(await this.scope(user, org));
    }
    async resync(user, storeId, org) {
        return this.channels.resync(await this.scope(user, org), storeId);
    }
};
exports.StockProcurementController = StockProcurementController;
__decorate([
    (0, common_1.Get)('suppliers'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Query)('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "listSuppliers", null);
__decorate([
    (0, common_1.Post)('suppliers'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.procure'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.SupplierDto, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "createSupplier", null);
__decorate([
    (0, common_1.Patch)('suppliers/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.procure'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.UpdateSupplierDto, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "updateSupplier", null);
__decorate([
    (0, common_1.Get)('procurement/summary'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "procurementSummary", null);
__decorate([
    (0, common_1.Get)('procurement/requests'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.ProcurementQueryDto, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "listRequests", null);
__decorate([
    (0, common_1.Post)('procurement/requests'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.procure'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.CreateProcurementRequestDto, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "createRequest", null);
__decorate([
    (0, common_1.Patch)('procurement/requests/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.procure'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.UpdateProcurementRequestDto, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "updateRequest", null);
__decorate([
    (0, common_1.Post)('procurement/requests/:id/cancel'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.procure'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "cancelRequest", null);
__decorate([
    (0, common_1.Post)('procurement/requests/:id/dropship'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.procure'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.DropshipDto, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "dropship", null);
__decorate([
    (0, common_1.Get)('procurement/reorder'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "reorder", null);
__decorate([
    (0, common_1.Post)('procurement/reorder'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.procure'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.ReorderSuggestDto, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "createReorder", null);
__decorate([
    (0, common_1.Post)('purchase-orders'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.procure'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.CreatePurchaseOrderDto, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "createPo", null);
__decorate([
    (0, common_1.Post)('purchase-orders/from-requests'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.procure'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.FromRequestsDto, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "poFromRequests", null);
__decorate([
    (0, common_1.Post)('purchase-orders/:id/order'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.procure'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "orderPo", null);
__decorate([
    (0, common_1.Post)('purchase-orders/:id/receive'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.receive'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.ReceiveDocumentDto, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "receivePo", null);
__decorate([
    (0, common_1.Post)('purchase-orders/:id/cancel'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.procure'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "cancelPo", null);
__decorate([
    (0, common_1.Get)('orders/exceptions'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "exceptions", null);
__decorate([
    (0, common_1.Get)('orders/pick-list'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('warehouseId')),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "pickList", null);
__decorate([
    (0, common_1.Get)('orders/:orderId'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('orderId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "orderStock", null);
__decorate([
    (0, common_1.Post)('orders/:orderId/allocate'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.fulfil'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('orderId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "allocate", null);
__decorate([
    (0, common_1.Post)('orders/:orderId/pick'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.fulfil'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('orderId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "pick", null);
__decorate([
    (0, common_1.Post)('orders/:orderId/lines/:orderItemId/link'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.fulfil'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('orderId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('orderItemId', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String, LinkLineDto, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "linkLine", null);
__decorate([
    (0, common_1.Get)('channel-sync'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('storeId')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('driftOnly')),
    __param(4, (0, common_1.Query)('limit')),
    __param(5, (0, common_1.Query)('offset')),
    __param(6, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "channelSync", null);
__decorate([
    (0, common_1.Get)('channel-sync/summary'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "channelSummary", null);
__decorate([
    (0, common_1.Post)('channel-sync/resync'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.channel_sync.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('storeId')),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockProcurementController.prototype, "resync", null);
exports.StockProcurementController = StockProcurementController = __decorate([
    (0, swagger_1.ApiTags)('stock'),
    (0, common_1.Controller)('stock'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view'),
    __metadata("design:paramtypes", [stock_access_service_js_1.StockAccessService,
        suppliers_service_js_1.SuppliersService,
        procurement_service_js_1.ProcurementService,
        order_stock_service_js_1.OrderStockService,
        channel_stock_sync_service_js_1.ChannelStockSyncService])
], StockProcurementController);
//# sourceMappingURL=stock-procurement.controller.js.map