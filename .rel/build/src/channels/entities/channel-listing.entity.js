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
exports.ChannelListing = void 0;
const typeorm_1 = require("typeorm");
const channel_connection_entity_js_1 = require("./channel-connection.entity.js");
let ChannelListing = class ChannelListing {
    id;
    connectionId;
    connection;
    listingId;
    externalId;
    externalUrl;
    syncStatus;
    lastPushedVersion;
    lastSyncedAt;
    lastError;
    createdAt;
    updatedAt;
};
exports.ChannelListing = ChannelListing;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ChannelListing.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'connection_id', type: 'uuid' }),
    __metadata("design:type", String)
], ChannelListing.prototype, "connectionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => channel_connection_entity_js_1.ChannelConnection, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'connection_id' }),
    __metadata("design:type", channel_connection_entity_js_1.ChannelConnection)
], ChannelListing.prototype, "connection", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'uuid' }),
    __metadata("design:type", String)
], ChannelListing.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_id', type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], ChannelListing.prototype, "externalId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'external_url',
        type: 'varchar',
        length: 500,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ChannelListing.prototype, "externalUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'sync_status',
        type: 'varchar',
        length: 20,
        default: 'synced',
    }),
    __metadata("design:type", String)
], ChannelListing.prototype, "syncStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_pushed_version', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], ChannelListing.prototype, "lastPushedVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_synced_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ChannelListing.prototype, "lastSyncedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ChannelListing.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ChannelListing.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ChannelListing.prototype, "updatedAt", void 0);
exports.ChannelListing = ChannelListing = __decorate([
    (0, typeorm_1.Entity)('channel_listings'),
    (0, typeorm_1.Index)('idx_channel_listing_conn', ['connectionId']),
    (0, typeorm_1.Index)('idx_channel_listing_listing', ['listingId']),
    (0, typeorm_1.Index)('idx_channel_listing_external', ['connectionId', 'externalId'], {
        unique: true,
    })
], ChannelListing);
//# sourceMappingURL=channel-listing.entity.js.map