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
exports.BusinessIndustrialImageIntakeJob = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../auth/entities/organization.entity.js");
let BusinessIndustrialImageIntakeJob = class BusinessIndustrialImageIntakeJob {
    id;
    organizationId;
    organization;
    createdByUserId;
    sourceRootName;
    sourceReferenceUrl;
    status;
    totalFolders;
    totalImages;
    processedFolders;
    processedImages;
    groupedParts;
    failedFolders;
    errorMessage;
    startedAt;
    completedAt;
    createdAt;
    updatedAt;
};
exports.BusinessIndustrialImageIntakeJob = BusinessIndustrialImageIntakeJob;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeJob.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeJob.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], BusinessIndustrialImageIntakeJob.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by_user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialImageIntakeJob.prototype, "createdByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_root_name', type: 'text' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeJob.prototype, "sourceRootName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_reference_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialImageIntakeJob.prototype, "sourceReferenceUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 24, default: 'pending' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeJob.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_folders', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], BusinessIndustrialImageIntakeJob.prototype, "totalFolders", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_images', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], BusinessIndustrialImageIntakeJob.prototype, "totalImages", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'processed_folders', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], BusinessIndustrialImageIntakeJob.prototype, "processedFolders", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'processed_images', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], BusinessIndustrialImageIntakeJob.prototype, "processedImages", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'grouped_parts', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], BusinessIndustrialImageIntakeJob.prototype, "groupedParts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'failed_folders', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], BusinessIndustrialImageIntakeJob.prototype, "failedFolders", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialImageIntakeJob.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'started_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialImageIntakeJob.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'completed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialImageIntakeJob.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], BusinessIndustrialImageIntakeJob.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], BusinessIndustrialImageIntakeJob.prototype, "updatedAt", void 0);
exports.BusinessIndustrialImageIntakeJob = BusinessIndustrialImageIntakeJob = __decorate([
    (0, typeorm_1.Entity)('business_industrial_image_intake_jobs'),
    (0, typeorm_1.Index)('idx_bi_image_intake_job_org_status', ['organizationId', 'status'])
], BusinessIndustrialImageIntakeJob);
//# sourceMappingURL=business-industrial-image-intake-job.entity.js.map