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
exports.ComplianceConfigDto = exports.ReviewQueueQueryDto = exports.RejectListingDto = exports.ApproveListingDto = exports.ApplySuggestionDto = exports.CreateFashionBatchDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateFashionBatchDto {
    size;
    dryRun;
    ebayAccountId;
    marketplaceId;
    confirmAuthenticity;
    organizationId;
}
exports.CreateFashionBatchDto = CreateFashionBatchDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, maximum: 500, default: 100 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(500),
    __metadata("design:type", Number)
], CreateFashionBatchDto.prototype, "size", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Run images + compliance only; never calls eBay publish' }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFashionBatchDto.prototype, "dryRun", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Connected Fashion eBay account (required for live batches)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateFashionBatchDto.prototype, "ebayAccountId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], CreateFashionBatchDto.prototype, "marketplaceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Live batches: the reviewer confirms authenticity for listings that pass the compliance check',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFashionBatchDto.prototype, "confirmAuthenticity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateFashionBatchDto.prototype, "organizationId", void 0);
class ApplySuggestionDto {
    title;
    description;
    brand;
}
exports.ApplySuggestionDto = ApplySuggestionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ApplySuggestionDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50000),
    __metadata("design:type", Object)
], ApplySuggestionDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", Object)
], ApplySuggestionDto.prototype, "brand", void 0);
class ApproveListingDto {
    authenticityConfirmed;
    notes;
}
exports.ApproveListingDto = ApproveListingDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ApproveListingDto.prototype, "authenticityConfirmed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], ApproveListingDto.prototype, "notes", void 0);
class RejectListingDto {
    notes;
}
exports.RejectListingDto = RejectListingDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], RejectListingDto.prototype, "notes", void 0);
class ReviewQueueQueryDto {
    state;
    organizationId;
}
exports.ReviewQueueQueryDto = ReviewQueueQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['NEEDS_REVIEW', 'BLOCKED'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['NEEDS_REVIEW', 'BLOCKED']),
    __metadata("design:type", String)
], ReviewQueueQueryDto.prototype, "state", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReviewQueueQueryDto.prototype, "organizationId", void 0);
class ComplianceConfigDto {
    config;
}
exports.ComplianceConfigDto = ComplianceConfigDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Rule-list overrides; omitted lists use defaults' }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ComplianceConfigDto.prototype, "config", void 0);
//# sourceMappingURL=fashion-batch-publish.dto.js.map