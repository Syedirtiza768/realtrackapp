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
exports.AiEnhancement = void 0;
const typeorm_1 = require("typeorm");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
let AiEnhancement = class AiEnhancement {
    id;
    listingId;
    listing;
    enhancementType;
    status;
    inputData;
    originalValue;
    enhancedValue;
    enhancedData;
    diff;
    provider;
    model;
    confidenceScore;
    tokensUsed;
    latencyMs;
    costUsd;
    version;
    enhancementVersion;
    approvedBy;
    approvedAt;
    appliedAt;
    rejectionReason;
    createdAt;
    updatedAt;
};
exports.AiEnhancement = AiEnhancement;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiEnhancement.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'uuid' }),
    __metadata("design:type", String)
], AiEnhancement.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => listing_record_entity_js_1.ListingRecord, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'listing_id' }),
    __metadata("design:type", listing_record_entity_js_1.ListingRecord)
], AiEnhancement.prototype, "listing", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'enhancement_type', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], AiEnhancement.prototype, "enhancementType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'requested' }),
    __metadata("design:type", String)
], AiEnhancement.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'input_data', type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "inputData", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'original_value', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "originalValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'enhanced_value', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "enhancedValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'enhanced_data', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "enhancedData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "diff", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "model", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'confidence_score', type: 'real', nullable: true }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "confidenceScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tokens_used', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "tokensUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'latency_ms', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "latencyMs", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'cost_usd',
        type: 'numeric',
        precision: 8,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "costUsd", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], AiEnhancement.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'enhancement_version', type: 'integer', default: 1 }),
    __metadata("design:type", Number)
], AiEnhancement.prototype, "enhancementVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'approved_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "approvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'approved_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "approvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'applied_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "appliedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rejection_reason', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AiEnhancement.prototype, "rejectionReason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], AiEnhancement.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], AiEnhancement.prototype, "updatedAt", void 0);
exports.AiEnhancement = AiEnhancement = __decorate([
    (0, typeorm_1.Entity)('ai_enhancements'),
    (0, typeorm_1.Index)('idx_ai_enh_listing', ['listingId']),
    (0, typeorm_1.Index)('idx_ai_enh_type', ['enhancementType']),
    (0, typeorm_1.Index)('idx_ai_enh_status', ['status']),
    (0, typeorm_1.Index)('idx_ai_enh_listing_type', ['listingId', 'enhancementType'])
], AiEnhancement);
//# sourceMappingURL=ai-enhancement.entity.js.map