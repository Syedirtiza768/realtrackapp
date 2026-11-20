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
exports.BusinessIndustrialImageIntakeGroup = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../auth/entities/organization.entity.js");
const business_industrial_image_intake_job_entity_js_1 = require("./business-industrial-image-intake-job.entity.js");
let BusinessIndustrialImageIntakeGroup = class BusinessIndustrialImageIntakeGroup {
    id;
    organizationId;
    organization;
    jobId;
    job;
    basePartName;
    basePartNormalized;
    rawFolderNames;
    instanceSuffixes;
    instanceCount;
    detectionStatus;
    detection;
    confidence;
    catalogProductId;
    errorMessage;
    createdAt;
    updatedAt;
};
exports.BusinessIndustrialImageIntakeGroup = BusinessIndustrialImageIntakeGroup;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeGroup.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeGroup.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], BusinessIndustrialImageIntakeGroup.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'job_id', type: 'uuid' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeGroup.prototype, "jobId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => business_industrial_image_intake_job_entity_js_1.BusinessIndustrialImageIntakeJob, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'job_id' }),
    __metadata("design:type", business_industrial_image_intake_job_entity_js_1.BusinessIndustrialImageIntakeJob)
], BusinessIndustrialImageIntakeGroup.prototype, "job", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'base_part_name', type: 'text' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeGroup.prototype, "basePartName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'base_part_normalized', type: 'text' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeGroup.prototype, "basePartNormalized", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'raw_folder_names',
        type: 'text',
        array: true,
        default: '{}',
    }),
    __metadata("design:type", Array)
], BusinessIndustrialImageIntakeGroup.prototype, "rawFolderNames", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'instance_suffixes',
        type: 'text',
        array: true,
        default: '{}',
    }),
    __metadata("design:type", Array)
], BusinessIndustrialImageIntakeGroup.prototype, "instanceSuffixes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'instance_count', type: 'int', default: 1 }),
    __metadata("design:type", Number)
], BusinessIndustrialImageIntakeGroup.prototype, "instanceCount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'detection_status',
        type: 'varchar',
        length: 24,
        default: 'pending',
    }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeGroup.prototype, "detectionStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'{}'::jsonb" }),
    __metadata("design:type", Object)
], BusinessIndustrialImageIntakeGroup.prototype, "detection", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 5, scale: 4, nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialImageIntakeGroup.prototype, "confidence", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialImageIntakeGroup.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialImageIntakeGroup.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], BusinessIndustrialImageIntakeGroup.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], BusinessIndustrialImageIntakeGroup.prototype, "updatedAt", void 0);
exports.BusinessIndustrialImageIntakeGroup = BusinessIndustrialImageIntakeGroup = __decorate([
    (0, typeorm_1.Entity)('business_industrial_image_intake_groups'),
    (0, typeorm_1.Unique)('uq_bi_image_intake_group_job_base', ['jobId', 'basePartNormalized']),
    (0, typeorm_1.Index)('idx_bi_image_intake_group_org_status', [
        'organizationId',
        'detectionStatus',
    ])
], BusinessIndustrialImageIntakeGroup);
//# sourceMappingURL=business-industrial-image-intake-group.entity.js.map