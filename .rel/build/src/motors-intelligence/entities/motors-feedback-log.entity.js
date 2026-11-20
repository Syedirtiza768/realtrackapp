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
exports.MotorsFeedbackLog = exports.FeedbackType = void 0;
const typeorm_1 = require("typeorm");
var FeedbackType;
(function (FeedbackType) {
    FeedbackType["REVIEWER_CORRECTION"] = "reviewer_correction";
    FeedbackType["TITLE_EDIT"] = "title_edit";
    FeedbackType["FITMENT_EDIT"] = "fitment_edit";
    FeedbackType["SPECIFICS_EDIT"] = "specifics_edit";
    FeedbackType["EBAY_API_ERROR"] = "ebay_api_error";
    FeedbackType["POLICY_REJECTION"] = "policy_rejection";
    FeedbackType["RETURN_INAD"] = "return_inad";
    FeedbackType["CTR_DATA"] = "ctr_data";
    FeedbackType["SELL_THROUGH"] = "sell_through";
    FeedbackType["BRAND_CORRECTION"] = "brand_correction";
    FeedbackType["MPN_CORRECTION"] = "mpn_correction";
    FeedbackType["CATEGORY_CORRECTION"] = "category_correction";
})(FeedbackType || (exports.FeedbackType = FeedbackType = {}));
let MotorsFeedbackLog = class MotorsFeedbackLog {
    id;
    motorsProductId;
    reviewTaskId;
    feedbackType;
    field;
    originalValue;
    correctedValue;
    context;
    appliedToRules;
    generatedCorrectionRuleId;
    createdBy;
    createdAt;
};
exports.MotorsFeedbackLog = MotorsFeedbackLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MotorsFeedbackLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], MotorsFeedbackLog.prototype, "motorsProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], MotorsFeedbackLog.prototype, "reviewTaskId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: FeedbackType }),
    __metadata("design:type", String)
], MotorsFeedbackLog.prototype, "feedbackType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsFeedbackLog.prototype, "field", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsFeedbackLog.prototype, "originalValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsFeedbackLog.prototype, "correctedValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], MotorsFeedbackLog.prototype, "context", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], MotorsFeedbackLog.prototype, "appliedToRules", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], MotorsFeedbackLog.prototype, "generatedCorrectionRuleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MotorsFeedbackLog.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], MotorsFeedbackLog.prototype, "createdAt", void 0);
exports.MotorsFeedbackLog = MotorsFeedbackLog = __decorate([
    (0, typeorm_1.Entity)('motors_feedback_logs'),
    (0, typeorm_1.Index)('idx_feedback_motors_product', ['motorsProductId']),
    (0, typeorm_1.Index)('idx_feedback_type', ['feedbackType']),
    (0, typeorm_1.Index)('idx_feedback_created', ['createdAt'])
], MotorsFeedbackLog);
//# sourceMappingURL=motors-feedback-log.entity.js.map