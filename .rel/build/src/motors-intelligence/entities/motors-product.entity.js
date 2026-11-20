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
exports.MotorsProduct = exports.MotorsSourceType = exports.MotorsProductStatus = void 0;
const typeorm_1 = require("typeorm");
var MotorsProductStatus;
(function (MotorsProductStatus) {
    MotorsProductStatus["PENDING"] = "pending";
    MotorsProductStatus["EXTRACTING"] = "extracting";
    MotorsProductStatus["IDENTIFYING"] = "identifying";
    MotorsProductStatus["RESOLVING_FITMENT"] = "resolving_fitment";
    MotorsProductStatus["GENERATING_LISTING"] = "generating_listing";
    MotorsProductStatus["VALIDATING"] = "validating";
    MotorsProductStatus["REVIEW_REQUIRED"] = "review_required";
    MotorsProductStatus["APPROVED"] = "approved";
    MotorsProductStatus["PUBLISHING"] = "publishing";
    MotorsProductStatus["PUBLISHED"] = "published";
    MotorsProductStatus["FAILED"] = "failed";
    MotorsProductStatus["REJECTED"] = "rejected";
})(MotorsProductStatus || (exports.MotorsProductStatus = MotorsProductStatus = {}));
var MotorsSourceType;
(function (MotorsSourceType) {
    MotorsSourceType["IMAGE_UPLOAD"] = "image_upload";
    MotorsSourceType["MPN_INPUT"] = "mpn_input";
    MotorsSourceType["OEM_INPUT"] = "oem_input";
    MotorsSourceType["CSV_IMPORT"] = "csv_import";
    MotorsSourceType["EXCEL_IMPORT"] = "excel_import";
    MotorsSourceType["SUPPLIER_FEED"] = "supplier_feed";
    MotorsSourceType["MARKETPLACE_REFERENCE"] = "marketplace_reference";
    MotorsSourceType["CATALOG_PRODUCT"] = "catalog_product";
})(MotorsSourceType || (exports.MotorsSourceType = MotorsSourceType = {}));
let MotorsProduct = class MotorsProduct {
    id;
    organizationId;
    listingId;
    catalogProductId;
    status;
    sourceType;
    sourcePayload;
    sourceFileName;
    sourceFilePath;
    sourceRowNumber;
    brand;
    brandNormalized;
    mpn;
    mpnNormalized;
    oemPartNumber;
    upc;
    epid;
    productType;
    productFamily;
    placement;
    material;
    finish;
    condition;
    features;
    includes;
    dimensions;
    quantityPerPack;
    sideOrientation;
    frontRear;
    ebayCategoryId;
    ebayCategoryName;
    compatibilityRequired;
    identityConfidence;
    fitmentConfidence;
    complianceConfidence;
    contentQualityScore;
    generatedTitle;
    generatedItemSpecifics;
    generatedBulletFeatures;
    generatedHtmlDescription;
    generatedKeywordRationale;
    generatedSearchTags;
    fitmentRows;
    compatibleVehicleSummary;
    imageUrls;
    imageAssetIds;
    price;
    quantity;
    ebayListingId;
    publishError;
    publishedAt;
    createdBy;
    approvedBy;
    approvedAt;
    version;
    createdAt;
    updatedAt;
    deletedAt;
};
exports.MotorsProduct = MotorsProduct;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MotorsProduct.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: MotorsProductStatus,
        default: MotorsProductStatus.PENDING,
    }),
    __metadata("design:type", String)
], MotorsProduct.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: MotorsSourceType }),
    __metadata("design:type", String)
], MotorsProduct.prototype, "sourceType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "sourcePayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "sourceFileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "sourceFilePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "sourceRowNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "brand", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "brandNormalized", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "mpn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "mpnNormalized", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "oemPartNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "upc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "epid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "productType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "productFamily", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "placement", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "material", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "finish", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "condition", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "features", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "includes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "dimensions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "quantityPerPack", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "sideOrientation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "frontRear", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "ebayCategoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "ebayCategoryName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], MotorsProduct.prototype, "compatibilityRequired", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "identityConfidence", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "fitmentConfidence", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "complianceConfidence", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "contentQualityScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "generatedTitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "generatedItemSpecifics", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "generatedBulletFeatures", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "generatedHtmlDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "generatedKeywordRationale", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "generatedSearchTags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "fitmentRows", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "compatibleVehicleSummary", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "imageUrls", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', array: true, nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "imageAssetIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "ebayListingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "publishError", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "publishedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "approvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "approvedAt", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], MotorsProduct.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], MotorsProduct.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], MotorsProduct.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], MotorsProduct.prototype, "deletedAt", void 0);
exports.MotorsProduct = MotorsProduct = __decorate([
    (0, typeorm_1.Entity)('motors_products'),
    (0, typeorm_1.Index)('idx_motors_product_status', ['status']),
    (0, typeorm_1.Index)('idx_motors_product_brand_mpn', ['brand', 'mpn']),
    (0, typeorm_1.Index)('idx_motors_product_source_type', ['sourceType']),
    (0, typeorm_1.Index)('idx_motors_product_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_motors_product_listing', ['listingId']),
    (0, typeorm_1.Index)('idx_motors_product_catalog', ['catalogProductId'])
], MotorsProduct);
//# sourceMappingURL=motors-product.entity.js.map