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
exports.BusinessIndustrialController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_js_1 = require("../auth/decorators/public.decorator.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const business_industrial_dto_js_1 = require("./business-industrial.dto.js");
const business_industrial_release_dto_js_1 = require("./business-industrial-release.dto.js");
const business_industrial_service_js_1 = require("./business-industrial.service.js");
const business_industrial_users_service_js_1 = require("./business-industrial-users.service.js");
const business_industrial_units_dto_js_1 = require("./business-industrial-units.dto.js");
let BusinessIndustrialController = class BusinessIndustrialController {
    businessIndustrial;
    businessIndustrialUsers;
    constructor(businessIndustrial, businessIndustrialUsers) {
        this.businessIndustrial = businessIndustrial;
        this.businessIndustrialUsers = businessIndustrialUsers;
    }
    webhook(request, signature) {
        return this.businessIndustrial.processEnforcementWebhook(request.rawBody ?? Buffer.alloc(0), signature);
    }
    workspace(user, organizationId) {
        return this.businessIndustrial.workspace(user, organizationId);
    }
    categories() {
        return this.businessIndustrial.categoryFamilies();
    }
    listings(user, organizationId, limit = '50') {
        return this.businessIndustrial.listListings(user, organizationId, Number(limit));
    }
    createListing(user, dto, organizationId) {
        return this.businessIndustrial.createListing(user, dto, organizationId);
    }
    updateListing(user, id, dto, organizationId) {
        return this.businessIndustrial.updateListing(user, id, dto, organizationId);
    }
    reviewQueue(user, organizationId) {
        return this.businessIndustrial.listReviews(user, organizationId);
    }
    privateReview(user, id, organizationId) {
        return this.businessIndustrial.getPrivateReview(user, id, organizationId);
    }
    reviewListing(user, id, dto, organizationId) {
        return this.businessIndustrial.reviewListing(user, id, dto, organizationId);
    }
    quarantine(user, id, body, organizationId) {
        return this.businessIndustrial.quarantine(user, id, organizationId, body?.notes);
    }
    allocateUnit(user, unitId, dto, organizationId) {
        return this.businessIndustrial.allocateUnit(user, unitId, dto, organizationId);
    }
    markUnitSold(user, unitId, dto, organizationId) {
        return this.businessIndustrial.markUnitSold(user, unitId, dto, organizationId);
    }
    incidents(user, organizationId) {
        return this.businessIndustrial.listIncidents(user, organizationId);
    }
    createIncident(user, dto, organizationId) {
        return this.businessIndustrial.createIncident(user, dto, organizationId);
    }
    releaseIncident(user, id, dto, organizationId) {
        return this.businessIndustrial.releaseIncident(user, id, dto.notes, organizationId);
    }
    retryIncidentTakedown(user, id, organizationId) {
        return this.businessIndustrial.retryIncidentTakedown(user, id, organizationId);
    }
    async stores(user, organizationId) {
        const org = await this.businessIndustrial.resolveOrganization(user, organizationId);
        return (await this.businessIndustrial.authorizedStores(user, org.organizationId)).map((store) => ({
            id: store.id,
            storeName: store.storeName,
            status: store.status,
            marketplaceId: store.ebayMarketplaceId,
            vertical: 'business_industrial',
        }));
    }
    users(user, organizationId) {
        return this.businessIndustrialUsers.list(user, organizationId);
    }
    createUser(user, dto, organizationId) {
        return this.businessIndustrialUsers.create(user, dto, organizationId);
    }
    updateUserRole(user, userId, dto, organizationId) {
        return this.businessIndustrialUsers.updateRole(user, userId, dto, organizationId);
    }
    deactivateUser(user, userId, organizationId) {
        return this.businessIndustrialUsers.deactivate(user, userId, organizationId);
    }
    setStoreAccess(user, userId, dto, organizationId) {
        return this.businessIndustrialUsers.setStores(user, userId, dto, organizationId);
    }
};
exports.BusinessIndustrialController = BusinessIndustrialController;
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Post)('webhooks/ebay-enforcement'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('x-ebay-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "webhook", null);
__decorate([
    (0, common_1.Get)('workspace'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.dashboard.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "workspace", null);
__decorate([
    (0, common_1.Get)('categories'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.listings.view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "categories", null);
__decorate([
    (0, common_1.Get)('listings'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, Object]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "listings", null);
__decorate([
    (0, common_1.Post)('listings'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.listings.create'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        business_industrial_dto_js_1.CreateBusinessIndustrialDraftDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "createListing", null);
__decorate([
    (0, common_1.Patch)('listings/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.listings.update'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, business_industrial_dto_js_1.UpdateBusinessIndustrialDraftDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "updateListing", null);
__decorate([
    (0, common_1.Get)('review'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.review'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "reviewQueue", null);
__decorate([
    (0, common_1.Get)('listings/:id/review'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.review.private'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "privateReview", null);
__decorate([
    (0, common_1.Post)('listings/:id/review'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.review'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, business_industrial_dto_js_1.BusinessIndustrialReviewDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "reviewListing", null);
__decorate([
    (0, common_1.Post)('listings/:id/quarantine'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.incidents.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, business_industrial_dto_js_1.BusinessIndustrialQuarantineDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "quarantine", null);
__decorate([
    (0, common_1.Post)('units/:unitId/allocate'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.listings.update'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('unitId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, business_industrial_units_dto_js_1.BusinessIndustrialUnitAllocationDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "allocateUnit", null);
__decorate([
    (0, common_1.Post)('units/:unitId/sold'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.listings.update'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('unitId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, business_industrial_units_dto_js_1.BusinessIndustrialUnitSoldDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "markUnitSold", null);
__decorate([
    (0, common_1.Get)('incidents'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.incidents.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "incidents", null);
__decorate([
    (0, common_1.Post)('incidents'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.incidents.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        business_industrial_dto_js_1.BusinessIndustrialIncidentDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "createIncident", null);
__decorate([
    (0, common_1.Post)('incidents/:id/release'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.incidents.release'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, business_industrial_release_dto_js_1.BusinessIndustrialReleaseIncidentDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "releaseIncident", null);
__decorate([
    (0, common_1.Post)('incidents/:id/takedown'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.incidents.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "retryIncidentTakedown", null);
__decorate([
    (0, common_1.Get)('stores'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.stores.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialController.prototype, "stores", null);
__decorate([
    (0, common_1.Get)('users'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.users.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "users", null);
__decorate([
    (0, common_1.Post)('users'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.users.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        business_industrial_dto_js_1.BusinessIndustrialUserCreateDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "createUser", null);
__decorate([
    (0, common_1.Patch)('users/:userId/role'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.roles.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, business_industrial_dto_js_1.BusinessIndustrialRoleDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "updateUserRole", null);
__decorate([
    (0, common_1.Patch)('users/:userId/deactivate'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.users.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "deactivateUser", null);
__decorate([
    (0, common_1.Patch)('users/:userId/stores'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.users.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, business_industrial_dto_js_1.BusinessIndustrialStoreAssignmentsDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialController.prototype, "setStoreAccess", null);
exports.BusinessIndustrialController = BusinessIndustrialController = __decorate([
    (0, common_1.Controller)('business-industrial'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access'),
    __metadata("design:paramtypes", [business_industrial_service_js_1.BusinessIndustrialService,
        business_industrial_users_service_js_1.BusinessIndustrialUsersService])
], BusinessIndustrialController);
//# sourceMappingURL=business-industrial.controller.js.map