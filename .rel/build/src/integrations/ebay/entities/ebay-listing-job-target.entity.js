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
exports.EbayListingJobTarget = void 0;
const typeorm_1 = require("typeorm");
const catalog_product_entity_js_1 = require("../../../catalog-import/entities/catalog-product.entity.js");
const connected_ebay_account_entity_js_1 = require("./connected-ebay-account.entity.js");
const ebay_listing_job_entity_js_1 = require("./ebay-listing-job.entity.js");
let EbayListingJobTarget = class EbayListingJobTarget {
    id;
    listingJobId;
    listingJob;
    catalogProductId;
    catalogProduct;
    ebayAccountId;
    ebayAccount;
    marketplaceId;
    vertical;
    status;
    resultPayload;
    errorPayload;
    createdAt;
    updatedAt;
};
exports.EbayListingJobTarget = EbayListingJobTarget;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayListingJobTarget.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_job_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayListingJobTarget.prototype, "listingJobId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ebay_listing_job_entity_js_1.EbayListingJob, (j) => j.targets, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'listing_job_id' }),
    __metadata("design:type", ebay_listing_job_entity_js_1.EbayListingJob)
], EbayListingJobTarget.prototype, "listingJob", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EbayListingJobTarget.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_product_entity_js_1.CatalogProduct, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'catalog_product_id' }),
    __metadata("design:type", Object)
], EbayListingJobTarget.prototype, "catalogProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EbayListingJobTarget.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, {
        onDelete: 'SET NULL',
        nullable: true,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", Object)
], EbayListingJobTarget.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'marketplace_id', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], EbayListingJobTarget.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], EbayListingJobTarget.prototype, "vertical", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], EbayListingJobTarget.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'result_payload', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayListingJobTarget.prototype, "resultPayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_payload', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayListingJobTarget.prototype, "errorPayload", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayListingJobTarget.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayListingJobTarget.prototype, "updatedAt", void 0);
exports.EbayListingJobTarget = EbayListingJobTarget = __decorate([
    (0, typeorm_1.Entity)('ebay_listing_job_targets'),
    (0, typeorm_1.Index)('idx_ebay_job_targets_job', ['listingJobId']),
    (0, typeorm_1.Index)('idx_ebay_job_targets_product', ['catalogProductId'])
], EbayListingJobTarget);
//# sourceMappingURL=ebay-listing-job-target.entity.js.map