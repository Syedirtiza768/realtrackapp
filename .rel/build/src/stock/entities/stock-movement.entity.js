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
exports.ProcurementRequest = exports.StockReservation = exports.StockMovement = void 0;
const typeorm_1 = require("typeorm");
let StockMovement = class StockMovement {
    id;
    organizationId;
    inventoryItemId;
    warehouseId;
    locationId;
    unitId;
    movementType;
    qtyOnHand;
    qtyReserved;
    qtyDamaged;
    qtyInbound;
    onHandAfter;
    reservedAfter;
    unitCost;
    reasonCode;
    note;
    documentId;
    sourceChannel;
    storeId;
    orderId;
    orderItemId;
    operationKey;
    idempotencyKey;
    actorUserId;
    createdAt;
};
exports.StockMovement = StockMovement;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], StockMovement.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], StockMovement.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'inventory_item_id', type: 'uuid' }),
    __metadata("design:type", String)
], StockMovement.prototype, "inventoryItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'warehouse_id', type: 'uuid' }),
    __metadata("design:type", String)
], StockMovement.prototype, "warehouseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'location_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockMovement.prototype, "locationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'unit_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockMovement.prototype, "unitId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'movement_type', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], StockMovement.prototype, "movementType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'qty_on_hand', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StockMovement.prototype, "qtyOnHand", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'qty_reserved', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StockMovement.prototype, "qtyReserved", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'qty_damaged', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StockMovement.prototype, "qtyDamaged", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'qty_inbound', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StockMovement.prototype, "qtyInbound", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'on_hand_after', type: 'integer' }),
    __metadata("design:type", Number)
], StockMovement.prototype, "onHandAfter", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reserved_after', type: 'integer' }),
    __metadata("design:type", Number)
], StockMovement.prototype, "reservedAfter", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'unit_cost',
        type: 'numeric',
        precision: 12,
        scale: 4,
        nullable: true,
    }),
    __metadata("design:type", Object)
], StockMovement.prototype, "unitCost", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reason_code', type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], StockMovement.prototype, "reasonCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], StockMovement.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'document_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockMovement.prototype, "documentId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'source_channel',
        type: 'varchar',
        length: 30,
        nullable: true,
    }),
    __metadata("design:type", Object)
], StockMovement.prototype, "sourceChannel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockMovement.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'order_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockMovement.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'order_item_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockMovement.prototype, "orderItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'operation_key',
        type: 'varchar',
        length: 200,
        nullable: true,
    }),
    __metadata("design:type", Object)
], StockMovement.prototype, "operationKey", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'idempotency_key',
        type: 'varchar',
        length: 220,
        nullable: true,
    }),
    __metadata("design:type", Object)
], StockMovement.prototype, "idempotencyKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'actor_user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockMovement.prototype, "actorUserId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], StockMovement.prototype, "createdAt", void 0);
exports.StockMovement = StockMovement = __decorate([
    (0, typeorm_1.Entity)('stock_movements')
], StockMovement);
let StockReservation = class StockReservation {
    id;
    organizationId;
    inventoryItemId;
    warehouseId;
    locationId;
    unitId;
    orderId;
    orderItemId;
    storeId;
    quantity;
    status;
    expiresAt;
    createdAt;
    updatedAt;
};
exports.StockReservation = StockReservation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], StockReservation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], StockReservation.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'inventory_item_id', type: 'uuid' }),
    __metadata("design:type", String)
], StockReservation.prototype, "inventoryItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'warehouse_id', type: 'uuid' }),
    __metadata("design:type", String)
], StockReservation.prototype, "warehouseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'location_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockReservation.prototype, "locationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'unit_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockReservation.prototype, "unitId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'order_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockReservation.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'order_item_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockReservation.prototype, "orderItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockReservation.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer' }),
    __metadata("design:type", Number)
], StockReservation.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'active' }),
    __metadata("design:type", String)
], StockReservation.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], StockReservation.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], StockReservation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], StockReservation.prototype, "updatedAt", void 0);
exports.StockReservation = StockReservation = __decorate([
    (0, typeorm_1.Entity)('stock_reservations')
], StockReservation);
let ProcurementRequest = class ProcurementRequest {
    id;
    organizationId;
    inventoryItemId;
    quantity;
    receivedQty;
    status;
    reason;
    fulfillmentMode;
    supplierId;
    sourceId;
    warehouseId;
    purchaseOrderId;
    purchaseOrderLineId;
    orderId;
    orderItemId;
    storeId;
    estimatedUnitCost;
    neededBy;
    supplierTracking;
    note;
    createdBy;
    createdAt;
    updatedAt;
};
exports.ProcurementRequest = ProcurementRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ProcurementRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ProcurementRequest.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'inventory_item_id', type: 'uuid' }),
    __metadata("design:type", String)
], ProcurementRequest.prototype, "inventoryItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer' }),
    __metadata("design:type", Number)
], ProcurementRequest.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'received_qty', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], ProcurementRequest.prototype, "receivedQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'open' }),
    __metadata("design:type", String)
], ProcurementRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'order' }),
    __metadata("design:type", String)
], ProcurementRequest.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'fulfillment_mode',
        type: 'varchar',
        length: 20,
        default: 'ship_to_warehouse',
    }),
    __metadata("design:type", String)
], ProcurementRequest.prototype, "fulfillmentMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'supplier_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProcurementRequest.prototype, "supplierId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProcurementRequest.prototype, "sourceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'warehouse_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProcurementRequest.prototype, "warehouseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'purchase_order_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProcurementRequest.prototype, "purchaseOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'purchase_order_line_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProcurementRequest.prototype, "purchaseOrderLineId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'order_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProcurementRequest.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'order_item_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProcurementRequest.prototype, "orderItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProcurementRequest.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'estimated_unit_cost',
        type: 'numeric',
        precision: 12,
        scale: 4,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ProcurementRequest.prototype, "estimatedUnitCost", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'needed_by', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ProcurementRequest.prototype, "neededBy", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'supplier_tracking',
        type: 'varchar',
        length: 120,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ProcurementRequest.prototype, "supplierTracking", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ProcurementRequest.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProcurementRequest.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ProcurementRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ProcurementRequest.prototype, "updatedAt", void 0);
exports.ProcurementRequest = ProcurementRequest = __decorate([
    (0, typeorm_1.Entity)('procurement_requests')
], ProcurementRequest);
//# sourceMappingURL=stock-movement.entity.js.map