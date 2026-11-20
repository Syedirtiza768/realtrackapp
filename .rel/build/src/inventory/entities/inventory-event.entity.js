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
exports.InventoryEvent = void 0;
const typeorm_1 = require("typeorm");
let InventoryEvent = class InventoryEvent {
    id;
    listingId;
    eventType;
    quantityChange;
    quantityBefore;
    quantityAfter;
    storeId;
    sourceChannel;
    sourceOrderId;
    sourceReference;
    idempotencyKey;
    reason;
    createdBy;
    createdAt;
};
exports.InventoryEvent = InventoryEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], InventoryEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'uuid' }),
    __metadata("design:type", String)
], InventoryEvent.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'event_type',
        type: 'varchar',
        length: 30,
    }),
    __metadata("design:type", String)
], InventoryEvent.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_change', type: 'integer' }),
    __metadata("design:type", Number)
], InventoryEvent.prototype, "quantityChange", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_before', type: 'integer' }),
    __metadata("design:type", Number)
], InventoryEvent.prototype, "quantityBefore", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_after', type: 'integer' }),
    __metadata("design:type", Number)
], InventoryEvent.prototype, "quantityAfter", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], InventoryEvent.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'source_channel',
        type: 'varchar',
        length: 30,
        nullable: true,
    }),
    __metadata("design:type", Object)
], InventoryEvent.prototype, "sourceChannel", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'source_order_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], InventoryEvent.prototype, "sourceOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_reference', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], InventoryEvent.prototype, "sourceReference", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'idempotency_key',
        type: 'varchar',
        length: 200,
        unique: true,
        nullable: true,
    }),
    __metadata("design:type", Object)
], InventoryEvent.prototype, "idempotencyKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], InventoryEvent.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], InventoryEvent.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], InventoryEvent.prototype, "createdAt", void 0);
exports.InventoryEvent = InventoryEvent = __decorate([
    (0, typeorm_1.Entity)('inventory_events'),
    (0, typeorm_1.Index)('idx_event_listing', ['listingId', 'createdAt']),
    (0, typeorm_1.Index)('idx_event_type', ['eventType', 'createdAt']),
    (0, typeorm_1.Index)('idx_event_source', ['sourceChannel', 'sourceOrderId'])
], InventoryEvent);
//# sourceMappingURL=inventory-event.entity.js.map