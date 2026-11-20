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
exports.InventoryUnit = exports.StockLevel = exports.InventoryItem = void 0;
const typeorm_1 = require("typeorm");
let InventoryItem = class InventoryItem {
    id;
    organizationId;
    vertical;
    sku;
    title;
    imageUrl;
    catalogProductId;
    listingRecordId;
    productVariantId;
    trackingMode;
    sourcingMode;
    unitCost;
    currency;
    barcode;
    lowStockThreshold;
    reorderPoint;
    reorderQty;
    status;
    createdAt;
    updatedAt;
};
exports.InventoryItem = InventoryItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], InventoryItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], InventoryItem.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, default: 'automotive' }),
    __metadata("design:type", String)
], InventoryItem.prototype, "vertical", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 160 }),
    __metadata("design:type", String)
], InventoryItem.prototype, "sku", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], InventoryItem.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'image_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], InventoryItem.prototype, "imageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], InventoryItem.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_record_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], InventoryItem.prototype, "listingRecordId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'product_variant_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], InventoryItem.prototype, "productVariantId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'tracking_mode',
        type: 'varchar',
        length: 12,
        default: 'quantity',
    }),
    __metadata("design:type", String)
], InventoryItem.prototype, "trackingMode", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'sourcing_mode',
        type: 'varchar',
        length: 12,
        default: 'stocked',
    }),
    __metadata("design:type", String)
], InventoryItem.prototype, "sourcingMode", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'unit_cost',
        type: 'numeric',
        precision: 12,
        scale: 4,
        nullable: true,
    }),
    __metadata("design:type", Object)
], InventoryItem.prototype, "unitCost", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 3, default: 'USD' }),
    __metadata("design:type", String)
], InventoryItem.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", Object)
], InventoryItem.prototype, "barcode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'low_stock_threshold', type: 'integer', default: 1 }),
    __metadata("design:type", Number)
], InventoryItem.prototype, "lowStockThreshold", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reorder_point', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], InventoryItem.prototype, "reorderPoint", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reorder_qty', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], InventoryItem.prototype, "reorderQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'active' }),
    __metadata("design:type", String)
], InventoryItem.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], InventoryItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], InventoryItem.prototype, "updatedAt", void 0);
exports.InventoryItem = InventoryItem = __decorate([
    (0, typeorm_1.Entity)('inventory_items'),
    (0, typeorm_1.Index)('uq_ii_org_sku', ['organizationId', 'sku'], { unique: true })
], InventoryItem);
let StockLevel = class StockLevel {
    id;
    organizationId;
    inventoryItemId;
    warehouseId;
    locationId;
    onHand;
    reserved;
    damaged;
    inbound;
    available;
    lastReceivedAt;
    version;
    updatedAt;
};
exports.StockLevel = StockLevel;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], StockLevel.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], StockLevel.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'inventory_item_id', type: 'uuid' }),
    __metadata("design:type", String)
], StockLevel.prototype, "inventoryItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'warehouse_id', type: 'uuid' }),
    __metadata("design:type", String)
], StockLevel.prototype, "warehouseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'location_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockLevel.prototype, "locationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'on_hand', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StockLevel.prototype, "onHand", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StockLevel.prototype, "reserved", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StockLevel.prototype, "damaged", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StockLevel.prototype, "inbound", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', insert: false, update: false, nullable: true }),
    __metadata("design:type", Object)
], StockLevel.prototype, "available", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_received_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], StockLevel.prototype, "lastReceivedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 1 }),
    __metadata("design:type", Number)
], StockLevel.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], StockLevel.prototype, "updatedAt", void 0);
exports.StockLevel = StockLevel = __decorate([
    (0, typeorm_1.Entity)('stock_levels')
], StockLevel);
let InventoryUnit = class InventoryUnit {
    id;
    organizationId;
    inventoryItemId;
    warehouseId;
    locationId;
    serialPrivate;
    serialPublic;
    lotCode;
    conditionId;
    status;
    reservationId;
    unitCost;
    sourceRef;
    receivedAt;
    createdAt;
    updatedAt;
};
exports.InventoryUnit = InventoryUnit;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], InventoryUnit.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], InventoryUnit.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'inventory_item_id', type: 'uuid' }),
    __metadata("design:type", String)
], InventoryUnit.prototype, "inventoryItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'warehouse_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], InventoryUnit.prototype, "warehouseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'location_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], InventoryUnit.prototype, "locationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'serial_private', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], InventoryUnit.prototype, "serialPrivate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'serial_public', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], InventoryUnit.prototype, "serialPublic", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'lot_code', type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", Object)
], InventoryUnit.prototype, "lotCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'condition_id', type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], InventoryUnit.prototype, "conditionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'available' }),
    __metadata("design:type", String)
], InventoryUnit.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reservation_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], InventoryUnit.prototype, "reservationId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'unit_cost',
        type: 'numeric',
        precision: 12,
        scale: 4,
        nullable: true,
    }),
    __metadata("design:type", Object)
], InventoryUnit.prototype, "unitCost", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_ref', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], InventoryUnit.prototype, "sourceRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'received_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], InventoryUnit.prototype, "receivedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], InventoryUnit.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], InventoryUnit.prototype, "updatedAt", void 0);
exports.InventoryUnit = InventoryUnit = __decorate([
    (0, typeorm_1.Entity)('inventory_units')
], InventoryUnit);
//# sourceMappingURL=inventory-item.entity.js.map