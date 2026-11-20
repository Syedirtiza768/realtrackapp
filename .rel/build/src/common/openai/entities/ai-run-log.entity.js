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
exports.AiRunLog = void 0;
const typeorm_1 = require("typeorm");
let AiRunLog = class AiRunLog {
    id;
    sku;
    partNumber;
    partType;
    price;
    donorVehicle;
    marketplace;
    batchId;
    enhancementId;
    lane;
    model;
    attempt;
    promptVersion;
    routingPolicyVersion;
    inputTokens;
    outputTokens;
    costUsd;
    latencyMs;
    validationScore;
    complianceScore;
    hardFails;
    softFails;
    escalated;
    passedGate;
    fitmentRowCount;
    fitmentSource;
    fitmentRowsPre;
    fitmentRowsPost;
    tokensSavedEstimate;
    humanApproved;
    humanRejected;
    rejectionReason;
    published;
    publishError;
    ebayCategoryId;
    fieldEdits;
    guardFixes;
    createdAt;
};
exports.AiRunLog = AiRunLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiRunLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "sku", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'part_number', type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "partNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'part_type', type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "partType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'donor_vehicle', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "donorVehicle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "marketplace", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'batch_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "batchId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'enhancement_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "enhancementId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], AiRunLog.prototype, "lane", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80 }),
    __metadata("design:type", String)
], AiRunLog.prototype, "model", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'smallint', default: 1 }),
    __metadata("design:type", Number)
], AiRunLog.prototype, "attempt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'prompt_version', type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], AiRunLog.prototype, "promptVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'routing_policy_version', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "routingPolicyVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'input_tokens', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "inputTokens", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'output_tokens', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "outputTokens", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'cost_usd',
        type: 'numeric',
        precision: 10,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "costUsd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'latency_ms', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "latencyMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'validation_score', type: 'smallint', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "validationScore", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'compliance_score',
        type: 'numeric',
        precision: 5,
        scale: 4,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "complianceScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hard_fails', type: 'jsonb', default: () => "'[]'" }),
    __metadata("design:type", Array)
], AiRunLog.prototype, "hardFails", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'soft_fails', type: 'jsonb', default: () => "'[]'" }),
    __metadata("design:type", Array)
], AiRunLog.prototype, "softFails", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], AiRunLog.prototype, "escalated", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'passed_gate', default: false }),
    __metadata("design:type", Boolean)
], AiRunLog.prototype, "passedGate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fitment_row_count', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "fitmentRowCount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'fitment_source',
        type: 'varchar',
        length: 20,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "fitmentSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fitment_rows_pre', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "fitmentRowsPre", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fitment_rows_post', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "fitmentRowsPost", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tokens_saved_estimate', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "tokensSavedEstimate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'human_approved', type: 'boolean', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "humanApproved", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'human_rejected', type: 'boolean', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "humanRejected", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rejection_reason', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "rejectionReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "published", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'publish_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "publishError", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_category_id',
        type: 'varchar',
        length: 20,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "ebayCategoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'field_edits', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "fieldEdits", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'guard_fixes', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], AiRunLog.prototype, "guardFixes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], AiRunLog.prototype, "createdAt", void 0);
exports.AiRunLog = AiRunLog = __decorate([
    (0, typeorm_1.Entity)('ai_run_logs'),
    (0, typeorm_1.Index)('idx_ai_run_logs_part_type', ['partType']),
    (0, typeorm_1.Index)('idx_ai_run_logs_model', ['model']),
    (0, typeorm_1.Index)('idx_ai_run_logs_created', ['createdAt']),
    (0, typeorm_1.Index)('idx_ai_run_logs_sku', ['sku'])
], AiRunLog);
//# sourceMappingURL=ai-run-log.entity.js.map