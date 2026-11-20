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
exports.PipelineProgressDto = exports.PipelineStageDto = exports.ConfirmUploadResponseDto = exports.ConfirmUploadDto = exports.ImageUploadResponseDto = exports.ImageUploadRequestDto = exports.ImageUploadFileDto = exports.MotorsPipelineResultDto = exports.UpdateMotorsProductDto = exports.ResolveReviewTaskDto = exports.ReviewTaskQueryDto = exports.MotorsProductQueryDto = exports.BatchCreateMotorsProductDto = exports.CreateMotorsProductDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const entities_1 = require("../entities");
class CreateMotorsProductDto {
    sourceType;
    sourcePayload;
    brand;
    mpn;
    oemPartNumber;
    upc;
    productType;
    placement;
    condition;
    imageUrls;
    imageAssetIds;
    price;
    quantity;
    catalogProductId;
    organizationId;
}
exports.CreateMotorsProductDto = CreateMotorsProductDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: entities_1.MotorsSourceType }),
    (0, class_validator_1.IsEnum)(entities_1.MotorsSourceType),
    __metadata("design:type", String)
], CreateMotorsProductDto.prototype, "sourceType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateMotorsProductDto.prototype, "sourcePayload", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMotorsProductDto.prototype, "brand", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMotorsProductDto.prototype, "mpn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMotorsProductDto.prototype, "oemPartNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMotorsProductDto.prototype, "upc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMotorsProductDto.prototype, "productType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMotorsProductDto.prototype, "placement", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMotorsProductDto.prototype, "condition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateMotorsProductDto.prototype, "imageUrls", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], CreateMotorsProductDto.prototype, "imageAssetIds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateMotorsProductDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateMotorsProductDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateMotorsProductDto.prototype, "catalogProductId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateMotorsProductDto.prototype, "organizationId", void 0);
class BatchCreateMotorsProductDto {
    products;
}
exports.BatchCreateMotorsProductDto = BatchCreateMotorsProductDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [CreateMotorsProductDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateMotorsProductDto),
    __metadata("design:type", Array)
], BatchCreateMotorsProductDto.prototype, "products", void 0);
class MotorsProductQueryDto {
    status;
    sourceType;
    brand;
    productType;
    search;
    limit = 50;
    offset = 0;
    sortBy = 'createdAt';
    sortOrder = 'DESC';
}
exports.MotorsProductQueryDto = MotorsProductQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MotorsProductQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MotorsProductQueryDto.prototype, "sourceType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MotorsProductQueryDto.prototype, "brand", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MotorsProductQueryDto.prototype, "productType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MotorsProductQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], MotorsProductQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], MotorsProductQueryDto.prototype, "offset", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MotorsProductQueryDto.prototype, "sortBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MotorsProductQueryDto.prototype, "sortOrder", void 0);
class ReviewTaskQueryDto {
    status;
    priority;
    reason;
    assignedTo;
    limit = 50;
    offset = 0;
}
exports.ReviewTaskQueryDto = ReviewTaskQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReviewTaskQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReviewTaskQueryDto.prototype, "priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReviewTaskQueryDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReviewTaskQueryDto.prototype, "assignedTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], ReviewTaskQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], ReviewTaskQueryDto.prototype, "offset", void 0);
class ResolveReviewTaskDto {
    resolution;
    resolutionData;
    action;
}
exports.ResolveReviewTaskDto = ResolveReviewTaskDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ResolveReviewTaskDto.prototype, "resolution", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ResolveReviewTaskDto.prototype, "resolutionData", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ResolveReviewTaskDto.prototype, "action", void 0);
class UpdateMotorsProductDto {
    brand;
    mpn;
    oemPartNumber;
    productType;
    placement;
    condition;
    ebayCategoryId;
    generatedTitle;
    generatedItemSpecifics;
    generatedBulletFeatures;
    generatedHtmlDescription;
    price;
    quantity;
}
exports.UpdateMotorsProductDto = UpdateMotorsProductDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMotorsProductDto.prototype, "brand", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMotorsProductDto.prototype, "mpn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMotorsProductDto.prototype, "oemPartNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMotorsProductDto.prototype, "productType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMotorsProductDto.prototype, "placement", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMotorsProductDto.prototype, "condition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMotorsProductDto.prototype, "ebayCategoryId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMotorsProductDto.prototype, "generatedTitle", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateMotorsProductDto.prototype, "generatedItemSpecifics", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateMotorsProductDto.prototype, "generatedBulletFeatures", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMotorsProductDto.prototype, "generatedHtmlDescription", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateMotorsProductDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateMotorsProductDto.prototype, "quantity", void 0);
class MotorsPipelineResultDto {
    motorsProductId;
    status;
    identityConfidence;
    fitmentConfidence;
    complianceConfidence;
    publishable;
    reviewRequired;
    reviewTaskId;
    errors;
    warnings;
}
exports.MotorsPipelineResultDto = MotorsPipelineResultDto;
class ImageUploadFileDto {
    fileName;
    mimeType;
    fileSize;
}
exports.ImageUploadFileDto = ImageUploadFileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Original file name' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImageUploadFileDto.prototype, "fileName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'MIME type (image/jpeg, image/png, image/webp)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImageUploadFileDto.prototype, "mimeType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'File size in bytes' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ImageUploadFileDto.prototype, "fileSize", void 0);
class ImageUploadRequestDto {
    files;
    brand;
    mpn;
    productType;
    condition;
    price;
    quantity;
    autoRunPipeline;
}
exports.ImageUploadRequestDto = ImageUploadRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ImageUploadFileDto], description: 'Files to upload' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ImageUploadFileDto),
    __metadata("design:type", Array)
], ImageUploadRequestDto.prototype, "files", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Known brand (optional pre-fill)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImageUploadRequestDto.prototype, "brand", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Known MPN (optional pre-fill)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImageUploadRequestDto.prototype, "mpn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Product type hint' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImageUploadRequestDto.prototype, "productType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Condition' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImageUploadRequestDto.prototype, "condition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ImageUploadRequestDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ImageUploadRequestDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Auto-run pipeline after upload confirmation',
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], ImageUploadRequestDto.prototype, "autoRunPipeline", void 0);
class ImageUploadResponseDto {
    motorsProductId;
    uploadUrls;
    status;
}
exports.ImageUploadResponseDto = ImageUploadResponseDto;
class ConfirmUploadDto {
    uploadedKeys;
    autoRunPipeline;
}
exports.ConfirmUploadDto = ConfirmUploadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'S3 keys of successfully uploaded images' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ConfirmUploadDto.prototype, "uploadedKeys", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Run the AI pipeline immediately' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], ConfirmUploadDto.prototype, "autoRunPipeline", void 0);
class ConfirmUploadResponseDto {
    motorsProductId;
    imageUrls;
    pipelineStarted;
    status;
}
exports.ConfirmUploadResponseDto = ConfirmUploadResponseDto;
class PipelineStageDto {
    stage;
    label;
    status;
    startedAt;
    completedAt;
    error;
    details;
}
exports.PipelineStageDto = PipelineStageDto;
class PipelineProgressDto {
    motorsProductId;
    overallStatus;
    currentStage;
    stages;
    confidence;
    completedAt;
}
exports.PipelineProgressDto = PipelineProgressDto;
//# sourceMappingURL=index.js.map