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
exports.CorrectionRule = exports.CorrectionType = void 0;
const typeorm_1 = require("typeorm");
var CorrectionType;
(function (CorrectionType) {
    CorrectionType["CHAR_SUBSTITUTION"] = "char_substitution";
    CorrectionType["HYPHEN_NORMALIZATION"] = "hyphen_normalization";
    CorrectionType["SUPERSESSION"] = "supersession";
    CorrectionType["BRAND_ALIAS"] = "brand_alias";
    CorrectionType["BRAND_FORMAT"] = "brand_format";
    CorrectionType["PAIR_SINGLE"] = "pair_single";
    CorrectionType["SIDE_ORIENTATION"] = "side_orientation";
    CorrectionType["FRONT_REAR"] = "front_rear";
    CorrectionType["PRODUCT_TYPE_ALIAS"] = "product_type_alias";
    CorrectionType["FITMENT_NORMALIZATION"] = "fitment_normalization";
    CorrectionType["TITLE_PATTERN"] = "title_pattern";
})(CorrectionType || (exports.CorrectionType = CorrectionType = {}));
let CorrectionRule = class CorrectionRule {
    id;
    correctionType;
    brand;
    productType;
    inputPattern;
    correctedValue;
    isRegex;
    description;
    source;
    sourceReviewTaskId;
    applicationCount;
    active;
    priority;
    createdAt;
};
exports.CorrectionRule = CorrectionRule;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CorrectionRule.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: CorrectionType }),
    __metadata("design:type", String)
], CorrectionRule.prototype, "correctionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CorrectionRule.prototype, "brand", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CorrectionRule.prototype, "productType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], CorrectionRule.prototype, "inputPattern", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], CorrectionRule.prototype, "correctedValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], CorrectionRule.prototype, "isRegex", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CorrectionRule.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CorrectionRule.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CorrectionRule.prototype, "sourceReviewTaskId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CorrectionRule.prototype, "applicationCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], CorrectionRule.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CorrectionRule.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], CorrectionRule.prototype, "createdAt", void 0);
exports.CorrectionRule = CorrectionRule = __decorate([
    (0, typeorm_1.Entity)('correction_rules'),
    (0, typeorm_1.Index)('idx_correction_type', ['correctionType']),
    (0, typeorm_1.Index)('idx_correction_brand', ['brand']),
    (0, typeorm_1.Index)('idx_correction_active', ['active'])
], CorrectionRule);
//# sourceMappingURL=correction-rule.entity.js.map