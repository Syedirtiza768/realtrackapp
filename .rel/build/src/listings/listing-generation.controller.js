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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingGenerationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const listing_generation_service_js_1 = require("./listing-generation.service.js");
class GenerateDto {
    masterProductId;
    templateId;
    storeId;
    categoryName;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateDto.prototype, "masterProductId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateDto.prototype, "templateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateDto.prototype, "storeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateDto.prototype, "categoryName", void 0);
class GenerateAndPublishDto {
    masterProductId;
    templateId;
    storeIds;
    categoryName;
    publishImmediately;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateAndPublishDto.prototype, "masterProductId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateAndPublishDto.prototype, "templateId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], GenerateAndPublishDto.prototype, "storeIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateAndPublishDto.prototype, "categoryName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GenerateAndPublishDto.prototype, "publishImmediately", void 0);
class GenerateBatchDto {
    items;
}
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => GenerateDto),
    __metadata("design:type", Array)
], GenerateBatchDto.prototype, "items", void 0);
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
let ListingGenerationController = class ListingGenerationController {
    generationService;
    constructor(generationService) {
        this.generationService = generationService;
    }
    generate(dto) {
        const input = {
            masterProductId: dto.masterProductId,
            templateId: dto.templateId,
            storeId: dto.storeId,
            categoryName: dto.categoryName,
        };
        return this.generationService.generate(input);
    }
    generateBatch(dto) {
        const inputs = dto.items.map((item) => ({
            masterProductId: item.masterProductId,
            templateId: item.templateId,
            storeId: item.storeId,
            categoryName: item.categoryName,
        }));
        return this.generationService.generateBatch(inputs);
    }
    generateAndPublish(dto) {
        const input = {
            masterProductId: dto.masterProductId,
            templateId: dto.templateId,
            storeIds: dto.storeIds,
            categoryName: dto.categoryName,
            publishImmediately: dto.publishImmediately,
        };
        return this.generationService.generateAndCreateOffers(input);
    }
};
exports.ListingGenerationController = ListingGenerationController;
__decorate([
    (0, common_1.Post)('generate'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.generate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Generate AI-optimized listing content for a master product',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GenerateDto]),
    __metadata("design:returntype", void 0)
], ListingGenerationController.prototype, "generate", null);
__decorate([
    (0, common_1.Post)('generate-batch'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.generate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Batch generate listings for multiple products' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GenerateBatchDto]),
    __metadata("design:returntype", void 0)
], ListingGenerationController.prototype, "generateBatch", null);
__decorate([
    (0, common_1.Post)('generate-publish'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.publish'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Generate listing, create draft offers, and optionally publish to eBay',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GenerateAndPublishDto]),
    __metadata("design:returntype", void 0)
], ListingGenerationController.prototype, "generateAndPublish", null);
exports.ListingGenerationController = ListingGenerationController = __decorate([
    (0, swagger_1.ApiTags)('Listing Generation'),
    (0, common_1.Controller)('listings'),
    __metadata("design:paramtypes", [listing_generation_service_js_1.ListingGenerationService])
], ListingGenerationController);
//# sourceMappingURL=listing-generation.controller.js.map