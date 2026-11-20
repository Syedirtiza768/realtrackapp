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
exports.BusinessIndustrialImageIntakeAsset = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../auth/entities/organization.entity.js");
const business_industrial_image_intake_job_entity_js_1 = require("./business-industrial-image-intake-job.entity.js");
const business_industrial_image_intake_group_entity_js_1 = require("./business-industrial-image-intake-group.entity.js");
let BusinessIndustrialImageIntakeAsset = class BusinessIndustrialImageIntakeAsset {
    id;
    organizationId;
    organization;
    jobId;
    job;
    groupId;
    group;
    sourceFolderName;
    relativePath;
    filename;
    s3Bucket;
    s3Key;
    cdnUrl;
    mimeType;
    fileSizeBytes;
    createdAt;
};
exports.BusinessIndustrialImageIntakeAsset = BusinessIndustrialImageIntakeAsset;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeAsset.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeAsset.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], BusinessIndustrialImageIntakeAsset.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'job_id', type: 'uuid' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeAsset.prototype, "jobId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => business_industrial_image_intake_job_entity_js_1.BusinessIndustrialImageIntakeJob, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'job_id' }),
    __metadata("design:type", business_industrial_image_intake_job_entity_js_1.BusinessIndustrialImageIntakeJob)
], BusinessIndustrialImageIntakeAsset.prototype, "job", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'group_id', type: 'uuid' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeAsset.prototype, "groupId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => business_industrial_image_intake_group_entity_js_1.BusinessIndustrialImageIntakeGroup, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'group_id' }),
    __metadata("design:type", business_industrial_image_intake_group_entity_js_1.BusinessIndustrialImageIntakeGroup)
], BusinessIndustrialImageIntakeAsset.prototype, "group", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_folder_name', type: 'text' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeAsset.prototype, "sourceFolderName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'relative_path', type: 'text' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeAsset.prototype, "relativePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeAsset.prototype, "filename", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 's3_bucket', type: 'text' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeAsset.prototype, "s3Bucket", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 's3_key', type: 'text' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeAsset.prototype, "s3Key", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cdn_url', type: 'text' }),
    __metadata("design:type", String)
], BusinessIndustrialImageIntakeAsset.prototype, "cdnUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mime_type', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialImageIntakeAsset.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_size_bytes', type: 'bigint' }),
    __metadata("design:type", Number)
], BusinessIndustrialImageIntakeAsset.prototype, "fileSizeBytes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], BusinessIndustrialImageIntakeAsset.prototype, "createdAt", void 0);
exports.BusinessIndustrialImageIntakeAsset = BusinessIndustrialImageIntakeAsset = __decorate([
    (0, typeorm_1.Entity)('business_industrial_image_intake_assets'),
    (0, typeorm_1.Unique)('uq_bi_image_intake_asset_job_path', ['jobId', 'relativePath']),
    (0, typeorm_1.Index)('idx_bi_image_intake_asset_group', ['groupId'])
], BusinessIndustrialImageIntakeAsset);
//# sourceMappingURL=business-industrial-image-intake-asset.entity.js.map