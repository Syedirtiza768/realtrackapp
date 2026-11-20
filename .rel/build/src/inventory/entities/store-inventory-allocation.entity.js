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
exports.StoreInventoryAllocation = void 0;
const typeorm_1 = require("typeorm");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
const store_entity_js_1 = require("../../channels/entities/store.entity.js");
let StoreInventoryAllocation = class StoreInventoryAllocation {
    id;
    listingId;
    listing;
    storeId;
    store;
    allocatedQty;
    reservedQty;
    availableQty;
    version;
    updatedAt;
};
exports.StoreInventoryAllocation = StoreInventoryAllocation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], StoreInventoryAllocation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'uuid' }),
    __metadata("design:type", String)
], StoreInventoryAllocation.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => listing_record_entity_js_1.ListingRecord, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'listing_id' }),
    __metadata("design:type", listing_record_entity_js_1.ListingRecord)
], StoreInventoryAllocation.prototype, "listing", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid' }),
    __metadata("design:type", String)
], StoreInventoryAllocation.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => store_entity_js_1.Store, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'store_id' }),
    __metadata("design:type", store_entity_js_1.Store)
], StoreInventoryAllocation.prototype, "store", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'allocated_qty', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StoreInventoryAllocation.prototype, "allocatedQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reserved_qty', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StoreInventoryAllocation.prototype, "reservedQty", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'available_qty',
        type: 'integer',
        insert: false,
        update: false,
        nullable: true,
    }),
    __metadata("design:type", Object)
], StoreInventoryAllocation.prototype, "availableQty", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], StoreInventoryAllocation.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], StoreInventoryAllocation.prototype, "updatedAt", void 0);
exports.StoreInventoryAllocation = StoreInventoryAllocation = __decorate([
    (0, typeorm_1.Entity)('store_inventory_allocations'),
    (0, typeorm_1.Index)('idx_sia_listing', ['listingId']),
    (0, typeorm_1.Index)('idx_sia_store', ['storeId']),
    (0, typeorm_1.Index)('idx_sia_listing_store', ['listingId', 'storeId'], { unique: true })
], StoreInventoryAllocation);
//# sourceMappingURL=store-inventory-allocation.entity.js.map