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
exports.EbayOffer = void 0;
const typeorm_1 = require("typeorm");
const master_product_entity_js_1 = require("./master-product.entity.js");
const store_entity_js_1 = require("../../channels/entities/store.entity.js");
let EbayOffer = class EbayOffer {
    id;
    masterProductId;
    masterProduct;
    storeId;
    store;
    sku;
    ebayOfferId;
    ebayListingId;
    marketplaceId;
    titleOverride;
    price;
    quantity;
    categoryId;
    format;
    fulfillmentPolicyId;
    paymentPolicyId;
    returnPolicyId;
    merchantLocationKey;
    status;
    lastError;
    lastSyncedAt;
    publishedAt;
    endedAt;
    createdAt;
    updatedAt;
};
exports.EbayOffer = EbayOffer;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayOffer.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'master_product_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayOffer.prototype, "masterProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => master_product_entity_js_1.MasterProduct, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'master_product_id' }),
    __metadata("design:type", master_product_entity_js_1.MasterProduct)
], EbayOffer.prototype, "masterProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayOffer.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => store_entity_js_1.Store, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'store_id' }),
    __metadata("design:type", store_entity_js_1.Store)
], EbayOffer.prototype, "store", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], EbayOffer.prototype, "sku", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_offer_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "ebayOfferId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_listing_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "ebayListingId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'marketplace_id',
        type: 'varchar',
        length: 30,
        default: 'EBAY_US',
    }),
    __metadata("design:type", String)
], EbayOffer.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'title_override',
        type: 'varchar',
        length: 200,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "titleOverride", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_id', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'FIXED_PRICE' }),
    __metadata("design:type", String)
], EbayOffer.prototype, "format", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'fulfillment_policy_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "fulfillmentPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'payment_policy_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "paymentPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'return_policy_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "returnPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'merchant_location_key',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "merchantLocationKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'draft' }),
    __metadata("design:type", String)
], EbayOffer.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_synced_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "lastSyncedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'published_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "publishedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ended_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayOffer.prototype, "endedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayOffer.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayOffer.prototype, "updatedAt", void 0);
exports.EbayOffer = EbayOffer = __decorate([
    (0, typeorm_1.Entity)('ebay_offers'),
    (0, typeorm_1.Index)('idx_ebay_offer_product', ['masterProductId']),
    (0, typeorm_1.Index)('idx_ebay_offer_store', ['storeId']),
    (0, typeorm_1.Index)('idx_ebay_offer_ebay_offer_id', ['ebayOfferId'], {
        unique: true,
        where: '"ebay_offer_id" IS NOT NULL',
    }),
    (0, typeorm_1.Index)('idx_ebay_offer_ebay_listing_id', ['ebayListingId']),
    (0, typeorm_1.Index)('idx_ebay_offer_sku_store', ['sku', 'storeId'], { unique: true }),
    (0, typeorm_1.Index)('idx_ebay_offer_status', ['status'])
], EbayOffer);
//# sourceMappingURL=ebay-offer.entity.js.map