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
exports.EbayListingJob = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../../auth/entities/organization.entity.js");
const user_entity_js_1 = require("../../../auth/entities/user.entity.js");
const ebay_listing_job_target_entity_js_1 = require("./ebay-listing-job-target.entity.js");
let EbayListingJob = class EbayListingJob {
    id;
    organizationId;
    organization;
    requestedByUserId;
    requestedByUser;
    jobType;
    status;
    idempotencyKey;
    targets;
    createdAt;
    updatedAt;
};
exports.EbayListingJob = EbayListingJob;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayListingJob.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayListingJob.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], EbayListingJob.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requested_by_user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EbayListingJob.prototype, "requestedByUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_js_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'requested_by_user_id' }),
    __metadata("design:type", Object)
], EbayListingJob.prototype, "requestedByUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'job_type', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], EbayListingJob.prototype, "jobType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, default: 'pending' }),
    __metadata("design:type", String)
], EbayListingJob.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'idempotency_key',
        type: 'varchar',
        length: 120,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayListingJob.prototype, "idempotencyKey", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => ebay_listing_job_target_entity_js_1.EbayListingJobTarget, (t) => t.listingJob),
    __metadata("design:type", Array)
], EbayListingJob.prototype, "targets", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayListingJob.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayListingJob.prototype, "updatedAt", void 0);
exports.EbayListingJob = EbayListingJob = __decorate([
    (0, typeorm_1.Entity)('ebay_listing_jobs'),
    (0, typeorm_1.Index)('idx_ebay_jobs_org', ['organizationId'])
], EbayListingJob);
//# sourceMappingURL=ebay-listing-job.entity.js.map