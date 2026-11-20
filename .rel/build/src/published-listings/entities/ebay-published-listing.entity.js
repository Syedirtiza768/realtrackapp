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
exports.EbayPublishedListing = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../auth/entities/organization.entity.js");
const store_entity_js_1 = require("../../channels/entities/store.entity.js");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
const connected_ebay_account_entity_js_1 = require("../../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_listing_channel_entity_js_1 = require("../../integrations/ebay/entities/ebay-listing-channel.entity.js");
let EbayPublishedListing = class EbayPublishedListing {
    id;
    organizationId;
    organization;
    ebayAccountId;
    ebayAccount;
    storeId;
    store;
    marketplaceId;
    ebayItemId;
    offerId;
    sku;
    title;
    description;
    categoryId;
    categoryName;
    price;
    currency;
    quantityAvailable;
    quantitySold;
    listingStatus;
    listingFormat;
    condition;
    listingUrl;
    imageUrls;
    itemSpecifics;
    shippingDetails;
    listingPolicies;
    compatibility;
    performanceMetrics;
    healthFlags;
    location;
    rawEbayResponse;
    accountDisplayName;
    ebayStartTime;
    ebayEndTime;
    ebayLastModifiedAt;
    lastSyncedAt;
    catalogProductId;
    isTestListing;
    revision;
    catalogProduct;
    ebayListingChannelId;
    ebayListingChannel;
    createdAt;
    updatedAt;
};
exports.EbayPublishedListing = EbayPublishedListing;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayPublishedListing.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListing.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], EbayPublishedListing.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListing.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", connected_ebay_account_entity_js_1.ConnectedEbayAccount)
], EbayPublishedListing.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListing.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => store_entity_js_1.Store, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'store_id' }),
    __metadata("design:type", store_entity_js_1.Store)
], EbayPublishedListing.prototype, "store", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'marketplace_id', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], EbayPublishedListing.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_item_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "ebayItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'offer_id', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "offerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "sku", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EbayPublishedListing.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_id', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_name', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "categoryName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, default: 'USD' }),
    __metadata("design:type", String)
], EbayPublishedListing.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_available', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EbayPublishedListing.prototype, "quantityAvailable", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_sold', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EbayPublishedListing.prototype, "quantitySold", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'listing_status',
        type: 'varchar',
        length: 30,
        default: 'active',
    }),
    __metadata("design:type", String)
], EbayPublishedListing.prototype, "listingStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'listing_format',
        type: 'varchar',
        length: 30,
        default: 'fixed_price',
    }),
    __metadata("design:type", String)
], EbayPublishedListing.prototype, "listingFormat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 60, nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "condition", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "listingUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'image_urls', type: 'jsonb', default: () => "'[]'" }),
    __metadata("design:type", Array)
], EbayPublishedListing.prototype, "imageUrls", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'item_specifics', type: 'jsonb', default: () => "'{}'" }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "itemSpecifics", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'shipping_details', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "shippingDetails", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_policies', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "listingPolicies", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "compatibility", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'performance_metrics', type: 'jsonb', default: () => "'{}'" }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "performanceMetrics", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'health_flags', type: 'jsonb', default: () => "'[]'" }),
    __metadata("design:type", Array)
], EbayPublishedListing.prototype, "healthFlags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'raw_ebay_response', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "rawEbayResponse", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'account_display_name',
        type: 'varchar',
        length: 200,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "accountDisplayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_start_time', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "ebayStartTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_end_time', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "ebayEndTime", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_last_modified_at',
        type: 'timestamptz',
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "ebayLastModifiedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_synced_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "lastSyncedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_test_listing', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], EbayPublishedListing.prototype, "isTestListing", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', default: 1 }),
    __metadata("design:type", String)
], EbayPublishedListing.prototype, "revision", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_product_entity_js_1.CatalogProduct, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'catalog_product_id' }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "catalogProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_listing_channel_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "ebayListingChannelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ebay_listing_channel_entity_js_1.EbayListingChannel, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_listing_channel_id' }),
    __metadata("design:type", Object)
], EbayPublishedListing.prototype, "ebayListingChannel", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayPublishedListing.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayPublishedListing.prototype, "updatedAt", void 0);
exports.EbayPublishedListing = EbayPublishedListing = __decorate([
    (0, typeorm_1.Entity)('ebay_published_listings'),
    (0, typeorm_1.Index)('idx_epl_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_epl_account', ['ebayAccountId']),
    (0, typeorm_1.Index)('idx_epl_store', ['storeId']),
    (0, typeorm_1.Index)('idx_epl_marketplace', ['marketplaceId']),
    (0, typeorm_1.Index)('idx_epl_status', ['listingStatus']),
    (0, typeorm_1.Index)('idx_epl_sku', ['sku']),
    (0, typeorm_1.Index)('idx_epl_item_id', ['ebayItemId']),
    (0, typeorm_1.Index)('idx_epl_synced', ['lastSyncedAt']),
    (0, typeorm_1.Index)('uq_epl_account_item', ['ebayAccountId', 'marketplaceId', 'ebayItemId'], {
        unique: true,
        where: '"ebay_item_id" IS NOT NULL',
    })
], EbayPublishedListing);
//# sourceMappingURL=ebay-published-listing.entity.js.map