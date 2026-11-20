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
exports.VerticalsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const verticals_service_js_1 = require("./verticals.service.js");
const verticals_dto_js_1 = require("./verticals.dto.js");
const ebay_variant_publishing_service_js_1 = require("./ebay-variant-publishing.service.js");
let VerticalsController = class VerticalsController {
    verticals;
    userOrganizations;
    variantPublishing;
    constructor(verticals, userOrganizations, variantPublishing) {
        this.verticals = verticals;
        this.userOrganizations = userOrganizations;
        this.variantPublishing = variantPublishing;
    }
    getProfiles() {
        return this.verticals.getProfiles();
    }
    async getStores(user, organizationId) {
        const org = await this.userOrganizations.resolveOrganizationId(user.id, organizationId);
        return this.verticals.listStoresForOrganization(org.organizationId);
    }
    async getStoreConfig(user, storeId, organizationId) {
        const org = await this.userOrganizations.resolveOrganizationId(user.id, organizationId);
        return this.verticals.getStoreConfigForOrganization(storeId, org.organizationId);
    }
    async updateStoreConfig(user, storeId, dto, organizationId) {
        const org = await this.userOrganizations.resolveOrganizationId(user.id, organizationId);
        return this.verticals.updateStoreConfig(storeId, org.organizationId, dto);
    }
    async getCategoryMetadata(productId, storeId, marketplaceId, categoryId) {
        return this.verticals.getCategoryMetadata(storeId, marketplaceId, categoryId);
    }
    async createFamily(user, dto, organizationId) {
        const org = await this.userOrganizations.resolveOrganizationId(user.id, organizationId);
        return this.verticals.createFamily({
            ...dto,
            organizationId: org.organizationId,
        });
    }
    async listVariants(user, familyId, organizationId) {
        const org = await this.userOrganizations.resolveOrganizationId(user.id, organizationId);
        return this.verticals.listVariants(familyId, org.organizationId);
    }
    async createVariant(user, familyId, dto, organizationId) {
        const org = await this.userOrganizations.resolveOrganizationId(user.id, organizationId);
        return this.verticals.createVariant({
            ...dto,
            familyId,
            organizationId: org.organizationId,
        });
    }
    async createVariantMapping(user, dto, organizationId) {
        const org = await this.userOrganizations.resolveOrganizationId(user.id, organizationId);
        return this.verticals.createVariantMapping({
            ...dto,
            organizationId: org.organizationId,
        });
    }
    async publishFamily(user, familyId, dto, organizationId) {
        const org = await this.userOrganizations.resolveOrganizationId(user.id, organizationId);
        return this.variantPublishing.publishFamily({
            ...dto,
            familyId,
            organizationId: org.organizationId,
        });
    }
};
exports.VerticalsController = VerticalsController;
__decorate([
    (0, common_1.Get)('profiles'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VerticalsController.prototype, "getProfiles", null);
__decorate([
    (0, common_1.Get)('stores'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], VerticalsController.prototype, "getStores", null);
__decorate([
    (0, common_1.Get)('stores/:storeId/config'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('storeId')),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], VerticalsController.prototype, "getStoreConfig", null);
__decorate([
    (0, common_1.Patch)('stores/:storeId/config'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('storeId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, verticals_dto_js_1.UpdateStoreVerticalConfigDto, String]),
    __metadata("design:returntype", Promise)
], VerticalsController.prototype, "updateStoreConfig", null);
__decorate([
    (0, common_1.Get)('catalog/:productId/category-metadata'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.view'),
    __param(0, (0, common_1.Param)('productId')),
    __param(1, (0, common_1.Query)('storeId')),
    __param(2, (0, common_1.Query)('marketplaceId')),
    __param(3, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], VerticalsController.prototype, "getCategoryMetadata", null);
__decorate([
    (0, common_1.Post)('families'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.update'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        verticals_dto_js_1.CreateFamilyDto, String]),
    __metadata("design:returntype", Promise)
], VerticalsController.prototype, "createFamily", null);
__decorate([
    (0, common_1.Get)('families/:familyId/variants'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('familyId')),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], VerticalsController.prototype, "listVariants", null);
__decorate([
    (0, common_1.Post)('families/:familyId/variants'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.update'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('familyId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, verticals_dto_js_1.CreateVariantDto, String]),
    __metadata("design:returntype", Promise)
], VerticalsController.prototype, "createVariant", null);
__decorate([
    (0, common_1.Post)('variant-mappings'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.publish'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        verticals_dto_js_1.CreateVariantMappingDto, String]),
    __metadata("design:returntype", Promise)
], VerticalsController.prototype, "createVariantMapping", null);
__decorate([
    (0, common_1.Post)('families/:familyId/publish'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.publish'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('familyId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, verticals_dto_js_1.PublishVariantFamilyDto, String]),
    __metadata("design:returntype", Promise)
], VerticalsController.prototype, "publishFamily", null);
exports.VerticalsController = VerticalsController = __decorate([
    (0, common_1.Controller)('verticals'),
    __metadata("design:paramtypes", [verticals_service_js_1.VerticalsService,
        user_organization_service_js_1.UserOrganizationService,
        ebay_variant_publishing_service_js_1.EbayVariantPublishingService])
], VerticalsController);
//# sourceMappingURL=verticals.controller.js.map