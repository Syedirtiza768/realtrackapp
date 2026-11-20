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
exports.InventoryItemSource = exports.Supplier = void 0;
const typeorm_1 = require("typeorm");
let Supplier = class Supplier {
    id;
    organizationId;
    code;
    name;
    type;
    contactName;
    email;
    phone;
    website;
    currency;
    defaultLeadTimeDays;
    supportsDropship;
    notes;
    active;
    createdAt;
    updatedAt;
};
exports.Supplier = Supplier;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Supplier.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Supplier.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], Supplier.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 160 }),
    __metadata("design:type", String)
], Supplier.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'distributor' }),
    __metadata("design:type", String)
], Supplier.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'contact_name', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], Supplier.prototype, "contactName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], Supplier.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 60, nullable: true }),
    __metadata("design:type", Object)
], Supplier.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Supplier.prototype, "website", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 3, default: 'USD' }),
    __metadata("design:type", String)
], Supplier.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'default_lead_time_days', type: 'integer', default: 3 }),
    __metadata("design:type", Number)
], Supplier.prototype, "defaultLeadTimeDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'supports_dropship', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Supplier.prototype, "supportsDropship", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Supplier.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Supplier.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Supplier.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Supplier.prototype, "updatedAt", void 0);
exports.Supplier = Supplier = __decorate([
    (0, typeorm_1.Entity)('suppliers'),
    (0, typeorm_1.Index)('uq_suppliers_org_code', ['organizationId', 'code'], { unique: true })
], Supplier);
let InventoryItemSource = class InventoryItemSource {
    id;
    organizationId;
    inventoryItemId;
    supplierId;
    supplierSku;
    unitCost;
    currency;
    availableQty;
    leadTimeDays;
    priority;
    fulfillmentMode;
    url;
    active;
    lastCheckedAt;
    createdAt;
    updatedAt;
};
exports.InventoryItemSource = InventoryItemSource;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], InventoryItemSource.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], InventoryItemSource.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'inventory_item_id', type: 'uuid' }),
    __metadata("design:type", String)
], InventoryItemSource.prototype, "inventoryItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'supplier_id', type: 'uuid' }),
    __metadata("design:type", String)
], InventoryItemSource.prototype, "supplierId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'supplier_sku', type: 'varchar', length: 160, nullable: true }),
    __metadata("design:type", Object)
], InventoryItemSource.prototype, "supplierSku", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'unit_cost',
        type: 'numeric',
        precision: 12,
        scale: 4,
        nullable: true,
    }),
    __metadata("design:type", Object)
], InventoryItemSource.prototype, "unitCost", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 3, default: 'USD' }),
    __metadata("design:type", String)
], InventoryItemSource.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'available_qty', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], InventoryItemSource.prototype, "availableQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'lead_time_days', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], InventoryItemSource.prototype, "leadTimeDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 100 }),
    __metadata("design:type", Number)
], InventoryItemSource.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'fulfillment_mode',
        type: 'varchar',
        length: 20,
        default: 'ship_to_warehouse',
    }),
    __metadata("design:type", String)
], InventoryItemSource.prototype, "fulfillmentMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], InventoryItemSource.prototype, "url", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], InventoryItemSource.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_checked_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], InventoryItemSource.prototype, "lastCheckedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], InventoryItemSource.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], InventoryItemSource.prototype, "updatedAt", void 0);
exports.InventoryItemSource = InventoryItemSource = __decorate([
    (0, typeorm_1.Entity)('inventory_item_sources'),
    (0, typeorm_1.Index)('uq_iis_item_supplier', ['inventoryItemId', 'supplierId'], {
        unique: true,
    })
], InventoryItemSource);
//# sourceMappingURL=supplier.entity.js.map