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
exports.EbayPublishedListingBulkJob = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../auth/entities/organization.entity.js");
const user_entity_js_1 = require("../../auth/entities/user.entity.js");
const ebay_published_listing_bulk_job_item_entity_js_1 = require("./ebay-published-listing-bulk-job-item.entity.js");
let EbayPublishedListingBulkJob = class EbayPublishedListingBulkJob {
    id;
    organizationId;
    organization;
    requestedByUserId;
    requestedByUser;
    actionType;
    status;
    actionPayload;
    totalItems;
    successCount;
    failureCount;
    items;
    createdAt;
    updatedAt;
    completedAt;
};
exports.EbayPublishedListingBulkJob = EbayPublishedListingBulkJob;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayPublishedListingBulkJob.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListingBulkJob.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], EbayPublishedListingBulkJob.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requested_by_user_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListingBulkJob.prototype, "requestedByUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_js_1.User, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'requested_by_user_id' }),
    __metadata("design:type", user_entity_js_1.User)
], EbayPublishedListingBulkJob.prototype, "requestedByUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'action_type', type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], EbayPublishedListingBulkJob.prototype, "actionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, default: 'pending' }),
    __metadata("design:type", String)
], EbayPublishedListingBulkJob.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'action_payload', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingBulkJob.prototype, "actionPayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_items', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EbayPublishedListingBulkJob.prototype, "totalItems", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'success_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EbayPublishedListingBulkJob.prototype, "successCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'failure_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EbayPublishedListingBulkJob.prototype, "failureCount", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => ebay_published_listing_bulk_job_item_entity_js_1.EbayPublishedListingBulkJobItem, (i) => i.bulkJob),
    __metadata("design:type", Array)
], EbayPublishedListingBulkJob.prototype, "items", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayPublishedListingBulkJob.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayPublishedListingBulkJob.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'completed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingBulkJob.prototype, "completedAt", void 0);
exports.EbayPublishedListingBulkJob = EbayPublishedListingBulkJob = __decorate([
    (0, typeorm_1.Entity)('ebay_published_listing_bulk_jobs'),
    (0, typeorm_1.Index)('idx_epl_bulk_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_epl_bulk_status', ['status'])
], EbayPublishedListingBulkJob);
//# sourceMappingURL=ebay-published-listing-bulk-job.entity.js.map