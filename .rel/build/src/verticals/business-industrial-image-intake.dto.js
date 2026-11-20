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
exports.ApplyBusinessIndustrialImageIntakeGroupDto = exports.CreateBusinessIndustrialDriveIntakeJobDto = exports.CreateBusinessIndustrialImageIntakeJobDto = void 0;
const class_validator_1 = require("class-validator");
const business_industrial_config_js_1 = require("./business-industrial.config.js");
const categoryFamilyIds = business_industrial_config_js_1.BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES.map((family) => family.id);
class CreateBusinessIndustrialImageIntakeJobDto {
    sourceRootName;
    sourceReferenceUrl;
}
exports.CreateBusinessIndustrialImageIntakeJobDto = CreateBusinessIndustrialImageIntakeJobDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateBusinessIndustrialImageIntakeJobDto.prototype, "sourceRootName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'], require_protocol: true }),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreateBusinessIndustrialImageIntakeJobDto.prototype, "sourceReferenceUrl", void 0);
class CreateBusinessIndustrialDriveIntakeJobDto {
    folderUrl;
    maxItems;
    skipFolderNames;
    autoCreateDrafts;
}
exports.CreateBusinessIndustrialDriveIntakeJobDto = CreateBusinessIndustrialDriveIntakeJobDto;
__decorate([
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'], require_protocol: true }),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreateBusinessIndustrialDriveIntakeJobDto.prototype, "folderUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateBusinessIndustrialDriveIntakeJobDto.prototype, "maxItems", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(200, { each: true }),
    __metadata("design:type", Array)
], CreateBusinessIndustrialDriveIntakeJobDto.prototype, "skipFolderNames", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateBusinessIndustrialDriveIntakeJobDto.prototype, "autoCreateDrafts", void 0);
class ApplyBusinessIndustrialImageIntakeGroupDto {
    sku;
    title;
    description;
    brand;
    model;
    conditionId;
    mpn;
    conditionLabel;
    price;
    quantity;
    categoryFamily;
    categoryId;
    categoryName;
    verticalAttributes;
}
exports.ApplyBusinessIndustrialImageIntakeGroupDto = ApplyBusinessIndustrialImageIntakeGroupDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "sku", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20000),
    __metadata("design:type", String)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "brand", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "model", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "conditionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "mpn", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "conditionLabel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(categoryFamilyIds),
    __metadata("design:type", String)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "categoryFamily", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "categoryName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ApplyBusinessIndustrialImageIntakeGroupDto.prototype, "verticalAttributes", void 0);
//# sourceMappingURL=business-industrial-image-intake.dto.js.map