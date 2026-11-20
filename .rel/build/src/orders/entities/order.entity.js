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
exports.Order = void 0;
const typeorm_1 = require("typeorm");
const channel_connection_entity_js_1 = require("../../channels/entities/channel-connection.entity.js");
const store_entity_js_1 = require("../../channels/entities/store.entity.js");
let Order = class Order {
    id;
    channel;
    connectionId;
    connection;
    storeId;
    store;
    externalOrderId;
    externalUrl;
    status;
    buyerUsername;
    buyerEmail;
    buyerName;
    shippingName;
    shippingAddress1;
    shippingAddress2;
    shippingCity;
    shippingState;
    shippingZip;
    shippingCountry;
    shippingMethod;
    trackingNumber;
    trackingCarrier;
    shippedAt;
    deliveredAt;
    subtotal;
    shippingCost;
    taxAmount;
    totalAmount;
    currency;
    marketplaceFee;
    netRevenue;
    refundAmount;
    refundReason;
    refundedAt;
    orderedAt;
    paidAt;
    cancelledAt;
    createdAt;
    updatedAt;
};
exports.Order = Order;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Order.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], Order.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'connection_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "connectionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => channel_connection_entity_js_1.ChannelConnection, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'connection_id' }),
    __metadata("design:type", Object)
], Order.prototype, "connection", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => store_entity_js_1.Store, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'store_id' }),
    __metadata("design:type", Object)
], Order.prototype, "store", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'external_order_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Order.prototype, "externalOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "externalUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, default: 'pending' }),
    __metadata("design:type", String)
], Order.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'buyer_username',
        type: 'varchar',
        length: 200,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Order.prototype, "buyerUsername", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'buyer_email', type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "buyerEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'buyer_name', type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "buyerName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'shipping_name',
        type: 'varchar',
        length: 200,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Order.prototype, "shippingName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'shipping_address_1', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "shippingAddress1", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'shipping_address_2', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "shippingAddress2", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'shipping_city',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Order.prototype, "shippingCity", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'shipping_state',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Order.prototype, "shippingState", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'shipping_zip', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "shippingZip", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'shipping_country', type: 'char', length: 2, nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "shippingCountry", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'shipping_method',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Order.prototype, "shippingMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'tracking_number',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Order.prototype, "trackingNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'tracking_carrier',
        type: 'varchar',
        length: 50,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Order.prototype, "trackingCarrier", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'shipped_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "shippedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivered_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "deliveredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", String)
], Order.prototype, "subtotal", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'shipping_cost',
        type: 'numeric',
        precision: 10,
        scale: 2,
        default: 0,
    }),
    __metadata("design:type", String)
], Order.prototype, "shippingCost", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'tax_amount',
        type: 'numeric',
        precision: 10,
        scale: 2,
        default: 0,
    }),
    __metadata("design:type", String)
], Order.prototype, "taxAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'total_amount',
        type: 'numeric',
        precision: 10,
        scale: 2,
        default: 0,
    }),
    __metadata("design:type", String)
], Order.prototype, "totalAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'char', length: 3, default: 'USD' }),
    __metadata("design:type", String)
], Order.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'marketplace_fee',
        type: 'numeric',
        precision: 10,
        scale: 2,
        default: 0,
    }),
    __metadata("design:type", String)
], Order.prototype, "marketplaceFee", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'net_revenue',
        type: 'numeric',
        precision: 10,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Order.prototype, "netRevenue", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'refund_amount',
        type: 'numeric',
        precision: 10,
        scale: 2,
        default: 0,
    }),
    __metadata("design:type", String)
], Order.prototype, "refundAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'refund_reason', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "refundReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'refunded_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "refundedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ordered_at', type: 'timestamptz', default: () => 'NOW()' }),
    __metadata("design:type", Date)
], Order.prototype, "orderedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'paid_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "paidAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cancelled_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Order.prototype, "cancelledAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Order.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Order.prototype, "updatedAt", void 0);
exports.Order = Order = __decorate([
    (0, typeorm_1.Entity)('orders'),
    (0, typeorm_1.Index)('idx_order_status', ['status']),
    (0, typeorm_1.Index)('idx_order_channel', ['channel', 'orderedAt']),
    (0, typeorm_1.Index)('idx_order_date', ['orderedAt']),
    (0, typeorm_1.Index)('idx_order_buyer', ['buyerEmail']),
    (0, typeorm_1.Index)('idx_order_external', ['channel', 'externalOrderId'], { unique: true })
], Order);
//# sourceMappingURL=order.entity.js.map