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
exports.MasterProduct = void 0;
const typeorm_1 = require("typeorm");
let MasterProduct = class MasterProduct {
    id;
    organizationId;
    sku;
    brand;
    mpn;
    oemNumber;
    upc;
    ean;
    epid;
    title;
    partType;
    condition;
    conditionDescription;
    description;
    shortDescription;
    features;
    costPrice;
    retailPrice;
    mapPrice;
    currency;
    totalQuantity;
    warehouseLocation;
    weightLbs;
    dimensions;
    imageUrls;
    ebayCategoryId;
    ebayCategoryName;
    itemSpecifics;
    aiSearchKeywords;
    aiConfidence;
    aiEnrichedAt;
    status;
    sourceFile;
    listingRecordId;
    createdAt;
    updatedAt;
};
exports.MasterProduct = MasterProduct;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MasterProduct.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], MasterProduct.prototype, "sku", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "brand", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mpn', type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "mpn", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'oem_number', type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "oemNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "upc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "ean", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "epid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], MasterProduct.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'part_type', type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "partType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'NEW' }),
    __metadata("design:type", String)
], MasterProduct.prototype, "condition", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'condition_description', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "conditionDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'short_description', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "shortDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], MasterProduct.prototype, "features", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'cost_price',
        type: 'numeric',
        precision: 12,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "costPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'retail_price',
        type: 'numeric',
        precision: 12,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "retailPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'map_price',
        type: 'numeric',
        precision: 12,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "mapPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 3, default: 'USD' }),
    __metadata("design:type", String)
], MasterProduct.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_quantity', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], MasterProduct.prototype, "totalQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'warehouse_location',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "warehouseLocation", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'weight_lbs',
        type: 'numeric',
        precision: 8,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "weightLbs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "dimensions", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'image_urls', type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], MasterProduct.prototype, "imageUrls", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_category_id',
        type: 'varchar',
        length: 50,
        nullable: true,
    }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "ebayCategoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_category_name',
        type: 'varchar',
        length: 300,
        nullable: true,
    }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "ebayCategoryName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'item_specifics', type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "itemSpecifics", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ai_search_keywords', type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], MasterProduct.prototype, "aiSearchKeywords", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ai_confidence', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "aiConfidence", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ai_enriched_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "aiEnrichedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'draft' }),
    __metadata("design:type", String)
], MasterProduct.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_file', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "sourceFile", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_record_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], MasterProduct.prototype, "listingRecordId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], MasterProduct.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], MasterProduct.prototype, "updatedAt", void 0);
exports.MasterProduct = MasterProduct = __decorate([
    (0, typeorm_1.Entity)('master_products'),
    (0, typeorm_1.Index)('idx_master_product_sku', ['sku'], { unique: true }),
    (0, typeorm_1.Index)('idx_master_product_brand', ['brand']),
    (0, typeorm_1.Index)('idx_master_product_mpn', ['mpn']),
    (0, typeorm_1.Index)('idx_master_product_oem', ['oemNumber']),
    (0, typeorm_1.Index)('idx_master_product_part_type', ['partType']),
    (0, typeorm_1.Index)('idx_master_product_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_master_product_status', ['status'])
], MasterProduct);
//# sourceMappingURL=master-product.entity.js.map