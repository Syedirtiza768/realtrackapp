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
exports.UpdateExportRuleDto = exports.CreateExportRuleDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateExportRuleDto {
    name;
    description;
    storeId;
    filters;
    priceMultiplier;
    priceAddition;
    titlePrefix;
    titleSuffix;
    fulfillmentPolicyId;
    paymentPolicyId;
    returnPolicyId;
    scheduleCron;
    autoPublish;
}
exports.CreateExportRuleDto = CreateExportRuleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Human-readable rule name' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateExportRuleDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Optional description' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateExportRuleDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Target store ID' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateExportRuleDto.prototype, "storeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'JSONB filter criteria',
        example: {
            brand: ['TRW', 'Bosch'],
            partType: ['Brake Pad Set'],
            condition: ['NEW'],
            minPrice: 10,
            maxPrice: 500,
        },
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateExportRuleDto.prototype, "filters", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Price multiplier (e.g. 1.15 = +15%)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateExportRuleDto.prototype, "priceMultiplier", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Fixed price addition (after multiplier)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateExportRuleDto.prototype, "priceAddition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Title prefix to add' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreateExportRuleDto.prototype, "titlePrefix", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Title suffix to add' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreateExportRuleDto.prototype, "titleSuffix", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'eBay fulfillment policy ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateExportRuleDto.prototype, "fulfillmentPolicyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'eBay payment policy ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateExportRuleDto.prototype, "paymentPolicyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'eBay return policy ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateExportRuleDto.prototype, "returnPolicyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Cron expression for scheduled checks' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateExportRuleDto.prototype, "scheduleCron", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Auto-publish or create as draft' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateExportRuleDto.prototype, "autoPublish", void 0);
class UpdateExportRuleDto {
    name;
    description;
    storeId;
    filters;
    priceMultiplier;
    priceAddition;
    titlePrefix;
    titleSuffix;
    fulfillmentPolicyId;
    paymentPolicyId;
    returnPolicyId;
    scheduleCron;
    autoPublish;
    status;
}
exports.UpdateExportRuleDto = UpdateExportRuleDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Human-readable rule name' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateExportRuleDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Optional description' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateExportRuleDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Target store ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateExportRuleDto.prototype, "storeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'JSONB filter criteria' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateExportRuleDto.prototype, "filters", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Price multiplier' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateExportRuleDto.prototype, "priceMultiplier", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Fixed price addition' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateExportRuleDto.prototype, "priceAddition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], UpdateExportRuleDto.prototype, "titlePrefix", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], UpdateExportRuleDto.prototype, "titleSuffix", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateExportRuleDto.prototype, "fulfillmentPolicyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateExportRuleDto.prototype, "paymentPolicyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateExportRuleDto.prototype, "returnPolicyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateExportRuleDto.prototype, "scheduleCron", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateExportRuleDto.prototype, "autoPublish", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Rule status' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['active', 'paused', 'disabled']),
    __metadata("design:type", String)
], UpdateExportRuleDto.prototype, "status", void 0);
//# sourceMappingURL=export-rule.dto.js.map