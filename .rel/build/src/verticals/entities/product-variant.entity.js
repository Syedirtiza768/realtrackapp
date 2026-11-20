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
exports.ProductVariant = void 0;
const typeorm_1 = require("typeorm");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
const product_family_entity_js_1 = require("./product-family.entity.js");
let ProductVariant = class ProductVariant {
    id;
    organizationId;
    familyId;
    family;
    catalogProductId;
    catalogProduct;
    vertical;
    sku;
    price;
    quantity;
    upc;
    ean;
    mpn;
    conditionId;
    attributes;
    imageUrls;
    active;
    createdAt;
    updatedAt;
};
exports.ProductVariant = ProductVariant;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ProductVariant.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ProductVariant.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'family_id', type: 'uuid' }),
    __metadata("design:type", String)
], ProductVariant.prototype, "familyId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => product_family_entity_js_1.ProductFamily, (family) => family.variants, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'family_id' }),
    __metadata("design:type", product_family_entity_js_1.ProductFamily)
], ProductVariant.prototype, "family", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProductVariant.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_product_entity_js_1.CatalogProduct, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'catalog_product_id' }),
    __metadata("design:type", Object)
], ProductVariant.prototype, "catalogProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], ProductVariant.prototype, "vertical", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 160 }),
    __metadata("design:type", String)
], ProductVariant.prototype, "sku", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], ProductVariant.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], ProductVariant.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], ProductVariant.prototype, "upc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], ProductVariant.prototype, "ean", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], ProductVariant.prototype, "mpn", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'condition_id', type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], ProductVariant.prototype, "conditionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], ProductVariant.prototype, "attributes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'image_urls', type: 'text', array: true, default: '{}' }),
    __metadata("design:type", Array)
], ProductVariant.prototype, "imageUrls", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], ProductVariant.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ProductVariant.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ProductVariant.prototype, "updatedAt", void 0);
exports.ProductVariant = ProductVariant = __decorate([
    (0, typeorm_1.Entity)('product_variants'),
    (0, typeorm_1.Unique)('uq_product_variant_family_sku', ['familyId', 'sku']),
    (0, typeorm_1.Index)('idx_product_variant_org_sku', ['organizationId', 'sku']),
    (0, typeorm_1.Index)('idx_product_variant_family', ['familyId'])
], ProductVariant);
//# sourceMappingURL=product-variant.entity.js.map