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
exports.StorePublishedListingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const store_access_service_js_1 = require("../channels/store-access.service.js");
const ebay_integration_permissions_service_js_1 = require("../integrations/ebay/services/ebay-integration-permissions.service.js");
const published_listings_service_js_1 = require("./services/published-listings.service.js");
const published_listings_dto_js_1 = require("./dto/published-listings.dto.js");
let StorePublishedListingsController = class StorePublishedListingsController {
    listings;
    storeAccess;
    permissions;
    constructor(listings, storeAccess, permissions) {
        this.listings = listings;
        this.storeAccess = storeAccess;
        this.permissions = permissions;
    }
    async listForStore(storeId, query, user) {
        const { organizationId } = await this.permissions.resolveOrganization(user.id, query.organizationId);
        await this.storeAccess.assertStoreAccess(user, storeId, 'view');
        return this.listings.list(organizationId, user, { ...query, storeId });
    }
    async getForStore(storeId, id, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        await this.storeAccess.assertStoreAccess(user, storeId, 'view');
        const listing = await this.listings.getById(id, orgId, user);
        if (listing.storeId !== storeId) {
            throw new common_1.NotFoundException('Published listing not found on this store');
        }
        return listing;
    }
};
exports.StorePublishedListingsController = StorePublishedListingsController;
__decorate([
    (0, common_1.Get)(':storeId/listings/published'),
    (0, swagger_1.ApiOperation)({
        summary: 'Complete published listing data for everything live on this store',
    }),
    __param(0, (0, common_1.Param)('storeId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, published_listings_dto_js_1.PublishedListingsQueryDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], StorePublishedListingsController.prototype, "listForStore", null);
__decorate([
    (0, common_1.Get)(':storeId/listings/published/:id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Complete published listing data for one item on this store',
    }),
    __param(0, (0, common_1.Param)('storeId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __param(3, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], StorePublishedListingsController.prototype, "getForStore", null);
exports.StorePublishedListingsController = StorePublishedListingsController = __decorate([
    (0, swagger_1.ApiTags)('published-listings'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('stores'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.view'),
    __metadata("design:paramtypes", [published_listings_service_js_1.PublishedListingsService,
        store_access_service_js_1.StoreAccessService,
        ebay_integration_permissions_service_js_1.EbayIntegrationPermissionsService])
], StorePublishedListingsController);
//# sourceMappingURL=store-published-listings.controller.js.map