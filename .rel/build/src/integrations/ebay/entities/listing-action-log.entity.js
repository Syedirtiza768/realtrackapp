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
exports.ListingActionLog = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../../auth/entities/organization.entity.js");
const user_entity_js_1 = require("../../../auth/entities/user.entity.js");
const catalog_product_entity_js_1 = require("../../../catalog-import/entities/catalog-product.entity.js");
const connected_ebay_account_entity_js_1 = require("./connected-ebay-account.entity.js");
const ebay_listing_channel_entity_js_1 = require("./ebay-listing-channel.entity.js");
let ListingActionLog = class ListingActionLog {
    id;
    organizationId;
    organization;
    userId;
    user;
    ebayAccountId;
    ebayAccount;
    marketplaceId;
    catalogProductId;
    catalogProduct;
    ebayListingChannelId;
    ebayListingChannel;
    action;
    beforeSnapshot;
    afterSnapshot;
    result;
    ipAddress;
    userAgent;
    createdAt;
};
exports.ListingActionLog = ListingActionLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ListingActionLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ListingActionLog.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], ListingActionLog.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ListingActionLog.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_js_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", Object)
], ListingActionLog.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ListingActionLog.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, {
        onDelete: 'SET NULL',
        nullable: true,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", Object)
], ListingActionLog.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'marketplace_id',
        type: 'varchar',
        length: 30,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ListingActionLog.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ListingActionLog.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_product_entity_js_1.CatalogProduct, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'catalog_product_id' }),
    __metadata("design:type", Object)
], ListingActionLog.prototype, "catalogProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_listing_channel_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ListingActionLog.prototype, "ebayListingChannelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ebay_listing_channel_entity_js_1.EbayListingChannel, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_listing_channel_id' }),
    __metadata("design:type", Object)
], ListingActionLog.prototype, "ebayListingChannel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80 }),
    __metadata("design:type", String)
], ListingActionLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'before_snapshot', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ListingActionLog.prototype, "beforeSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'after_snapshot', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ListingActionLog.prototype, "afterSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], ListingActionLog.prototype, "result", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ip_address', type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], ListingActionLog.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_agent', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingActionLog.prototype, "userAgent", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ListingActionLog.prototype, "createdAt", void 0);
exports.ListingActionLog = ListingActionLog = __decorate([
    (0, typeorm_1.Entity)('listing_action_logs'),
    (0, typeorm_1.Index)('idx_listing_action_logs_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_listing_action_logs_created', ['createdAt'])
], ListingActionLog);
//# sourceMappingURL=listing-action-log.entity.js.map