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
exports.PipelineJob = void 0;
const typeorm_1 = require("typeorm");
let PipelineJob = class PipelineJob {
    id;
    status;
    originalFilename;
    storedFilePath;
    fileSizeBytes;
    totalParts;
    processedParts;
    vinDecodeSuccess;
    vinDecodeFailed;
    categoryApiCount;
    categoryFallbackCount;
    enrichedCount;
    fallbackCount;
    openaiTokensUsed;
    openaiCostUsd;
    outputUsPath;
    outputAuPath;
    outputDePath;
    outputUkPath;
    reportPath;
    optimizationStatus;
    optimizationProcessed;
    optimizationTotal;
    optimizationPassCount;
    optimizationReviewCount;
    optimizationBlockCount;
    titleVerificationStatus;
    titleVerificationProcessed;
    titleVerificationTotal;
    titleVerificationFlaggedCount;
    titleVerificationCostUsd;
    optimizationByMarketplace;
    stageDetails;
    lastError;
    errorCount;
    teamId;
    conditionLabel;
    marketplace;
    vertical;
    storeId;
    shippingProfileName;
    returnProfileName;
    paymentProfileName;
    fulfillmentPolicyId;
    paymentPolicyId;
    returnPolicyId;
    uploadCode;
    createdBy;
    startedAt;
    completedAt;
    createdAt;
    updatedAt;
};
exports.PipelineJob = PipelineJob;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PipelineJob.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, default: 'pending' }),
    __metadata("design:type", String)
], PipelineJob.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'original_filename', type: 'varchar', length: 500 }),
    __metadata("design:type", String)
], PipelineJob.prototype, "originalFilename", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'stored_file_path',
        type: 'varchar',
        length: 1000,
        nullable: true,
    }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "storedFilePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_size_bytes', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "fileSizeBytes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_parts', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "totalParts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'processed_parts', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "processedParts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vin_decode_success', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "vinDecodeSuccess", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vin_decode_failed', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "vinDecodeFailed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_api_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "categoryApiCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_fallback_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "categoryFallbackCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'enriched_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "enrichedCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fallback_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "fallbackCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'openai_tokens_used', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "openaiTokensUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'openai_cost_usd',
        type: 'numeric',
        precision: 8,
        scale: 4,
        default: 0,
    }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "openaiCostUsd", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'output_us_path',
        type: 'varchar',
        length: 1000,
        nullable: true,
    }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "outputUsPath", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'output_au_path',
        type: 'varchar',
        length: 1000,
        nullable: true,
    }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "outputAuPath", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'output_de_path',
        type: 'varchar',
        length: 1000,
        nullable: true,
    }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "outputDePath", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'output_uk_path',
        type: 'varchar',
        length: 1000,
        nullable: true,
    }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "outputUkPath", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'report_path',
        type: 'varchar',
        length: 1000,
        nullable: true,
    }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "reportPath", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'optimization_status',
        type: 'varchar',
        length: 32,
        default: 'pending',
    }),
    __metadata("design:type", String)
], PipelineJob.prototype, "optimizationStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'optimization_processed', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "optimizationProcessed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'optimization_total', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "optimizationTotal", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'optimization_pass_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "optimizationPassCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'optimization_review_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "optimizationReviewCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'optimization_block_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "optimizationBlockCount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'title_verification_status',
        type: 'varchar',
        length: 32,
        default: 'pending',
    }),
    __metadata("design:type", String)
], PipelineJob.prototype, "titleVerificationStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'title_verification_processed', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "titleVerificationProcessed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'title_verification_total', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "titleVerificationTotal", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'title_verification_flagged_count',
        type: 'integer',
        default: 0,
    }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "titleVerificationFlaggedCount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'title_verification_cost_usd',
        type: 'numeric',
        precision: 8,
        scale: 4,
        default: 0,
    }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "titleVerificationCostUsd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'optimization_by_marketplace', type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "optimizationByMarketplace", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'stage_details', type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "stageDetails", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PipelineJob.prototype, "errorCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'team_id', type: 'uuid', nullable: true }),
    (0, typeorm_1.Index)('idx_pipeline_job_team'),
    __metadata("design:type", Object)
], PipelineJob.prototype, "teamId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'condition_label',
        type: 'varchar',
        length: 50,
        nullable: true,
    }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "conditionLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 3, nullable: true }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "marketplace", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "vertical", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'shipping_profile_name',
        type: 'varchar',
        length: 255,
        nullable: true,
    }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "shippingProfileName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'return_profile_name',
        type: 'varchar',
        length: 255,
        nullable: true,
    }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "returnProfileName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'payment_profile_name',
        type: 'varchar',
        length: 255,
        nullable: true,
    }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "paymentProfileName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'fulfillment_policy_id',
        type: 'varchar',
        length: 64,
        nullable: true,
    }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "fulfillmentPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'payment_policy_id',
        type: 'varchar',
        length: 64,
        nullable: true,
    }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "paymentPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'return_policy_id',
        type: 'varchar',
        length: 64,
        nullable: true,
    }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "returnPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'upload_code', type: 'varchar', length: 30, nullable: true }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "uploadCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'started_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'completed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], PipelineJob.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], PipelineJob.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], PipelineJob.prototype, "updatedAt", void 0);
exports.PipelineJob = PipelineJob = __decorate([
    (0, typeorm_1.Entity)('pipeline_jobs'),
    (0, typeorm_1.Index)('idx_pipeline_job_status', ['status'])
], PipelineJob);
//# sourceMappingURL=pipeline-job.entity.js.map