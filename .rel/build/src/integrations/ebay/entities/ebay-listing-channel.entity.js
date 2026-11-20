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
exports.EbayListingChannel = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../../auth/entities/organization.entity.js");
const catalog_product_entity_js_1 = require("../../../catalog-import/entities/catalog-product.entity.js");
const connected_ebay_account_entity_js_1 = require("./connected-ebay-account.entity.js");
let EbayListingChannel = class EbayListingChannel {
    id;
    organizationId;
    organization;
    catalogProductId;
    catalogProduct;
    ebayAccountId;
    ebayAccount;
    marketplaceId;
    vertical;
    internalSku;
    ebayInventorySku;
    offerId;
    listingId;
    listingUrl;
    channelPrice;
    channelQuantity;
    listingStatus;
    lastErrorCode;
    lastErrorMessage;
    publishedAt;
    lastRevisedAt;
    lastSyncedAt;
    createdAt;
    updatedAt;
};
exports.EbayListingChannel = EbayListingChannel;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayListingChannel.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayListingChannel.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], EbayListingChannel.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayListingChannel.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_product_entity_js_1.CatalogProduct, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'catalog_product_id' }),
    __metadata("design:type", catalog_product_entity_js_1.CatalogProduct)
], EbayListingChannel.prototype, "catalogProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayListingChannel.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", connected_ebay_account_entity_js_1.ConnectedEbayAccount)
], EbayListingChannel.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'marketplace_id', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], EbayListingChannel.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], EbayListingChannel.prototype, "vertical", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'internal_sku', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayListingChannel.prototype, "internalSku", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_inventory_sku', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayListingChannel.prototype, "ebayInventorySku", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'offer_id', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], EbayListingChannel.prototype, "offerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], EbayListingChannel.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayListingChannel.prototype, "listingUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'channel_price',
        type: 'numeric',
        precision: 12,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayListingChannel.prototype, "channelPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'channel_quantity', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], EbayListingChannel.prototype, "channelQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'listing_status',
        type: 'varchar',
        length: 30,
        default: 'draft',
    }),
    __metadata("design:type", String)
], EbayListingChannel.prototype, "listingStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'last_error_code',
        type: 'varchar',
        length: 80,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayListingChannel.prototype, "lastErrorCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayListingChannel.prototype, "lastErrorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'published_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayListingChannel.prototype, "publishedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_revised_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayListingChannel.prototype, "lastRevisedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_synced_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayListingChannel.prototype, "lastSyncedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayListingChannel.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayListingChannel.prototype, "updatedAt", void 0);
exports.EbayListingChannel = EbayListingChannel = __decorate([
    (0, typeorm_1.Entity)('ebay_listing_channels'),
    (0, typeorm_1.Index)('idx_elc_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_elc_account', ['ebayAccountId']),
    (0, typeorm_1.Index)('idx_elc_marketplace', ['marketplaceId']),
    (0, typeorm_1.Index)('idx_elc_product', ['catalogProductId']),
    (0, typeorm_1.Index)('idx_elc_listing', ['listingId']),
    (0, typeorm_1.Index)('idx_elc_offer', ['offerId']),
    (0, typeorm_1.Index)('idx_elc_inv_sku', ['ebayInventorySku']),
    (0, typeorm_1.Index)('idx_elc_status', ['listingStatus'])
], EbayListingChannel);
//# sourceMappingURL=ebay-listing-channel.entity.js.map