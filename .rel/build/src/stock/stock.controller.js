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
exports.StockController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
const stock_dto_js_1 = require("./dto/stock.dto.js");
const stock_access_service_js_1 = require("./stock-access.service.js");
const warehouses_service_js_1 = require("./warehouses.service.js");
const inventory_items_service_js_1 = require("./inventory-items.service.js");
const suppliers_service_js_1 = require("./suppliers.service.js");
const stock_operations_service_js_1 = require("./stock-operations.service.js");
const stock_reports_service_js_1 = require("./stock-reports.service.js");
const stock_setup_service_js_1 = require("./stock-setup.service.js");
let StockController = class StockController {
    access;
    rbac;
    warehouses;
    items;
    suppliers;
    ops;
    reports;
    setup;
    constructor(access, rbac, warehouses, items, suppliers, ops, reports, setup) {
        this.access = access;
        this.rbac = rbac;
        this.warehouses = warehouses;
        this.items = items;
        this.suppliers = suppliers;
        this.ops = ops;
        this.reports = reports;
        this.setup = setup;
    }
    scope(user, organizationId) {
        return this.access.scope(user, organizationId);
    }
    async can(user, key) {
        return (await this.rbac.getPermissionKeysForUser(user.id)).has(key);
    }
    async summary(user, org) {
        return this.reports.summary(await this.scope(user, org), await this.can(user, 'stock.valuation.view'));
    }
    async setupStatus(user, org) {
        return this.setup.status(await this.scope(user, org));
    }
    async bootstrap(user, dto, org) {
        return this.setup.bootstrap(await this.scope(user, org), dto);
    }
    async listWarehouses(user, org, inactive) {
        return this.warehouses.list(await this.scope(user, org), inactive === 'true');
    }
    async createWarehouse(user, dto, org) {
        return this.warehouses.create(await this.scope(user, org), dto);
    }
    async updateWarehouse(user, id, dto, org) {
        return this.warehouses.update(await this.scope(user, org), id, dto);
    }
    async listLocations(user, id, org, inactive) {
        return this.warehouses.listLocations(await this.scope(user, org), id, inactive === 'true');
    }
    async createLocation(user, id, dto, org) {
        return this.warehouses.createLocation(await this.scope(user, org), id, dto);
    }
    async generateLocations(user, id, dto, org) {
        return this.warehouses.generateLocations(await this.scope(user, org), id, dto);
    }
    async updateLocation(user, id, dto, org) {
        return this.warehouses.updateLocation(await this.scope(user, org), id, dto);
    }
    async stores(user, org) {
        return this.warehouses.storeOverview(await this.scope(user, org));
    }
    async setStoreLinks(user, storeId, dto, org) {
        return this.warehouses.setStoreLinks(await this.scope(user, org), storeId, dto);
    }
    async setStorePolicy(user, storeId, dto, org) {
        return this.warehouses.setStorePolicy(await this.scope(user, org), storeId, dto);
    }
    async getAssignments(user, userId, org) {
        return this.warehouses.getAssignments(await this.scope(user, org), userId);
    }
    async setAssignments(user, userId, dto, org) {
        return this.warehouses.setAssignments(await this.scope(user, org), userId, dto.warehouseIds);
    }
    async listItems(user, q, org) {
        return this.items.list(await this.scope(user, org), q, await this.can(user, 'stock.valuation.view'));
    }
    async createItem(user, dto, org) {
        return this.items.create(await this.scope(user, org), dto);
    }
    async itemDetail(user, id, org) {
        const keys = await this.rbac.getPermissionKeysForUser(user.id);
        return this.items.detail(await this.scope(user, org), id, {
            canSeeCost: keys.has('stock.valuation.view'),
            canSeePrivateSerials: keys.has('stock.serials.private'),
        });
    }
    async updateItem(user, id, dto, org) {
        return this.items.update(await this.scope(user, org), id, dto);
    }
    async scan(user, dto, org) {
        return this.items.scan(await this.scope(user, org), dto.code, await this.can(user, 'stock.serials.private'));
    }
    async listSources(user, id, org) {
        return this.suppliers.listForItem(await this.scope(user, org), id);
    }
    async upsertSource(user, id, dto, org) {
        return this.suppliers.upsertSource(await this.scope(user, org), id, dto);
    }
    async removeSource(user, id, sourceId, org) {
        return this.suppliers.removeSource(await this.scope(user, org), id, sourceId);
    }
    async receive(user, dto, org) {
        return this.ops.receive(await this.scope(user, org), dto);
    }
    async adjust(user, dto, org) {
        return this.ops.adjust(await this.scope(user, org), dto, { canApprove: await this.can(user, 'stock.adjust.approve') });
    }
    async move(user, dto, org) {
        return this.ops.move(await this.scope(user, org), dto);
    }
    async damage(user, dto, org) {
        return this.ops.damage(await this.scope(user, org), dto);
    }
    async listDocuments(user, q, org) {
        return this.ops.listDocuments(await this.scope(user, org), q);
    }
    async getDocument(user, id, org) {
        const doc = await this.ops.getDocument(await this.scope(user, org), id);
        if (doc.docType === 'count' && doc.status === 'draft' && !(await this.can(user, 'stock.adjust.approve')))
            doc.lines = doc.lines.map((l) => ({ ...l, systemQty: null }));
        return doc;
    }
    async cancelDocument(user, id, org) {
        return this.ops.cancelDocument(await this.scope(user, org), id);
    }
    async createAdjustment(user, dto, org) {
        return this.ops.createAdjustmentDocument(await this.scope(user, org), dto, { canApprove: await this.can(user, 'stock.adjust.approve') });
    }
    async approveAdjustment(user, id, org) {
        return this.ops.approveAdjustment(await this.scope(user, org), id, { canApprove: true });
    }
    async createTransfer(user, dto, org) {
        return this.ops.createTransfer(await this.scope(user, org), dto);
    }
    async shipTransfer(user, id, org) {
        return this.ops.shipTransfer(await this.scope(user, org), id);
    }
    async receiveTransfer(user, id, dto, org) {
        return this.ops.receiveTransfer(await this.scope(user, org), id, dto);
    }
    async createCount(user, dto, org) {
        return this.ops.createCount(await this.scope(user, org), dto);
    }
    async recordCount(user, id, dto, org) {
        return this.ops.recordCount(await this.scope(user, org), id, dto);
    }
    async submitCount(user, id, org) {
        return this.ops.submitCount(await this.scope(user, org), id, { canApprove: await this.can(user, 'stock.adjust.approve') });
    }
    async movements(user, q, org) {
        return this.ops.listMovements(await this.scope(user, org), q);
    }
    async valuation(user, org) {
        return this.reports.valuation(await this.scope(user, org));
    }
    async aging(user, org) {
        return this.reports.aging(await this.scope(user, org));
    }
};
exports.StockController = StockController;
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('setup/status'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "setupStatus", null);
__decorate([
    (0, common_1.Post)('setup/bootstrap'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.warehouses.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.BootstrapDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "bootstrap", null);
__decorate([
    (0, common_1.Get)('warehouses'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Query)('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listWarehouses", null);
__decorate([
    (0, common_1.Post)('warehouses'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.warehouses.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.WarehouseDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "createWarehouse", null);
__decorate([
    (0, common_1.Patch)('warehouses/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.warehouses.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.UpdateWarehouseDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "updateWarehouse", null);
__decorate([
    (0, common_1.Get)('warehouses/:id/locations'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __param(3, (0, common_1.Query)('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listLocations", null);
__decorate([
    (0, common_1.Post)('warehouses/:id/locations'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.warehouses.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.LocationDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "createLocation", null);
__decorate([
    (0, common_1.Post)('warehouses/:id/locations/generate'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.warehouses.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.GenerateLocationsDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "generateLocations", null);
__decorate([
    (0, common_1.Patch)('locations/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.warehouses.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.UpdateLocationDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "updateLocation", null);
__decorate([
    (0, common_1.Get)('stores'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "stores", null);
__decorate([
    (0, common_1.Put)('stores/:storeId/links'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.warehouses.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('storeId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.SetStoreLinksDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "setStoreLinks", null);
__decorate([
    (0, common_1.Patch)('stores/:storeId/policy'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.channel_sync.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('storeId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.StorePolicyDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "setStorePolicy", null);
__decorate([
    (0, common_1.Get)('users/:userId/warehouses'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.warehouses.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "getAssignments", null);
__decorate([
    (0, common_1.Put)('users/:userId/warehouses'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.warehouses.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.WarehouseAssignmentsDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "setAssignments", null);
__decorate([
    (0, common_1.Get)('items'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.ItemsQueryDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listItems", null);
__decorate([
    (0, common_1.Post)('items'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.receive'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.CreateItemDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "createItem", null);
__decorate([
    (0, common_1.Get)('items/:id'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "itemDetail", null);
__decorate([
    (0, common_1.Patch)('items/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.receive'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.UpdateItemDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "updateItem", null);
__decorate([
    (0, common_1.Post)('scan'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.ScanDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "scan", null);
__decorate([
    (0, common_1.Get)('items/:id/sources'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listSources", null);
__decorate([
    (0, common_1.Put)('items/:id/sources'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.procure'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.ItemSourceDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "upsertSource", null);
__decorate([
    (0, common_1.Delete)('items/:id/sources/:sourceId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.procure'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('sourceId', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "removeSource", null);
__decorate([
    (0, common_1.Post)('receive'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.receive'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.ReceiveDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "receive", null);
__decorate([
    (0, common_1.Post)('adjust'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.adjust'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.AdjustDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "adjust", null);
__decorate([
    (0, common_1.Post)('move'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.move'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.MoveDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "move", null);
__decorate([
    (0, common_1.Post)('damage'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.adjust'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.DamageDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "damage", null);
__decorate([
    (0, common_1.Get)('documents'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.DocumentsQueryDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listDocuments", null);
__decorate([
    (0, common_1.Get)('documents/:id'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "getDocument", null);
__decorate([
    (0, common_1.Post)('documents/:id/cancel'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.move'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "cancelDocument", null);
__decorate([
    (0, common_1.Post)('adjustments'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.adjust'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.CreateAdjustmentDocDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "createAdjustment", null);
__decorate([
    (0, common_1.Post)('adjustments/:id/approve'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.adjust.approve'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "approveAdjustment", null);
__decorate([
    (0, common_1.Post)('transfers'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.move'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.CreateTransferDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "createTransfer", null);
__decorate([
    (0, common_1.Post)('transfers/:id/ship'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.move'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "shipTransfer", null);
__decorate([
    (0, common_1.Post)('transfers/:id/receive'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.receive'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.ReceiveDocumentDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "receiveTransfer", null);
__decorate([
    (0, common_1.Post)('counts'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.count'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.CreateCountDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "createCount", null);
__decorate([
    (0, common_1.Put)('counts/:id/lines'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.count'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, stock_dto_js_1.RecordCountDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "recordCount", null);
__decorate([
    (0, common_1.Post)('counts/:id/submit'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.count'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "submitCount", null);
__decorate([
    (0, common_1.Get)('movements'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, stock_dto_js_1.MovementsQueryDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "movements", null);
__decorate([
    (0, common_1.Get)('reports/valuation'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view', 'stock.valuation.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "valuation", null);
__decorate([
    (0, common_1.Get)('reports/aging'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "aging", null);
exports.StockController = StockController = __decorate([
    (0, swagger_1.ApiTags)('stock'),
    (0, common_1.Controller)('stock'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stock.view'),
    __metadata("design:paramtypes", [stock_access_service_js_1.StockAccessService,
        rbac_service_js_1.RbacService,
        warehouses_service_js_1.WarehousesService,
        inventory_items_service_js_1.InventoryItemsService,
        suppliers_service_js_1.SuppliersService,
        stock_operations_service_js_1.StockOperationsService,
        stock_reports_service_js_1.StockReportsService,
        stock_setup_service_js_1.StockSetupService])
], StockController);
//# sourceMappingURL=stock.controller.js.map