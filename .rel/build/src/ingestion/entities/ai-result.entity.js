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
exports.AiResult = void 0;
const typeorm_1 = require("typeorm");
const ingestion_job_entity_js_1 = require("./ingestion-job.entity.js");
let AiResult = class AiResult {
    id;
    jobId;
    job;
    rawResponse;
    provider;
    model;
    tokensUsed;
    latencyMs;
    extractedTitle;
    extractedBrand;
    extractedMpn;
    extractedOemNumber;
    extractedPartType;
    extractedCondition;
    extractedPriceEstimate;
    extractedDescription;
    extractedFeatures;
    extractedFitmentRaw;
    confidenceTitle;
    confidenceBrand;
    confidenceMpn;
    confidencePartType;
    confidenceOverall;
    matchedExistingId;
    matchConfidence;
    createdAt;
};
exports.AiResult = AiResult;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiResult.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'job_id', type: 'uuid' }),
    __metadata("design:type", String)
], AiResult.prototype, "jobId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ingestion_job_entity_js_1.IngestionJob, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'job_id' }),
    __metadata("design:type", ingestion_job_entity_js_1.IngestionJob)
], AiResult.prototype, "job", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'raw_response', type: 'jsonb' }),
    __metadata("design:type", Object)
], AiResult.prototype, "rawResponse", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], AiResult.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], AiResult.prototype, "model", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tokens_used', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "tokensUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'latency_ms', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "latencyMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'extracted_title', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "extractedTitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'extracted_brand', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "extractedBrand", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'extracted_mpn', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "extractedMpn", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'extracted_oem_number', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "extractedOemNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'extracted_part_type', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "extractedPartType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'extracted_condition', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "extractedCondition", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'extracted_price_estimate',
        type: 'numeric',
        precision: 10,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AiResult.prototype, "extractedPriceEstimate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'extracted_description', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "extractedDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'extracted_features',
        type: 'text',
        array: true,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AiResult.prototype, "extractedFeatures", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'extracted_fitment_raw', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "extractedFitmentRaw", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'confidence_title', type: 'real', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "confidenceTitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'confidence_brand', type: 'real', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "confidenceBrand", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'confidence_mpn', type: 'real', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "confidenceMpn", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'confidence_part_type', type: 'real', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "confidencePartType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'confidence_overall', type: 'real' }),
    __metadata("design:type", Number)
], AiResult.prototype, "confidenceOverall", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'matched_existing_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "matchedExistingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'match_confidence', type: 'real', nullable: true }),
    __metadata("design:type", Object)
], AiResult.prototype, "matchConfidence", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], AiResult.prototype, "createdAt", void 0);
exports.AiResult = AiResult = __decorate([
    (0, typeorm_1.Entity)('ai_results'),
    (0, typeorm_1.Index)('idx_ai_result_job', ['jobId']),
    (0, typeorm_1.Index)('idx_ai_result_confidence', ['confidenceOverall'])
], AiResult);
//# sourceMappingURL=ai-result.entity.js.map