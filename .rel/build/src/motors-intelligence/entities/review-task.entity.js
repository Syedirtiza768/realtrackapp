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
exports.ReviewTask = exports.ReviewTaskReason = exports.ReviewTaskPriority = exports.ReviewTaskStatus = void 0;
const typeorm_1 = require("typeorm");
var ReviewTaskStatus;
(function (ReviewTaskStatus) {
    ReviewTaskStatus["OPEN"] = "open";
    ReviewTaskStatus["IN_PROGRESS"] = "in_progress";
    ReviewTaskStatus["APPROVED"] = "approved";
    ReviewTaskStatus["REJECTED"] = "rejected";
    ReviewTaskStatus["DEFERRED"] = "deferred";
    ReviewTaskStatus["AUTO_RESOLVED"] = "auto_resolved";
})(ReviewTaskStatus || (exports.ReviewTaskStatus = ReviewTaskStatus = {}));
var ReviewTaskPriority;
(function (ReviewTaskPriority) {
    ReviewTaskPriority["LOW"] = "low";
    ReviewTaskPriority["MEDIUM"] = "medium";
    ReviewTaskPriority["HIGH"] = "high";
    ReviewTaskPriority["CRITICAL"] = "critical";
})(ReviewTaskPriority || (exports.ReviewTaskPriority = ReviewTaskPriority = {}));
var ReviewTaskReason;
(function (ReviewTaskReason) {
    ReviewTaskReason["MULTIPLE_IDENTITIES"] = "multiple_identities";
    ReviewTaskReason["OCR_CONFLICT"] = "ocr_conflict";
    ReviewTaskReason["MISSING_FITMENT"] = "missing_fitment";
    ReviewTaskReason["LOW_CONFIDENCE"] = "low_confidence";
    ReviewTaskReason["IMAGE_ONLY"] = "image_only";
    ReviewTaskReason["SUPPLIER_CONFLICT"] = "supplier_conflict";
    ReviewTaskReason["BRAND_AMBIGUITY"] = "brand_ambiguity";
    ReviewTaskReason["QUANTITY_AMBIGUITY"] = "quantity_ambiguity";
    ReviewTaskReason["SIDE_ORIENTATION_CONFLICT"] = "side_orientation_conflict";
    ReviewTaskReason["FRONT_REAR_CONFLICT"] = "front_rear_conflict";
    ReviewTaskReason["COMPLIANCE_FAILURE"] = "compliance_failure";
    ReviewTaskReason["MISSING_REQUIRED_ASPECTS"] = "missing_required_aspects";
    ReviewTaskReason["TITLE_QUALITY"] = "title_quality";
    ReviewTaskReason["FITMENT_UNVERIFIED"] = "fitment_unverified";
    ReviewTaskReason["DUPLICATE_DETECTED"] = "duplicate_detected";
})(ReviewTaskReason || (exports.ReviewTaskReason = ReviewTaskReason = {}));
let ReviewTask = class ReviewTask {
    id;
    motorsProductId;
    organizationId;
    status;
    priority;
    reason;
    reasonDetail;
    productSnapshot;
    candidatesSnapshot;
    extractionSnapshot;
    fitmentSnapshot;
    validationSnapshot;
    complianceSnapshot;
    assignedTo;
    assignedAt;
    resolution;
    resolutionData;
    resolvedBy;
    resolvedAt;
    dueAt;
    createdAt;
    updatedAt;
};
exports.ReviewTask = ReviewTask;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReviewTask.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "motorsProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ReviewTaskStatus,
        default: ReviewTaskStatus.OPEN,
    }),
    __metadata("design:type", String)
], ReviewTask.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ReviewTaskPriority,
        default: ReviewTaskPriority.MEDIUM,
    }),
    __metadata("design:type", String)
], ReviewTask.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ReviewTaskReason }),
    __metadata("design:type", String)
], ReviewTask.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "reasonDetail", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "productSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "candidatesSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "extractionSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "fitmentSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "validationSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "complianceSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "assignedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "resolution", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "resolutionData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "resolvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "dueAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ReviewTask.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ReviewTask.prototype, "updatedAt", void 0);
exports.ReviewTask = ReviewTask = __decorate([
    (0, typeorm_1.Entity)('review_tasks'),
    (0, typeorm_1.Index)('idx_review_task_status', ['status']),
    (0, typeorm_1.Index)('idx_review_task_priority', ['priority']),
    (0, typeorm_1.Index)('idx_review_task_motors_product', ['motorsProductId']),
    (0, typeorm_1.Index)('idx_review_task_assigned', ['assignedTo']),
    (0, typeorm_1.Index)('idx_review_task_org', ['organizationId'])
], ReviewTask);
//# sourceMappingURL=review-task.entity.js.map