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
exports.VariantMarketplaceMapping = void 0;
const typeorm_1 = require("typeorm");
const connected_ebay_account_entity_js_1 = require("../../integrations/ebay/entities/connected-ebay-account.entity.js");
const product_variant_entity_js_1 = require("./product-variant.entity.js");
let VariantMarketplaceMapping = class VariantMarketplaceMapping {
    id;
    variantId;
    variant;
    ebayAccountId;
    ebayAccount;
    marketplaceId;
    inventorySku;
    offerId;
    listingId;
    status;
    lastError;
    resultPayload;
    createdAt;
    updatedAt;
};
exports.VariantMarketplaceMapping = VariantMarketplaceMapping;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], VariantMarketplaceMapping.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'variant_id', type: 'uuid' }),
    __metadata("design:type", String)
], VariantMarketplaceMapping.prototype, "variantId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => product_variant_entity_js_1.ProductVariant, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'variant_id' }),
    __metadata("design:type", product_variant_entity_js_1.ProductVariant)
], VariantMarketplaceMapping.prototype, "variant", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid' }),
    __metadata("design:type", String)
], VariantMarketplaceMapping.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", connected_ebay_account_entity_js_1.ConnectedEbayAccount)
], VariantMarketplaceMapping.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'marketplace_id', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], VariantMarketplaceMapping.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'inventory_sku', type: 'varchar', length: 160 }),
    __metadata("design:type", String)
], VariantMarketplaceMapping.prototype, "inventorySku", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'offer_id', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], VariantMarketplaceMapping.prototype, "offerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], VariantMarketplaceMapping.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, default: 'pending' }),
    __metadata("design:type", String)
], VariantMarketplaceMapping.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], VariantMarketplaceMapping.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'result_payload', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], VariantMarketplaceMapping.prototype, "resultPayload", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], VariantMarketplaceMapping.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], VariantMarketplaceMapping.prototype, "updatedAt", void 0);
exports.VariantMarketplaceMapping = VariantMarketplaceMapping = __decorate([
    (0, typeorm_1.Entity)('variant_marketplace_mappings'),
    (0, typeorm_1.Unique)('uq_variant_marketplace_mapping', [
        'variantId',
        'ebayAccountId',
        'marketplaceId',
    ]),
    (0, typeorm_1.Index)('idx_variant_mapping_account_sku', ['ebayAccountId', 'inventorySku'])
], VariantMarketplaceMapping);
//# sourceMappingURL=variant-marketplace-mapping.entity.js.map