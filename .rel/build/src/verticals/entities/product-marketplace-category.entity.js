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
exports.ProductMarketplaceCategory = void 0;
const typeorm_1 = require("typeorm");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
let ProductMarketplaceCategory = class ProductMarketplaceCategory {
    id;
    organizationId;
    catalogProductId;
    catalogProduct;
    vertical;
    marketplaceId;
    categoryTreeId;
    categoryId;
    categoryName;
    aspectMetadata;
    conditionMetadata;
    supportsVariations;
    fetchedAt;
    invalidatedAt;
    createdAt;
    updatedAt;
};
exports.ProductMarketplaceCategory = ProductMarketplaceCategory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ProductMarketplaceCategory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProductMarketplaceCategory.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid' }),
    __metadata("design:type", String)
], ProductMarketplaceCategory.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_product_entity_js_1.CatalogProduct, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'catalog_product_id' }),
    __metadata("design:type", catalog_product_entity_js_1.CatalogProduct)
], ProductMarketplaceCategory.prototype, "catalogProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], ProductMarketplaceCategory.prototype, "vertical", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'marketplace_id', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], ProductMarketplaceCategory.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_tree_id', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], ProductMarketplaceCategory.prototype, "categoryTreeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_id', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], ProductMarketplaceCategory.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_name', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ProductMarketplaceCategory.prototype, "categoryName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'aspect_metadata', type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], ProductMarketplaceCategory.prototype, "aspectMetadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'condition_metadata', type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], ProductMarketplaceCategory.prototype, "conditionMetadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'supports_variations', type: 'boolean', nullable: true }),
    __metadata("design:type", Object)
], ProductMarketplaceCategory.prototype, "supportsVariations", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fetched_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ProductMarketplaceCategory.prototype, "fetchedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invalidated_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ProductMarketplaceCategory.prototype, "invalidatedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ProductMarketplaceCategory.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ProductMarketplaceCategory.prototype, "updatedAt", void 0);
exports.ProductMarketplaceCategory = ProductMarketplaceCategory = __decorate([
    (0, typeorm_1.Entity)('product_marketplace_categories'),
    (0, typeorm_1.Unique)('uq_product_marketplace_category', [
        'catalogProductId',
        'marketplaceId',
    ]),
    (0, typeorm_1.Index)('idx_product_marketplace_category_vertical', [
        'vertical',
        'marketplaceId',
        'categoryId',
    ])
], ProductMarketplaceCategory);
//# sourceMappingURL=product-marketplace-category.entity.js.map