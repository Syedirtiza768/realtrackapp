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
exports.InventoryLedger = void 0;
const typeorm_1 = require("typeorm");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
let InventoryLedger = class InventoryLedger {
    id;
    listingId;
    listing;
    quantityTotal;
    quantityReserved;
    quantityAvailable;
    quantityListedEbay;
    quantityListedShopify;
    lowStockThreshold;
    reorderPoint;
    version;
    lastReconciledAt;
    updatedAt;
};
exports.InventoryLedger = InventoryLedger;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], InventoryLedger.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'uuid', unique: true }),
    __metadata("design:type", String)
], InventoryLedger.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => listing_record_entity_js_1.ListingRecord, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'listing_id' }),
    __metadata("design:type", listing_record_entity_js_1.ListingRecord)
], InventoryLedger.prototype, "listing", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_total', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], InventoryLedger.prototype, "quantityTotal", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_reserved', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], InventoryLedger.prototype, "quantityReserved", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'quantity_available',
        type: 'integer',
        insert: false,
        update: false,
        nullable: true,
    }),
    __metadata("design:type", Object)
], InventoryLedger.prototype, "quantityAvailable", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_listed_ebay', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], InventoryLedger.prototype, "quantityListedEbay", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_listed_shopify', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], InventoryLedger.prototype, "quantityListedShopify", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'low_stock_threshold', type: 'integer', default: 2 }),
    __metadata("design:type", Number)
], InventoryLedger.prototype, "lowStockThreshold", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reorder_point', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], InventoryLedger.prototype, "reorderPoint", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], InventoryLedger.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_reconciled_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], InventoryLedger.prototype, "lastReconciledAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], InventoryLedger.prototype, "updatedAt", void 0);
exports.InventoryLedger = InventoryLedger = __decorate([
    (0, typeorm_1.Entity)('inventory_ledger'),
    (0, typeorm_1.Index)('idx_ledger_low_stock', ['quantityTotal'], {
        where: '"quantity_total" - "quantity_reserved" <= "low_stock_threshold"',
    })
], InventoryLedger);
//# sourceMappingURL=inventory-ledger.entity.js.map