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
exports.IngestionJob = void 0;
const typeorm_1 = require("typeorm");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
let IngestionJob = class IngestionJob {
    id;
    status;
    mode;
    sourceType;
    imageCount;
    aiProvider;
    aiModel;
    aiStartedAt;
    aiCompletedAt;
    aiCostUsd;
    reviewStatus;
    reviewedBy;
    reviewedAt;
    reviewNotes;
    listingId;
    listing;
    attemptCount;
    maxAttempts;
    lastError;
    nextRetryAt;
    createdBy;
    createdAt;
    updatedAt;
};
exports.IngestionJob = IngestionJob;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], IngestionJob.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: 'pending',
    }),
    __metadata("design:type", String)
], IngestionJob.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], IngestionJob.prototype, "mode", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'source_type',
        type: 'varchar',
        length: 20,
        default: 'upload',
    }),
    __metadata("design:type", String)
], IngestionJob.prototype, "sourceType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'image_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], IngestionJob.prototype, "imageCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ai_provider', type: 'varchar', length: 30, nullable: true }),
    __metadata("design:type", Object)
], IngestionJob.prototype, "aiProvider", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ai_model', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], IngestionJob.prototype, "aiModel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ai_started_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], IngestionJob.prototype, "aiStartedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ai_completed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], IngestionJob.prototype, "aiCompletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ai_cost_usd',
        type: 'numeric',
        precision: 8,
        scale: 4,
        nullable: true,
    }),
    __metadata("design:type", Object)
], IngestionJob.prototype, "aiCostUsd", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'review_status',
        type: 'varchar',
        length: 20,
        default: 'pending',
    }),
    __metadata("design:type", String)
], IngestionJob.prototype, "reviewStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reviewed_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], IngestionJob.prototype, "reviewedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reviewed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], IngestionJob.prototype, "reviewedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'review_notes', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], IngestionJob.prototype, "reviewNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], IngestionJob.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => listing_record_entity_js_1.ListingRecord, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'listing_id' }),
    __metadata("design:type", listing_record_entity_js_1.ListingRecord)
], IngestionJob.prototype, "listing", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'attempt_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], IngestionJob.prototype, "attemptCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_attempts', type: 'integer', default: 3 }),
    __metadata("design:type", Number)
], IngestionJob.prototype, "maxAttempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], IngestionJob.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'next_retry_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], IngestionJob.prototype, "nextRetryAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], IngestionJob.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], IngestionJob.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], IngestionJob.prototype, "updatedAt", void 0);
exports.IngestionJob = IngestionJob = __decorate([
    (0, typeorm_1.Entity)('ingestion_jobs'),
    (0, typeorm_1.Index)('idx_job_status', ['status']),
    (0, typeorm_1.Index)('idx_job_review', ['reviewStatus'], {
        where: `"review_status" = 'needs_review'`,
    })
], IngestionJob);
//# sourceMappingURL=ingestion-job.entity.js.map