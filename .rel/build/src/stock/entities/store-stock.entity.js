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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserWarehouseAssignment = exports.ChannelStockSyncState = exports.StoreStockPolicy = exports.StoreWarehouseLink = void 0;
const typeorm_1 = require("typeorm");
let StoreWarehouseLink = class StoreWarehouseLink {
    id;
    organizationId;
    storeId;
    warehouseId;
    priority;
    active;
    createdAt;
};
exports.StoreWarehouseLink = StoreWarehouseLink;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], StoreWarehouseLink.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], StoreWarehouseLink.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid' }),
    __metadata("design:type", String)
], StoreWarehouseLink.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'warehouse_id', type: 'uuid' }),
    __metadata("design:type", String)
], StoreWarehouseLink.prototype, "warehouseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 100 }),
    __metadata("design:type", Number)
], StoreWarehouseLink.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], StoreWarehouseLink.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], StoreWarehouseLink.prototype, "createdAt", void 0);
exports.StoreWarehouseLink = StoreWarehouseLink = __decorate([
    (0, typeorm_1.Entity)('store_warehouse_links')
], StoreWarehouseLink);
let StoreStockPolicy = class StoreStockPolicy {
    storeId;
    organizationId;
    pushEnabled;
    bufferQty;
    maxQty;
    includeSourceable;
    maxSourceableQty;
    updatedAt;
};
exports.StoreStockPolicy = StoreStockPolicy;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'store_id', type: 'uuid' }),
    __metadata("design:type", String)
], StoreStockPolicy.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], StoreStockPolicy.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'push_enabled', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], StoreStockPolicy.prototype, "pushEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'buffer_qty', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StoreStockPolicy.prototype, "bufferQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_qty', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], StoreStockPolicy.prototype, "maxQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'include_sourceable', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], StoreStockPolicy.prototype, "includeSourceable", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_sourceable_qty', type: 'integer', default: 5 }),
    __metadata("design:type", Number)
], StoreStockPolicy.prototype, "maxSourceableQty", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], StoreStockPolicy.prototype, "updatedAt", void 0);
exports.StoreStockPolicy = StoreStockPolicy = __decorate([
    (0, typeorm_1.Entity)('store_stock_policies')
], StoreStockPolicy);
let ChannelStockSyncState = class ChannelStockSyncState {
    storeId;
    inventoryItemId;
    organizationId;
    dirty;
    desiredQty;
    pushedQty;
    channelQty;
    status;
    attempts;
    lastError;
    targets;
    lastPushedAt;
    updatedAt;
};
exports.ChannelStockSyncState = ChannelStockSyncState;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'store_id', type: 'uuid' }),
    __metadata("design:type", String)
], ChannelStockSyncState.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'inventory_item_id', type: 'uuid' }),
    __metadata("design:type", String)
], ChannelStockSyncState.prototype, "inventoryItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ChannelStockSyncState.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], ChannelStockSyncState.prototype, "dirty", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'desired_qty', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], ChannelStockSyncState.prototype, "desiredQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pushed_qty', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], ChannelStockSyncState.prototype, "pushedQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'channel_qty', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], ChannelStockSyncState.prototype, "channelQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'pending' }),
    __metadata("design:type", String)
], ChannelStockSyncState.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], ChannelStockSyncState.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ChannelStockSyncState.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: [] }),
    __metadata("design:type", Array)
], ChannelStockSyncState.prototype, "targets", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_pushed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ChannelStockSyncState.prototype, "lastPushedAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ChannelStockSyncState.prototype, "updatedAt", void 0);
exports.ChannelStockSyncState = ChannelStockSyncState = __decorate([
    (0, typeorm_1.Entity)('channel_stock_sync_state')
], ChannelStockSyncState);
let UserWarehouseAssignment = class UserWarehouseAssignment {
    userId;
    warehouseId;
    organizationId;
    createdAt;
};
exports.UserWarehouseAssignment = UserWarehouseAssignment;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], UserWarehouseAssignment.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'warehouse_id', type: 'uuid' }),
    __metadata("design:type", String)
], UserWarehouseAssignment.prototype, "warehouseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], UserWarehouseAssignment.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], UserWarehouseAssignment.prototype, "createdAt", void 0);
exports.UserWarehouseAssignment = UserWarehouseAssignment = __decorate([
    (0, typeorm_1.Entity)('user_warehouse_assignments')
], UserWarehouseAssignment);
//# sourceMappingURL=store-stock.entity.js.map