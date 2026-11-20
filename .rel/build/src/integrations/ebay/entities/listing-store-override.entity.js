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
exports.ListingStoreOverride = void 0;
const typeorm_1 = require("typeorm");
const catalog_product_entity_js_1 = require("../../../catalog-import/entities/catalog-product.entity.js");
const connected_ebay_account_entity_js_1 = require("./connected-ebay-account.entity.js");
let ListingStoreOverride = class ListingStoreOverride {
    id;
    catalogProductId;
    catalogProduct;
    ebayAccountId;
    ebayAccount;
    marketplaceId;
    titleOverride;
    priceOverride;
    quantityOverride;
    descriptionOverride;
    categoryIdOverride;
    conditionOverride;
    policyOverrides;
    imageOrderOverride;
    fitmentOverride;
    createdAt;
    updatedAt;
};
exports.ListingStoreOverride = ListingStoreOverride;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ListingStoreOverride.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid' }),
    __metadata("design:type", String)
], ListingStoreOverride.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_product_entity_js_1.CatalogProduct, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'catalog_product_id' }),
    __metadata("design:type", catalog_product_entity_js_1.CatalogProduct)
], ListingStoreOverride.prototype, "catalogProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid' }),
    __metadata("design:type", String)
], ListingStoreOverride.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", connected_ebay_account_entity_js_1.ConnectedEbayAccount)
], ListingStoreOverride.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'marketplace_id', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], ListingStoreOverride.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'title_override', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingStoreOverride.prototype, "titleOverride", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'price_override',
        type: 'numeric',
        precision: 12,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ListingStoreOverride.prototype, "priceOverride", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_override', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ListingStoreOverride.prototype, "quantityOverride", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'description_override', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingStoreOverride.prototype, "descriptionOverride", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_id_override', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingStoreOverride.prototype, "categoryIdOverride", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'condition_override', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingStoreOverride.prototype, "conditionOverride", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'policy_overrides', type: 'jsonb', default: () => `'{}'` }),
    __metadata("design:type", Object)
], ListingStoreOverride.prototype, "policyOverrides", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'image_order_override', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ListingStoreOverride.prototype, "imageOrderOverride", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fitment_override', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ListingStoreOverride.prototype, "fitmentOverride", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ListingStoreOverride.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ListingStoreOverride.prototype, "updatedAt", void 0);
exports.ListingStoreOverride = ListingStoreOverride = __decorate([
    (0, typeorm_1.Entity)('listing_store_overrides'),
    (0, typeorm_1.Unique)('uq_listing_store_override', [
        'catalogProductId',
        'ebayAccountId',
        'marketplaceId',
    ]),
    (0, typeorm_1.Index)('idx_lso_product', ['catalogProductId']),
    (0, typeorm_1.Index)('idx_lso_account', ['ebayAccountId'])
], ListingStoreOverride);
//# sourceMappingURL=listing-store-override.entity.js.map