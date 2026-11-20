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
exports.OrderItem = void 0;
const typeorm_1 = require("typeorm");
const order_entity_js_1 = require("./order.entity.js");
let OrderItem = class OrderItem {
    id;
    orderId;
    order;
    listingId;
    externalItemId;
    externalListingId;
    sku;
    title;
    quantity;
    unitPrice;
    totalPrice;
    fulfilled;
    inventoryItemId;
    stockStatus;
    createdAt;
};
exports.OrderItem = OrderItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrderItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'order_id', type: 'uuid' }),
    __metadata("design:type", String)
], OrderItem.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => order_entity_js_1.Order, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'order_id' }),
    __metadata("design:type", order_entity_js_1.Order)
], OrderItem.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OrderItem.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'external_item_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], OrderItem.prototype, "externalItemId", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_order_item_external_listing', {
        where: '"external_listing_id" IS NOT NULL',
    }),
    (0, typeorm_1.Column)({
        name: 'external_listing_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], OrderItem.prototype, "externalListingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], OrderItem.prototype, "sku", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], OrderItem.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 1 }),
    __metadata("design:type", Number)
], OrderItem.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'unit_price', type: 'numeric', precision: 10, scale: 2 }),
    __metadata("design:type", String)
], OrderItem.prototype, "unitPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_price', type: 'numeric', precision: 10, scale: 2 }),
    __metadata("design:type", String)
], OrderItem.prototype, "totalPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], OrderItem.prototype, "fulfilled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'inventory_item_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OrderItem.prototype, "inventoryItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'stock_status', type: 'varchar', length: 24, nullable: true }),
    __metadata("design:type", Object)
], OrderItem.prototype, "stockStatus", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], OrderItem.prototype, "createdAt", void 0);
exports.OrderItem = OrderItem = __decorate([
    (0, typeorm_1.Entity)('order_items'),
    (0, typeorm_1.Index)('idx_order_item_order', ['orderId']),
    (0, typeorm_1.Index)('idx_order_item_listing', ['listingId'])
], OrderItem);
//# sourceMappingURL=order-item.entity.js.map