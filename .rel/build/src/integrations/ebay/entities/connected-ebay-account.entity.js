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
exports.ConnectedEbayAccount = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../../auth/entities/organization.entity.js");
const user_entity_js_1 = require("../../../auth/entities/user.entity.js");
const channel_connection_entity_js_1 = require("../../../channels/entities/channel-connection.entity.js");
const store_entity_js_1 = require("../../../channels/entities/store.entity.js");
const ebay_oauth_token_entity_js_1 = require("./ebay-oauth-token.entity.js");
const ebay_account_marketplace_entity_js_1 = require("./ebay-account-marketplace.entity.js");
const internal_store_entity_js_1 = require("./internal-store.entity.js");
let ConnectedEbayAccount = class ConnectedEbayAccount {
    id;
    organizationId;
    organization;
    internalStoreId;
    internalStore;
    channelConnectionId;
    channelConnection;
    primaryStoreId;
    primaryStore;
    ebayUserId;
    ebayUsername;
    accountDisplayName;
    environment;
    connectionStatus;
    connectedByUserId;
    connectedByUser;
    connectedAt;
    lastVerifiedAt;
    lastSuccessfulSyncAt;
    lastTokenRefreshAt;
    lastErrorMessage;
    lastListingsFetchedCount;
    lastPoliciesFetchedCount;
    connectionSource;
    sellerpunditTokenId;
    sellerpunditAccountName;
    sellerpunditMarketplaceId;
    sellerpunditLastSyncAt;
    sellerpunditLastPolicySyncAt;
    oauthToken;
    marketplaces;
    createdAt;
    updatedAt;
};
exports.ConnectedEbayAccount = ConnectedEbayAccount;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ConnectedEbayAccount.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ConnectedEbayAccount.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], ConnectedEbayAccount.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'internal_store_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "internalStoreId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => internal_store_entity_js_1.InternalStore, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'internal_store_id' }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "internalStore", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'channel_connection_id', type: 'uuid' }),
    __metadata("design:type", String)
], ConnectedEbayAccount.prototype, "channelConnectionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => channel_connection_entity_js_1.ChannelConnection, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'channel_connection_id' }),
    __metadata("design:type", channel_connection_entity_js_1.ChannelConnection)
], ConnectedEbayAccount.prototype, "channelConnection", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'primary_store_id', type: 'uuid' }),
    __metadata("design:type", String)
], ConnectedEbayAccount.prototype, "primaryStoreId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => store_entity_js_1.Store, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'primary_store_id' }),
    __metadata("design:type", store_entity_js_1.Store)
], ConnectedEbayAccount.prototype, "primaryStore", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_user_id', type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], ConnectedEbayAccount.prototype, "ebayUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_username',
        type: 'varchar',
        length: 200,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "ebayUsername", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'account_display_name', type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], ConnectedEbayAccount.prototype, "accountDisplayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'sandbox' }),
    __metadata("design:type", String)
], ConnectedEbayAccount.prototype, "environment", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'connection_status',
        type: 'varchar',
        length: 30,
        default: 'active',
    }),
    __metadata("design:type", String)
], ConnectedEbayAccount.prototype, "connectionStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'connected_by_user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "connectedByUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_js_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'connected_by_user_id' }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "connectedByUser", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'connected_at',
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
    }),
    __metadata("design:type", Date)
], ConnectedEbayAccount.prototype, "connectedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_verified_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "lastVerifiedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'last_successful_sync_at',
        type: 'timestamptz',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "lastSuccessfulSyncAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'last_token_refresh_at',
        type: 'timestamptz',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "lastTokenRefreshAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "lastErrorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_listings_fetched_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ConnectedEbayAccount.prototype, "lastListingsFetchedCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_policies_fetched_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ConnectedEbayAccount.prototype, "lastPoliciesFetchedCount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'connection_source',
        type: 'varchar',
        length: 30,
        default: 'native_oauth',
    }),
    __metadata("design:type", String)
], ConnectedEbayAccount.prototype, "connectionSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sellerpundit_token_id', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "sellerpunditTokenId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'sellerpundit_account_name',
        type: 'varchar',
        length: 200,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "sellerpunditAccountName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sellerpundit_marketplace_id', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "sellerpunditMarketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'sellerpundit_last_sync_at',
        type: 'timestamptz',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "sellerpunditLastSyncAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'sellerpundit_last_policy_sync_at',
        type: 'timestamptz',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ConnectedEbayAccount.prototype, "sellerpunditLastPolicySyncAt", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => ebay_oauth_token_entity_js_1.EbayOAuthToken, (t) => t.ebayAccount),
    __metadata("design:type", ebay_oauth_token_entity_js_1.EbayOAuthToken)
], ConnectedEbayAccount.prototype, "oauthToken", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => ebay_account_marketplace_entity_js_1.EbayAccountMarketplace, (m) => m.ebayAccount),
    __metadata("design:type", Array)
], ConnectedEbayAccount.prototype, "marketplaces", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ConnectedEbayAccount.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ConnectedEbayAccount.prototype, "updatedAt", void 0);
exports.ConnectedEbayAccount = ConnectedEbayAccount = __decorate([
    (0, typeorm_1.Entity)('connected_ebay_accounts'),
    (0, typeorm_1.Index)('idx_connected_ebay_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_connected_ebay_status', ['connectionStatus']),
    (0, typeorm_1.Index)('idx_connected_ebay_ebay_user', ['ebayUserId']),
    (0, typeorm_1.Index)('uq_connected_ebay_org_user', ['organizationId', 'ebayUserId'], {
        unique: true,
    })
], ConnectedEbayAccount);
//# sourceMappingURL=connected-ebay-account.entity.js.map