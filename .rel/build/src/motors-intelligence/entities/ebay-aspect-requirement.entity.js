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
exports.EbayAspectRequirement = exports.AspectRequirementLevel = void 0;
const typeorm_1 = require("typeorm");
var AspectRequirementLevel;
(function (AspectRequirementLevel) {
    AspectRequirementLevel["REQUIRED"] = "required";
    AspectRequirementLevel["RECOMMENDED"] = "recommended";
    AspectRequirementLevel["OPTIONAL"] = "optional";
})(AspectRequirementLevel || (exports.AspectRequirementLevel = AspectRequirementLevel = {}));
let EbayAspectRequirement = class EbayAspectRequirement {
    id;
    ebayCategoryId;
    aspectName;
    requirementLevel;
    dataType;
    allowedValues;
    maxLength;
    isMultiValue;
    description;
    defaultValue;
    validationRules;
    createdAt;
    lastSyncedAt;
};
exports.EbayAspectRequirement = EbayAspectRequirement;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayAspectRequirement.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EbayAspectRequirement.prototype, "ebayCategoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EbayAspectRequirement.prototype, "aspectName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: AspectRequirementLevel }),
    __metadata("design:type", String)
], EbayAspectRequirement.prototype, "requirementLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayAspectRequirement.prototype, "dataType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], EbayAspectRequirement.prototype, "allowedValues", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], EbayAspectRequirement.prototype, "maxLength", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], EbayAspectRequirement.prototype, "isMultiValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayAspectRequirement.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayAspectRequirement.prototype, "defaultValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayAspectRequirement.prototype, "validationRules", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EbayAspectRequirement.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], EbayAspectRequirement.prototype, "lastSyncedAt", void 0);
exports.EbayAspectRequirement = EbayAspectRequirement = __decorate([
    (0, typeorm_1.Entity)('ebay_aspect_requirements'),
    (0, typeorm_1.Index)('idx_ebay_aspect_category', ['ebayCategoryId']),
    (0, typeorm_1.Index)('idx_ebay_aspect_name', ['aspectName'])
], EbayAspectRequirement);
//# sourceMappingURL=ebay-aspect-requirement.entity.js.map