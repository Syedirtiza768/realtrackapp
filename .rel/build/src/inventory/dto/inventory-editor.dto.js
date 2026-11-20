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
exports.PublishListingDto = exports.PublishTargetDto = exports.PublishPolicyOverridesDto = exports.SaveEditorDto = exports.SaveMarketplaceVersionDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class SaveMarketplaceVersionDto {
    marketplace;
    title;
    description;
    price;
    quantity;
    conditionId;
    conditionDescription;
    itemSpecifics;
}
exports.SaveMarketplaceVersionDto = SaveMarketplaceVersionDto;
__decorate([
    (0, class_validator_1.IsIn)(['US', 'AU', 'DE']),
    __metadata("design:type", String)
], SaveMarketplaceVersionDto.prototype, "marketplace", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveMarketplaceVersionDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveMarketplaceVersionDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], SaveMarketplaceVersionDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], SaveMarketplaceVersionDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveMarketplaceVersionDto.prototype, "conditionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], SaveMarketplaceVersionDto.prototype, "conditionDescription", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SaveMarketplaceVersionDto.prototype, "itemSpecifics", void 0);
class SaveEditorDto {
    marketplaceVersions;
}
exports.SaveEditorDto = SaveEditorDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaveMarketplaceVersionDto),
    __metadata("design:type", Array)
], SaveEditorDto.prototype, "marketplaceVersions", void 0);
class PublishPolicyOverridesDto {
    fulfillmentPolicyId;
    paymentPolicyId;
    returnPolicyId;
    merchantLocationKey;
}
exports.PublishPolicyOverridesDto = PublishPolicyOverridesDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishPolicyOverridesDto.prototype, "fulfillmentPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishPolicyOverridesDto.prototype, "paymentPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishPolicyOverridesDto.prototype, "returnPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishPolicyOverridesDto.prototype, "merchantLocationKey", void 0);
class PublishTargetDto {
    storeId;
    marketplaceId;
    policyOverrides;
}
exports.PublishTargetDto = PublishTargetDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishTargetDto.prototype, "storeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishTargetDto.prototype, "marketplaceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PublishPolicyOverridesDto),
    __metadata("design:type", PublishPolicyOverridesDto)
], PublishTargetDto.prototype, "policyOverrides", void 0);
class PublishListingDto {
    targets;
}
exports.PublishListingDto = PublishListingDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PublishTargetDto),
    __metadata("design:type", Array)
], PublishListingDto.prototype, "targets", void 0);
//# sourceMappingURL=inventory-editor.dto.js.map