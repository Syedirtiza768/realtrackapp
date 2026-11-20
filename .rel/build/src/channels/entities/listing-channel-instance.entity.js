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
exports.ListingChannelInstance = void 0;
const typeorm_1 = require("typeorm");
const channel_connection_entity_js_1 = require("./channel-connection.entity.js");
const store_entity_js_1 = require("./store.entity.js");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
let ListingChannelInstance = class ListingChannelInstance {
    id;
    listingId;
    listing;
    connectionId;
    connection;
    storeId;
    store;
    channel;
    externalId;
    externalUrl;
    overridePrice;
    overrideQuantity;
    overrideTitle;
    channelSpecificData;
    syncStatus;
    lastPushedVersion;
    lastSyncedAt;
    lastError;
    retryCount;
    isDemo;
    createdAt;
    updatedAt;
};
exports.ListingChannelInstance = ListingChannelInstance;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ListingChannelInstance.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'uuid' }),
    __metadata("design:type", String)
], ListingChannelInstance.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => listing_record_entity_js_1.ListingRecord, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'listing_id' }),
    __metadata("design:type", listing_record_entity_js_1.ListingRecord)
], ListingChannelInstance.prototype, "listing", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'connection_id', type: 'uuid' }),
    __metadata("design:type", String)
], ListingChannelInstance.prototype, "connectionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => channel_connection_entity_js_1.ChannelConnection, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'connection_id' }),
    __metadata("design:type", channel_connection_entity_js_1.ChannelConnection)
], ListingChannelInstance.prototype, "connection", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid' }),
    __metadata("design:type", String)
], ListingChannelInstance.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => store_entity_js_1.Store, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'store_id' }),
    __metadata("design:type", store_entity_js_1.Store)
], ListingChannelInstance.prototype, "store", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], ListingChannelInstance.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_id', type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], ListingChannelInstance.prototype, "externalId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingChannelInstance.prototype, "externalUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'override_price',
        type: 'numeric',
        precision: 10,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ListingChannelInstance.prototype, "overridePrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'override_quantity', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], ListingChannelInstance.prototype, "overrideQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'override_title', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingChannelInstance.prototype, "overrideTitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'channel_specific_data', type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], ListingChannelInstance.prototype, "channelSpecificData", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'sync_status',
        type: 'varchar',
        length: 20,
        default: 'pending',
    }),
    __metadata("design:type", String)
], ListingChannelInstance.prototype, "syncStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_pushed_version', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], ListingChannelInstance.prototype, "lastPushedVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_synced_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ListingChannelInstance.prototype, "lastSyncedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingChannelInstance.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'retry_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], ListingChannelInstance.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_demo', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ListingChannelInstance.prototype, "isDemo", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ListingChannelInstance.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ListingChannelInstance.prototype, "updatedAt", void 0);
exports.ListingChannelInstance = ListingChannelInstance = __decorate([
    (0, typeorm_1.Entity)('listing_channel_instances'),
    (0, typeorm_1.Index)('idx_lci_listing', ['listingId']),
    (0, typeorm_1.Index)('idx_lci_store', ['storeId']),
    (0, typeorm_1.Index)('idx_lci_connection', ['connectionId']),
    (0, typeorm_1.Index)('idx_lci_listing_store', ['listingId', 'storeId'], { unique: true }),
    (0, typeorm_1.Index)('idx_lci_external', ['externalId']),
    (0, typeorm_1.Index)('idx_lci_sync_status', ['syncStatus'])
], ListingChannelInstance);
//# sourceMappingURL=listing-channel-instance.entity.js.map