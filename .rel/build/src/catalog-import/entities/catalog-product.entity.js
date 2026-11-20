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
exports.CatalogProduct = void 0;
const typeorm_1 = require("typeorm");
let CatalogProduct = class CatalogProduct {
    id;
    sku;
    mpn;
    mpnNormalized;
    upc;
    ean;
    ebayItemId;
    epid;
    title;
    titleNormalized;
    description;
    brand;
    brandNormalized;
    partType;
    placement;
    material;
    features;
    countryOfOrigin;
    oemPartNumber;
    price;
    quantity;
    conditionId;
    conditionLabel;
    weight;
    categoryId;
    categoryName;
    imageUrls;
    imagesVariantsGeneratedAt;
    location;
    format;
    duration;
    shippingProfile;
    returnProfile;
    paymentProfile;
    fitmentData;
    optimizationStatus;
    optimizationVersion;
    optimizedAt;
    sourceDataHash;
    fitmentStatus;
    fitmentConfidence;
    ebayValidationStatus;
    optimizationErrors;
    optimizationWarnings;
    optimizedTitle;
    optimizedDescription;
    optimizationPayload;
    fitmentRows;
    donorVinDecoded;
    donorVin;
    donorYear;
    donorMake;
    donorModel;
    seoScore;
    readinessScore;
    manualReview;
    sourceFile;
    sourceRow;
    importId;
    pipelineJobId;
    teamId;
    organizationId;
    vertical;
    verticalAttributes;
    verticalValidationStatus;
    createdAt;
    updatedAt;
    searchVector;
};
exports.CatalogProduct = CatalogProduct;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CatalogProduct.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "sku", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "mpn", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mpn_normalized', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "mpnNormalized", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "upc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "ean", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_item_id', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "ebayItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "epid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], CatalogProduct.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'title_normalized', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "titleNormalized", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "brand", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'brand_normalized', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "brandNormalized", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'part_type', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "partType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "placement", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "material", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "features", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'country_of_origin', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "countryOfOrigin", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'oem_part_number', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "oemPartNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'condition_id', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "conditionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'condition_label', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "conditionLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 10, scale: 3, nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "weight", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_id', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_name', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "categoryName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'image_urls', type: 'text', array: true, default: '{}' }),
    __metadata("design:type", Array)
], CatalogProduct.prototype, "imageUrls", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'images_variants_generated_at',
        type: 'timestamptz',
        nullable: true,
    }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "imagesVariantsGeneratedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "format", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "duration", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'shipping_profile', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "shippingProfile", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'return_profile', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "returnProfile", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'payment_profile', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "paymentProfile", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fitment_data', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "fitmentData", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'optimization_status',
        type: 'varchar',
        length: 32,
        default: 'pending',
    }),
    __metadata("design:type", String)
], CatalogProduct.prototype, "optimizationStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'optimization_version', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CatalogProduct.prototype, "optimizationVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'optimized_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "optimizedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_data_hash', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "sourceDataHash", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'fitment_status',
        type: 'varchar',
        length: 32,
        default: 'pending',
    }),
    __metadata("design:type", String)
], CatalogProduct.prototype, "fitmentStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'fitment_confidence',
        type: 'numeric',
        precision: 5,
        scale: 4,
        nullable: true,
    }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "fitmentConfidence", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_validation_status',
        type: 'varchar',
        length: 32,
        nullable: true,
    }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "ebayValidationStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'optimization_errors', type: 'jsonb', default: () => "'[]'" }),
    __metadata("design:type", Array)
], CatalogProduct.prototype, "optimizationErrors", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'optimization_warnings',
        type: 'jsonb',
        default: () => "'[]'",
    }),
    __metadata("design:type", Array)
], CatalogProduct.prototype, "optimizationWarnings", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'optimized_title', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "optimizedTitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'optimized_description', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "optimizedDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'optimization_payload', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "optimizationPayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fitment_rows', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "fitmentRows", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'donor_vin_decoded', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "donorVinDecoded", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'donor_vin', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "donorVin", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'donor_year', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "donorYear", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'donor_make', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "donorMake", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'donor_model', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "donorModel", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'seo_score',
        type: 'numeric',
        precision: 5,
        scale: 4,
        nullable: true,
    }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "seoScore", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'readiness_score',
        type: 'numeric',
        precision: 5,
        scale: 4,
        nullable: true,
    }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "readinessScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'manual_review', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], CatalogProduct.prototype, "manualReview", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_file', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "sourceFile", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_row', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "sourceRow", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'import_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "importId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pipeline_job_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "pipelineJobId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'team_id', type: 'uuid', nullable: true }),
    (0, typeorm_1.Index)('idx_catalog_team'),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "teamId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "vertical", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vertical_attributes', type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "verticalAttributes", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'vertical_validation_status',
        type: 'varchar',
        length: 24,
        default: 'draft',
    }),
    __metadata("design:type", String)
], CatalogProduct.prototype, "verticalValidationStatus", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], CatalogProduct.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], CatalogProduct.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'tsvector',
        nullable: true,
        select: false,
    }),
    __metadata("design:type", Object)
], CatalogProduct.prototype, "searchVector", void 0);
exports.CatalogProduct = CatalogProduct = __decorate([
    (0, typeorm_1.Entity)('catalog_products'),
    (0, typeorm_1.Index)('idx_catalog_sku', ['sku'], { unique: true }),
    (0, typeorm_1.Index)('idx_catalog_mpn', ['mpn']),
    (0, typeorm_1.Index)('idx_catalog_upc', ['upc'], { unique: true, where: '"upc" IS NOT NULL' }),
    (0, typeorm_1.Index)('idx_catalog_ebay_item_id', ['ebayItemId'], {
        unique: true,
        where: '"ebay_item_id" IS NOT NULL',
    }),
    (0, typeorm_1.Index)('idx_catalog_brand_mpn', ['brandNormalized', 'mpnNormalized']),
    (0, typeorm_1.Index)('idx_catalog_title_normalized', ['titleNormalized']),
    (0, typeorm_1.Index)('idx_catalog_brand', ['brandNormalized'])
], CatalogProduct);
//# sourceMappingURL=catalog-product.entity.js.map