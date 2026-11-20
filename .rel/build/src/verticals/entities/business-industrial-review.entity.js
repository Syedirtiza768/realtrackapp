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
exports.BusinessIndustrialReview = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../auth/entities/organization.entity.js");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
let BusinessIndustrialReview = class BusinessIndustrialReview {
    id;
    organizationId;
    organization;
    catalogProductId;
    catalogProduct;
    status;
    provenanceConfirmed;
    specificationsVerified;
    testingReviewed;
    restrictedCategoryCleared;
    evidenceKeys;
    riskFlags;
    reviewedByUserId;
    notes;
    reviewedAt;
    reviewedProductUpdatedAt;
    createdAt;
    updatedAt;
};
exports.BusinessIndustrialReview = BusinessIndustrialReview;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], BusinessIndustrialReview.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], BusinessIndustrialReview.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], BusinessIndustrialReview.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid' }),
    __metadata("design:type", String)
], BusinessIndustrialReview.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_product_entity_js_1.CatalogProduct, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'catalog_product_id' }),
    __metadata("design:type", catalog_product_entity_js_1.CatalogProduct)
], BusinessIndustrialReview.prototype, "catalogProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], BusinessIndustrialReview.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provenance_confirmed', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], BusinessIndustrialReview.prototype, "provenanceConfirmed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'specifications_verified', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], BusinessIndustrialReview.prototype, "specificationsVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'testing_reviewed', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], BusinessIndustrialReview.prototype, "testingReviewed", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'restricted_category_cleared',
        type: 'boolean',
        default: false,
    }),
    __metadata("design:type", Boolean)
], BusinessIndustrialReview.prototype, "restrictedCategoryCleared", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'evidence_keys', type: 'text', array: true, default: '{}' }),
    __metadata("design:type", Array)
], BusinessIndustrialReview.prototype, "evidenceKeys", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'risk_flags', type: 'text', array: true, default: '{}' }),
    __metadata("design:type", Array)
], BusinessIndustrialReview.prototype, "riskFlags", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialReview.prototype, "reviewedByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialReview.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reviewed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialReview.prototype, "reviewedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'reviewed_product_updated_at',
        type: 'timestamptz',
        nullable: true,
    }),
    __metadata("design:type", Object)
], BusinessIndustrialReview.prototype, "reviewedProductUpdatedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], BusinessIndustrialReview.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], BusinessIndustrialReview.prototype, "updatedAt", void 0);
exports.BusinessIndustrialReview = BusinessIndustrialReview = __decorate([
    (0, typeorm_1.Entity)('business_industrial_reviews'),
    (0, typeorm_1.Unique)('uq_bi_review_product', ['organizationId', 'catalogProductId']),
    (0, typeorm_1.Index)('idx_bi_review_org_status', ['organizationId', 'status'])
], BusinessIndustrialReview);
//# sourceMappingURL=business-industrial-review.entity.js.map