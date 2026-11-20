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
exports.Store = void 0;
const typeorm_1 = require("typeorm");
const channel_connection_entity_js_1 = require("./channel-connection.entity.js");
let Store = class Store {
    id;
    connectionId;
    organizationId;
    connection;
    channel;
    storeName;
    storeUrl;
    externalStoreId;
    status;
    isPrimary;
    config;
    verticalConfig;
    metricsCache;
    listingCount;
    ebayUserId;
    ebaySiteId;
    ebayMarketplaceId;
    fulfillmentPolicyId;
    paymentPolicyId;
    returnPolicyId;
    locationKey;
    tokenExpiresAt;
    lastSyncAt;
    createdAt;
    updatedAt;
};
exports.Store = Store;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Store.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'connection_id', type: 'uuid' }),
    __metadata("design:type", String)
], Store.prototype, "connectionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Store.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => channel_connection_entity_js_1.ChannelConnection, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'connection_id' }),
    __metadata("design:type", channel_connection_entity_js_1.ChannelConnection)
], Store.prototype, "connection", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], Store.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_name', type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], Store.prototype, "storeName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Store.prototype, "storeUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'external_store_id',
        type: 'varchar',
        length: 200,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Store.prototype, "externalStoreId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'active' }),
    __metadata("design:type", String)
], Store.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_primary', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Store.prototype, "isPrimary", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], Store.prototype, "config", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vertical_config', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Store.prototype, "verticalConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'metrics_cache', type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], Store.prototype, "metricsCache", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], Store.prototype, "listingCount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_user_id',
        type: 'varchar',
        length: 200,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Store.prototype, "ebayUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_site_id', type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", Object)
], Store.prototype, "ebaySiteId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_marketplace_id',
        type: 'varchar',
        length: 30,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Store.prototype, "ebayMarketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'fulfillment_policy_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Store.prototype, "fulfillmentPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'payment_policy_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Store.prototype, "paymentPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'return_policy_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Store.prototype, "returnPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'location_key',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Store.prototype, "locationKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_expires_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Store.prototype, "tokenExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_sync_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Store.prototype, "lastSyncAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Store.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Store.prototype, "updatedAt", void 0);
exports.Store = Store = __decorate([
    (0, typeorm_1.Entity)('stores'),
    (0, typeorm_1.Index)('idx_store_connection', ['connectionId']),
    (0, typeorm_1.Index)('idx_store_channel_name', ['channel', 'storeName'])
], Store);
//# sourceMappingURL=store.entity.js.map