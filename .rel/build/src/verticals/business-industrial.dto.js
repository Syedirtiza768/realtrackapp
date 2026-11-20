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
exports.BusinessIndustrialIncidentDto = exports.BusinessIndustrialStoreAccessDto = exports.BusinessIndustrialStoreAssignmentsDto = exports.BusinessIndustrialUserCreateDto = exports.BusinessIndustrialInviteDto = exports.BusinessIndustrialQuarantineDto = exports.BusinessIndustrialRoleDto = exports.BusinessIndustrialReviewDto = exports.UpdateBusinessIndustrialDraftDto = exports.CreateBusinessIndustrialDraftDto = exports.BusinessIndustrialUnitDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class BusinessIndustrialUnitDto {
    serialNumberPrivate;
    serialNumberPublic;
}
exports.BusinessIndustrialUnitDto = BusinessIndustrialUnitDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], BusinessIndustrialUnitDto.prototype, "serialNumberPrivate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], BusinessIndustrialUnitDto.prototype, "serialNumberPublic", void 0);
class CreateBusinessIndustrialDraftDto {
    sku;
    title;
    description;
    brand;
    manufacturer;
    model;
    mpn;
    conditionId;
    conditionLabel;
    price;
    quantity;
    imageUrls;
    categoryId;
    categoryName;
    optimizedTitle;
    optimizedDescription;
    optimizationPayload;
    seoScore;
    readinessScore;
    verticalAttributes;
    units;
}
exports.CreateBusinessIndustrialDraftDto = CreateBusinessIndustrialDraftDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], CreateBusinessIndustrialDraftDto.prototype, "sku", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateBusinessIndustrialDraftDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(20000),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBusinessIndustrialDraftDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateBusinessIndustrialDraftDto.prototype, "brand", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateBusinessIndustrialDraftDto.prototype, "manufacturer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateBusinessIndustrialDraftDto.prototype, "model", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateBusinessIndustrialDraftDto.prototype, "mpn", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateBusinessIndustrialDraftDto.prototype, "conditionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateBusinessIndustrialDraftDto.prototype, "conditionLabel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateBusinessIndustrialDraftDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateBusinessIndustrialDraftDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(24),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'], require_protocol: true }, { each: true }),
    __metadata("design:type", Array)
], CreateBusinessIndustrialDraftDto.prototype, "imageUrls", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateBusinessIndustrialDraftDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], CreateBusinessIndustrialDraftDto.prototype, "categoryName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateBusinessIndustrialDraftDto.prototype, "optimizedTitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20000),
    __metadata("design:type", String)
], CreateBusinessIndustrialDraftDto.prototype, "optimizedDescription", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateBusinessIndustrialDraftDto.prototype, "optimizationPayload", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreateBusinessIndustrialDraftDto.prototype, "seoScore", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreateBusinessIndustrialDraftDto.prototype, "readinessScore", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateBusinessIndustrialDraftDto.prototype, "verticalAttributes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BusinessIndustrialUnitDto),
    __metadata("design:type", Array)
], CreateBusinessIndustrialDraftDto.prototype, "units", void 0);
class UpdateBusinessIndustrialDraftDto {
    title;
    description;
    brand;
    manufacturer;
    model;
    mpn;
    conditionId;
    conditionLabel;
    price;
    quantity;
    imageUrls;
    categoryId;
    categoryName;
    verticalAttributes;
    units;
}
exports.UpdateBusinessIndustrialDraftDto = UpdateBusinessIndustrialDraftDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateBusinessIndustrialDraftDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20000),
    __metadata("design:type", String)
], UpdateBusinessIndustrialDraftDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateBusinessIndustrialDraftDto.prototype, "brand", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateBusinessIndustrialDraftDto.prototype, "manufacturer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateBusinessIndustrialDraftDto.prototype, "model", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateBusinessIndustrialDraftDto.prototype, "mpn", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], UpdateBusinessIndustrialDraftDto.prototype, "conditionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], UpdateBusinessIndustrialDraftDto.prototype, "conditionLabel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateBusinessIndustrialDraftDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateBusinessIndustrialDraftDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(24),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'], require_protocol: true }, { each: true }),
    __metadata("design:type", Array)
], UpdateBusinessIndustrialDraftDto.prototype, "imageUrls", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], UpdateBusinessIndustrialDraftDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], UpdateBusinessIndustrialDraftDto.prototype, "categoryName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateBusinessIndustrialDraftDto.prototype, "verticalAttributes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BusinessIndustrialUnitDto),
    __metadata("design:type", Array)
], UpdateBusinessIndustrialDraftDto.prototype, "units", void 0);
class BusinessIndustrialReviewDto {
    decision;
    provenanceConfirmed;
    specificationsVerified;
    testingReviewed;
    restrictedCategoryCleared;
    evidenceKeys;
    riskFlags;
    notes;
}
exports.BusinessIndustrialReviewDto = BusinessIndustrialReviewDto;
__decorate([
    (0, class_validator_1.IsIn)(['approved', 'rejected']),
    __metadata("design:type", String)
], BusinessIndustrialReviewDto.prototype, "decision", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BusinessIndustrialReviewDto.prototype, "provenanceConfirmed", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BusinessIndustrialReviewDto.prototype, "specificationsVerified", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BusinessIndustrialReviewDto.prototype, "testingReviewed", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BusinessIndustrialReviewDto.prototype, "restrictedCategoryCleared", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BusinessIndustrialReviewDto.prototype, "evidenceKeys", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BusinessIndustrialReviewDto.prototype, "riskFlags", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], BusinessIndustrialReviewDto.prototype, "notes", void 0);
class BusinessIndustrialRoleDto {
    role;
}
exports.BusinessIndustrialRoleDto = BusinessIndustrialRoleDto;
__decorate([
    (0, class_validator_1.IsIn)([
        'business_industrial_admin',
        'business_industrial_manager',
        'business_industrial_operator',
    ]),
    __metadata("design:type", String)
], BusinessIndustrialRoleDto.prototype, "role", void 0);
class BusinessIndustrialQuarantineDto {
    notes;
}
exports.BusinessIndustrialQuarantineDto = BusinessIndustrialQuarantineDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], BusinessIndustrialQuarantineDto.prototype, "notes", void 0);
class BusinessIndustrialInviteDto extends BusinessIndustrialRoleDto {
    email;
    name;
    storeIds;
}
exports.BusinessIndustrialInviteDto = BusinessIndustrialInviteDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], BusinessIndustrialInviteDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], BusinessIndustrialInviteDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsUUID)(undefined, { each: true }),
    __metadata("design:type", Array)
], BusinessIndustrialInviteDto.prototype, "storeIds", void 0);
class BusinessIndustrialUserCreateDto extends BusinessIndustrialRoleDto {
    email;
    name;
    password;
    storeIds;
}
exports.BusinessIndustrialUserCreateDto = BusinessIndustrialUserCreateDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], BusinessIndustrialUserCreateDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], BusinessIndustrialUserCreateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(12),
    (0, class_validator_1.MaxLength)(72),
    __metadata("design:type", String)
], BusinessIndustrialUserCreateDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], BusinessIndustrialUserCreateDto.prototype, "storeIds", void 0);
class BusinessIndustrialStoreAssignmentsDto {
    storeIds;
    accessLevel;
}
exports.BusinessIndustrialStoreAssignmentsDto = BusinessIndustrialStoreAssignmentsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], BusinessIndustrialStoreAssignmentsDto.prototype, "storeIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['view', 'operate', 'admin']),
    __metadata("design:type", String)
], BusinessIndustrialStoreAssignmentsDto.prototype, "accessLevel", void 0);
class BusinessIndustrialStoreAccessDto {
    storeId;
    accessLevel;
}
exports.BusinessIndustrialStoreAccessDto = BusinessIndustrialStoreAccessDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], BusinessIndustrialStoreAccessDto.prototype, "storeId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['view', 'operate', 'admin']),
    __metadata("design:type", String)
], BusinessIndustrialStoreAccessDto.prototype, "accessLevel", void 0);
class BusinessIndustrialIncidentDto {
    externalEventId;
    catalogProductId;
    incidentType;
    verified;
    eventOccurredAt;
    eventPayload;
    notes;
}
exports.BusinessIndustrialIncidentDto = BusinessIndustrialIncidentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], BusinessIndustrialIncidentDto.prototype, "externalEventId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], BusinessIndustrialIncidentDto.prototype, "catalogProductId", void 0);
__decorate([
    (0, class_validator_1.IsIn)([
        'counterfeit',
        'intellectual_property',
        'product_safety',
        'recalled_product',
        'other',
    ]),
    __metadata("design:type", String)
], BusinessIndustrialIncidentDto.prototype, "incidentType", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BusinessIndustrialIncidentDto.prototype, "verified", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], BusinessIndustrialIncidentDto.prototype, "eventOccurredAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], BusinessIndustrialIncidentDto.prototype, "eventPayload", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BusinessIndustrialIncidentDto.prototype, "notes", void 0);
//# sourceMappingURL=business-industrial.dto.js.map