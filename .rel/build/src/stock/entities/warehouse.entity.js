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
exports.WarehouseLocation = exports.Warehouse = void 0;
const typeorm_1 = require("typeorm");
let Warehouse = class Warehouse {
    id;
    organizationId;
    code;
    name;
    type;
    address;
    countryCode;
    timezone;
    ebayMerchantLocationKey;
    isDefault;
    isSellable;
    active;
    legacyFashionWarehouseId;
    createdAt;
    updatedAt;
};
exports.Warehouse = Warehouse;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Warehouse.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Warehouse.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], Warehouse.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    __metadata("design:type", String)
], Warehouse.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'owned' }),
    __metadata("design:type", String)
], Warehouse.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Warehouse.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'country_code', type: 'varchar', length: 2, nullable: true }),
    __metadata("design:type", Object)
], Warehouse.prototype, "countryCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 60, nullable: true }),
    __metadata("design:type", Object)
], Warehouse.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_merchant_location_key',
        type: 'varchar',
        length: 36,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Warehouse.prototype, "ebayMerchantLocationKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_default', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Warehouse.prototype, "isDefault", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_sellable', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Warehouse.prototype, "isSellable", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Warehouse.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'legacy_fashion_warehouse_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Warehouse.prototype, "legacyFashionWarehouseId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Warehouse.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Warehouse.prototype, "updatedAt", void 0);
exports.Warehouse = Warehouse = __decorate([
    (0, typeorm_1.Entity)('warehouses'),
    (0, typeorm_1.Index)('uq_warehouses_org_code', ['organizationId', 'code'], { unique: true })
], Warehouse);
let WarehouseLocation = class WarehouseLocation {
    id;
    organizationId;
    warehouseId;
    code;
    zone;
    aisle;
    rack;
    shelf;
    bin;
    barcode;
    type;
    isPickable;
    capacityUnits;
    active;
    createdAt;
    updatedAt;
};
exports.WarehouseLocation = WarehouseLocation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WarehouseLocation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], WarehouseLocation.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'warehouse_id', type: 'uuid' }),
    __metadata("design:type", String)
], WarehouseLocation.prototype, "warehouseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 60 }),
    __metadata("design:type", String)
], WarehouseLocation.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], WarehouseLocation.prototype, "zone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], WarehouseLocation.prototype, "aisle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], WarehouseLocation.prototype, "rack", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], WarehouseLocation.prototype, "shelf", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], WarehouseLocation.prototype, "bin", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", Object)
], WarehouseLocation.prototype, "barcode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'storage' }),
    __metadata("design:type", String)
], WarehouseLocation.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_pickable', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], WarehouseLocation.prototype, "isPickable", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'capacity_units', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], WarehouseLocation.prototype, "capacityUnits", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], WarehouseLocation.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], WarehouseLocation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], WarehouseLocation.prototype, "updatedAt", void 0);
exports.WarehouseLocation = WarehouseLocation = __decorate([
    (0, typeorm_1.Entity)('warehouse_locations'),
    (0, typeorm_1.Index)('uq_wl_warehouse_code', ['warehouseId', 'code'], { unique: true })
], WarehouseLocation);
//# sourceMappingURL=warehouse.entity.js.map