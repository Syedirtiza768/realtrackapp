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
exports.PublishVariantFamilyDto = exports.CreateVariantMappingDto = exports.CreateVariantDto = exports.CreateFamilyDto = exports.UpdateStoreVerticalConfigDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const vertical_types_js_1 = require("./vertical.types.js");
class UpdateStoreVerticalConfigDto {
    enabledVerticals;
    defaultVertical;
    workflows;
}
exports.UpdateStoreVerticalConfigDto = UpdateStoreVerticalConfigDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: vertical_types_js_1.PRODUCT_VERTICALS, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEnum)(vertical_types_js_1.PRODUCT_VERTICALS, { each: true }),
    __metadata("design:type", Array)
], UpdateStoreVerticalConfigDto.prototype, "enabledVerticals", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: vertical_types_js_1.PRODUCT_VERTICALS }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(vertical_types_js_1.PRODUCT_VERTICALS),
    __metadata("design:type", String)
], UpdateStoreVerticalConfigDto.prototype, "defaultVertical", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateStoreVerticalConfigDto.prototype, "workflows", void 0);
class CreateFamilyDto {
    catalogProductId;
    name;
    slug;
    vertical;
}
exports.CreateFamilyDto = CreateFamilyDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateFamilyDto.prototype, "catalogProductId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFamilyDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFamilyDto.prototype, "slug", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: vertical_types_js_1.PRODUCT_VERTICALS }),
    (0, class_validator_1.IsEnum)(vertical_types_js_1.PRODUCT_VERTICALS),
    __metadata("design:type", String)
], CreateFamilyDto.prototype, "vertical", void 0);
class CreateVariantDto {
    sku;
    quantity;
    price;
    attributes;
    imageUrls;
    conditionId;
}
exports.CreateVariantDto = CreateVariantDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateVariantDto.prototype, "sku", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateVariantDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateVariantDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateVariantDto.prototype, "attributes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateVariantDto.prototype, "imageUrls", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateVariantDto.prototype, "conditionId", void 0);
class CreateVariantMappingDto {
    variantId;
    ebayAccountId;
    marketplaceId;
    inventorySku;
}
exports.CreateVariantMappingDto = CreateVariantMappingDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateVariantMappingDto.prototype, "variantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateVariantMappingDto.prototype, "ebayAccountId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateVariantMappingDto.prototype, "marketplaceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateVariantMappingDto.prototype, "inventorySku", void 0);
class PublishVariantFamilyDto {
    storeId;
    ebayAccountId;
    marketplaceId;
    categoryId;
    merchantLocationKey;
    fulfillmentPolicyId;
    paymentPolicyId;
    returnPolicyId;
    currency;
}
exports.PublishVariantFamilyDto = PublishVariantFamilyDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PublishVariantFamilyDto.prototype, "storeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PublishVariantFamilyDto.prototype, "ebayAccountId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishVariantFamilyDto.prototype, "marketplaceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishVariantFamilyDto.prototype, "categoryId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishVariantFamilyDto.prototype, "merchantLocationKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishVariantFamilyDto.prototype, "fulfillmentPolicyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishVariantFamilyDto.prototype, "paymentPolicyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishVariantFamilyDto.prototype, "returnPolicyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'USD' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishVariantFamilyDto.prototype, "currency", void 0);
//# sourceMappingURL=verticals.dto.js.map