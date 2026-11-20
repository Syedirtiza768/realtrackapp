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
exports.CreateFashionIntakeDto = exports.FashionImageBannerDto = exports.FashionSizeChartDto = exports.NextFashionSkuDto = exports.UpdateFashionWarehouseDto = exports.FashionWarehouseDto = exports.GenerateFashionListingDto = exports.AnalyzeFashionImagesDto = exports.FashionStoreAccessDto = exports.FashionUserCreateDto = exports.FashionStoreConfigDto = exports.FashionRoleDto = exports.FashionReviewDto = exports.UpdateFashionDraftDto = exports.CreateFashionDraftDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateFashionDraftDto {
    captureId;
    sku;
    title;
    description;
    brand;
    conditionId;
    price;
    quantity;
    imageUrls;
    categoryId;
    categoryName;
    verticalAttributes;
}
exports.CreateFashionDraftDto = CreateFashionDraftDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Stable UUID for safe retries of one new item.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateFashionDraftDto.prototype, "captureId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], CreateFashionDraftDto.prototype, "sku", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateFashionDraftDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFashionDraftDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFashionDraftDto.prototype, "brand", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFashionDraftDto.prototype, "conditionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateFashionDraftDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateFashionDraftDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(24),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateFashionDraftDto.prototype, "imageUrls", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFashionDraftDto.prototype, "categoryId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFashionDraftDto.prototype, "categoryName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateFashionDraftDto.prototype, "verticalAttributes", void 0);
class UpdateFashionDraftDto extends (0, swagger_1.PartialType)(CreateFashionDraftDto) {
    verticalValidationStatus;
}
exports.UpdateFashionDraftDto = UpdateFashionDraftDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['draft', 'needs_review'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['draft', 'needs_review']),
    __metadata("design:type", String)
], UpdateFashionDraftDto.prototype, "verticalValidationStatus", void 0);
class FashionReviewDto {
    decision;
    authenticityConfirmed;
    evidenceKeys;
    notes;
}
exports.FashionReviewDto = FashionReviewDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['approved', 'rejected'] }),
    (0, class_validator_1.IsIn)(['approved', 'rejected']),
    __metadata("design:type", String)
], FashionReviewDto.prototype, "decision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FashionReviewDto.prototype, "authenticityConfirmed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], FashionReviewDto.prototype, "evidenceKeys", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FashionReviewDto.prototype, "notes", void 0);
class FashionRoleDto {
    role;
}
exports.FashionRoleDto = FashionRoleDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['fashion_admin', 'fashion_manager', 'fashion_operator'],
    }),
    (0, class_validator_1.IsIn)(['fashion_admin', 'fashion_manager', 'fashion_operator']),
    __metadata("design:type", String)
], FashionRoleDto.prototype, "role", void 0);
class FashionStoreConfigDto {
    enabled;
}
exports.FashionStoreConfigDto = FashionStoreConfigDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FashionStoreConfigDto.prototype, "enabled", void 0);
class FashionUserCreateDto extends FashionRoleDto {
    email;
    name;
    password;
    storeIds;
}
exports.FashionUserCreateDto = FashionUserCreateDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], FashionUserCreateDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], FashionUserCreateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(12),
    (0, class_validator_1.MaxLength)(72),
    __metadata("design:type", String)
], FashionUserCreateDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], FashionUserCreateDto.prototype, "storeIds", void 0);
class FashionStoreAccessDto {
    storeIds;
    accessLevel;
}
exports.FashionStoreAccessDto = FashionStoreAccessDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], FashionStoreAccessDto.prototype, "storeIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['view', 'operate', 'admin']),
    __metadata("design:type", String)
], FashionStoreAccessDto.prototype, "accessLevel", void 0);
class AnalyzeFashionImagesDto {
    imageUrls;
    currentAttributes;
    confirmedKeys;
    sku;
    currentTitle;
    currentDescription;
    currentBrand;
    titleConfirmed;
    descriptionConfirmed;
    marketplaceId;
}
exports.AnalyzeFashionImagesDto = AnalyzeFashionImagesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(24),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AnalyzeFashionImagesDto.prototype, "imageUrls", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Object }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], AnalyzeFashionImagesDto.prototype, "currentAttributes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AnalyzeFashionImagesDto.prototype, "confirmedKeys", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], AnalyzeFashionImagesDto.prototype, "sku", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AnalyzeFashionImagesDto.prototype, "currentTitle", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AnalyzeFashionImagesDto.prototype, "currentDescription", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AnalyzeFashionImagesDto.prototype, "currentBrand", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AnalyzeFashionImagesDto.prototype, "titleConfirmed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AnalyzeFashionImagesDto.prototype, "descriptionConfirmed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], AnalyzeFashionImagesDto.prototype, "marketplaceId", void 0);
class GenerateFashionListingDto {
    verticalAttributes;
    brand;
    title;
    description;
    conditionLabel;
    titleConfirmed;
    descriptionConfirmed;
}
exports.GenerateFashionListingDto = GenerateFashionListingDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], GenerateFashionListingDto.prototype, "verticalAttributes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateFashionListingDto.prototype, "brand", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateFashionListingDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateFashionListingDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], GenerateFashionListingDto.prototype, "conditionLabel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GenerateFashionListingDto.prototype, "titleConfirmed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GenerateFashionListingDto.prototype, "descriptionConfirmed", void 0);
const BATCH_PATTERN = /^[A-Za-z0-9]{1,20}$/;
const SIZE_SUFFIX_PATTERN = /^[A-Za-z0-9]{1,8}$/;
class FashionWarehouseDto {
    code;
    name;
    countryCode;
    active;
}
exports.FashionWarehouseDto = FashionWarehouseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'PAK_KHI' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[A-Za-z0-9_-]{1,40}$/, {
        message: 'Warehouse code may use letters, numbers, _ and - (max 40).',
    }),
    __metadata("design:type", String)
], FashionWarehouseDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], FashionWarehouseDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'PK' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[A-Za-z]{2}$/, { message: 'Country must be a 2-letter ISO code.' }),
    __metadata("design:type", String)
], FashionWarehouseDto.prototype, "countryCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FashionWarehouseDto.prototype, "active", void 0);
class UpdateFashionWarehouseDto {
    name;
    countryCode;
    active;
}
exports.UpdateFashionWarehouseDto = UpdateFashionWarehouseDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateFashionWarehouseDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[A-Za-z]{2}$/, { message: 'Country must be a 2-letter ISO code.' }),
    __metadata("design:type", String)
], UpdateFashionWarehouseDto.prototype, "countryCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateFashionWarehouseDto.prototype, "active", void 0);
class NextFashionSkuDto {
    batch;
    sizeSuffix;
}
exports.NextFashionSkuDto = NextFashionSkuDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'AVP' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(BATCH_PATTERN, {
        message: 'Batch must be 1–20 letters or numbers.',
    }),
    __metadata("design:type", String)
], NextFashionSkuDto.prototype, "batch", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'M' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SIZE_SUFFIX_PATTERN, {
        message: 'Size suffix must be 1–8 letters or numbers.',
    }),
    __metadata("design:type", String)
], NextFashionSkuDto.prototype, "sizeSuffix", void 0);
class FashionSizeChartDto {
    template;
    unit;
    values;
    brandName;
    sku;
}
exports.FashionSizeChartDto = FashionSizeChartDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'tshirt' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], FashionSizeChartDto.prototype, "template", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['cm', 'in'] }),
    (0, class_validator_1.IsIn)(['cm', 'in']),
    __metadata("design:type", String)
], FashionSizeChartDto.prototype, "unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object, example: { shoulderMeasurement: '19' } }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], FashionSizeChartDto.prototype, "values", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Store name shown in the chart header.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], FashionSizeChartDto.prototype, "brandName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], FashionSizeChartDto.prototype, "sku", void 0);
class FashionImageBannerDto {
    imageUrl;
    text;
    position;
    theme;
}
exports.FashionImageBannerDto = FashionImageBannerDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], FashionImageBannerDto.prototype, "imageUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], FashionImageBannerDto.prototype, "text", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['top', 'bottom'] }),
    (0, class_validator_1.IsIn)(['top', 'bottom']),
    __metadata("design:type", String)
], FashionImageBannerDto.prototype, "position", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['dark', 'brand', 'light'] }),
    (0, class_validator_1.IsIn)(['dark', 'brand', 'light']),
    __metadata("design:type", String)
], FashionImageBannerDto.prototype, "theme", void 0);
class CreateFashionIntakeDto {
    captureId;
    sku;
    batch;
    warehouseCode;
    conditionId;
    department;
    categoryFamily;
    labelSize;
    frontImageUrl;
    backImageUrl;
    tagImageUrls;
    additionalImageUrls;
    sizeChartImageUrl;
    sizeChartTemplate;
    measurementsUnit;
    measurementValues;
    price;
    quantity;
    identify;
}
exports.CreateFashionIntakeDto = CreateFashionIntakeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Stable UUID for safe retries of one capture.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateFashionIntakeDto.prototype, "captureId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'AVP-10001-M' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], CreateFashionIntakeDto.prototype, "sku", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'AVP' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(BATCH_PATTERN, {
        message: 'Batch must be 1–20 letters or numbers.',
    }),
    __metadata("design:type", String)
], CreateFashionIntakeDto.prototype, "batch", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateFashionIntakeDto.prototype, "warehouseCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '3000' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateFashionIntakeDto.prototype, "conditionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Unisex' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateFashionIntakeDto.prototype, "department", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['clothing', 'footwear', 'accessories'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['clothing', 'footwear', 'accessories']),
    __metadata("design:type", String)
], CreateFashionIntakeDto.prototype, "categoryFamily", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], CreateFashionIntakeDto.prototype, "labelSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateFashionIntakeDto.prototype, "frontImageUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateFashionIntakeDto.prototype, "backImageUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(2),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateFashionIntakeDto.prototype, "tagImageUrls", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(13),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateFashionIntakeDto.prototype, "additionalImageUrls", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateFashionIntakeDto.prototype, "sizeChartImageUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'tshirt' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateFashionIntakeDto.prototype, "sizeChartTemplate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['cm', 'in'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['cm', 'in']),
    __metadata("design:type", String)
], CreateFashionIntakeDto.prototype, "measurementsUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Object }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateFashionIntakeDto.prototype, "measurementValues", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateFashionIntakeDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100000),
    __metadata("design:type", Number)
], CreateFashionIntakeDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFashionIntakeDto.prototype, "identify", void 0);
//# sourceMappingURL=fashion.dto.js.map