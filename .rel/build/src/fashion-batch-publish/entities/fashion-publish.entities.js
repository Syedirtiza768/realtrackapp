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
exports.FashionComplianceConfigRow = exports.FashionPublishBatchItem = exports.FashionPublishBatch = exports.FashionListingPipeline = exports.FASHION_PIPELINE_STATES = void 0;
const typeorm_1 = require("typeorm");
exports.FASHION_PIPELINE_STATES = [
    'UNPUBLISHED',
    'IMAGES_PROCESSING',
    'IMAGES_READY',
    'COMPLIANCE_CHECK',
    'NEEDS_REVIEW',
    'BLOCKED',
    'READY',
    'PUBLISHING',
    'PUBLISHED',
    'FAILED',
];
let FashionListingPipeline = class FashionListingPipeline {
    catalogProductId;
    organizationId;
    state;
    activeBatchId;
    lastBatchId;
    complianceResult;
    riskScore;
    issues;
    fixes;
    suggestion;
    images;
    visionResult;
    visionFingerprint;
    ebayMasterUrls;
    ebayImageUrls;
    checkedAt;
    approvedByUserId;
    publishAttempt;
    listingJobId;
    ebayAccountId;
    marketplaceId;
    ebayItemId;
    ebayOfferId;
    publishedAt;
    lastError;
    createdAt;
    updatedAt;
};
exports.FashionListingPipeline = FashionListingPipeline;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'catalog_product_id', type: 'uuid' }),
    __metadata("design:type", String)
], FashionListingPipeline.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], FashionListingPipeline.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 24, default: 'UNPUBLISHED' }),
    __metadata("design:type", String)
], FashionListingPipeline.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'active_batch_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "activeBatchId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_batch_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "lastBatchId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'compliance_result',
        type: 'varchar',
        length: 16,
        nullable: true,
    }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "complianceResult", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'risk_score', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "riskScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[]'" }),
    __metadata("design:type", Array)
], FashionListingPipeline.prototype, "issues", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[]'" }),
    __metadata("design:type", Array)
], FashionListingPipeline.prototype, "fixes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "suggestion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[]'" }),
    __metadata("design:type", Array)
], FashionListingPipeline.prototype, "images", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vision_result', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "visionResult", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'vision_fingerprint',
        type: 'varchar',
        length: 64,
        nullable: true,
    }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "visionFingerprint", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_master_urls',
        type: 'text',
        array: true,
        default: '{}',
    }),
    __metadata("design:type", Array)
], FashionListingPipeline.prototype, "ebayMasterUrls", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_image_urls',
        type: 'text',
        array: true,
        default: '{}',
    }),
    __metadata("design:type", Array)
], FashionListingPipeline.prototype, "ebayImageUrls", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'checked_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "checkedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'approved_by_user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "approvedByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'publish_attempt', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], FashionListingPipeline.prototype, "publishAttempt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_job_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "listingJobId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'marketplace_id', type: 'varchar', length: 30, nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_item_id', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "ebayItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_offer_id', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "ebayOfferId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'published_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "publishedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], FashionListingPipeline.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], FashionListingPipeline.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], FashionListingPipeline.prototype, "updatedAt", void 0);
exports.FashionListingPipeline = FashionListingPipeline = __decorate([
    (0, typeorm_1.Entity)('fashion_listing_pipeline'),
    (0, typeorm_1.Index)('idx_flp_org_state', ['organizationId', 'state'])
], FashionListingPipeline);
let FashionPublishBatch = class FashionPublishBatch {
    id;
    organizationId;
    requestedByUserId;
    requestedSize;
    dryRun;
    ebayAccountId;
    marketplaceId;
    confirmedByUserId;
    status;
    completedAt;
    createdAt;
    updatedAt;
};
exports.FashionPublishBatch = FashionPublishBatch;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FashionPublishBatch.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], FashionPublishBatch.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requested_by_user_id', type: 'uuid' }),
    __metadata("design:type", String)
], FashionPublishBatch.prototype, "requestedByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requested_size', type: 'int' }),
    __metadata("design:type", Number)
], FashionPublishBatch.prototype, "requestedSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'dry_run', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], FashionPublishBatch.prototype, "dryRun", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], FashionPublishBatch.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'marketplace_id', type: 'varchar', length: 30, nullable: true }),
    __metadata("design:type", Object)
], FashionPublishBatch.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'confirmed_by_user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], FashionPublishBatch.prototype, "confirmedByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'queued' }),
    __metadata("design:type", String)
], FashionPublishBatch.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'completed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], FashionPublishBatch.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], FashionPublishBatch.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], FashionPublishBatch.prototype, "updatedAt", void 0);
exports.FashionPublishBatch = FashionPublishBatch = __decorate([
    (0, typeorm_1.Entity)('fashion_publish_batches'),
    (0, typeorm_1.Index)('idx_fpb_org_created', ['organizationId', 'createdAt'])
], FashionPublishBatch);
let FashionPublishBatchItem = class FashionPublishBatchItem {
    id;
    batchId;
    organizationId;
    catalogProductId;
    position;
    state;
    complianceResult;
    riskScore;
    issueCodes;
    ebayItemId;
    error;
    finishedAt;
    createdAt;
    updatedAt;
};
exports.FashionPublishBatchItem = FashionPublishBatchItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FashionPublishBatchItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'batch_id', type: 'uuid' }),
    __metadata("design:type", String)
], FashionPublishBatchItem.prototype, "batchId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], FashionPublishBatchItem.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid' }),
    __metadata("design:type", String)
], FashionPublishBatchItem.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], FashionPublishBatchItem.prototype, "position", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 24, default: 'UNPUBLISHED' }),
    __metadata("design:type", String)
], FashionPublishBatchItem.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'compliance_result',
        type: 'varchar',
        length: 16,
        nullable: true,
    }),
    __metadata("design:type", Object)
], FashionPublishBatchItem.prototype, "complianceResult", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'risk_score', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], FashionPublishBatchItem.prototype, "riskScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'issue_codes', type: 'text', array: true, default: '{}' }),
    __metadata("design:type", Array)
], FashionPublishBatchItem.prototype, "issueCodes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_item_id', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], FashionPublishBatchItem.prototype, "ebayItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], FashionPublishBatchItem.prototype, "error", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'finished_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], FashionPublishBatchItem.prototype, "finishedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], FashionPublishBatchItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], FashionPublishBatchItem.prototype, "updatedAt", void 0);
exports.FashionPublishBatchItem = FashionPublishBatchItem = __decorate([
    (0, typeorm_1.Entity)('fashion_publish_batch_items'),
    (0, typeorm_1.Index)('uq_fpbi_batch_product', ['batchId', 'catalogProductId'], {
        unique: true,
    }),
    (0, typeorm_1.Index)('idx_fpbi_product', ['catalogProductId'])
], FashionPublishBatchItem);
let FashionComplianceConfigRow = class FashionComplianceConfigRow {
    organizationId;
    config;
    updatedByUserId;
    updatedAt;
};
exports.FashionComplianceConfigRow = FashionComplianceConfigRow;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], FashionComplianceConfigRow.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'{}'" }),
    __metadata("design:type", Object)
], FashionComplianceConfigRow.prototype, "config", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_by_user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], FashionComplianceConfigRow.prototype, "updatedByUserId", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], FashionComplianceConfigRow.prototype, "updatedAt", void 0);
exports.FashionComplianceConfigRow = FashionComplianceConfigRow = __decorate([
    (0, typeorm_1.Entity)('fashion_compliance_configs')
], FashionComplianceConfigRow);
//# sourceMappingURL=fashion-publish.entities.js.map