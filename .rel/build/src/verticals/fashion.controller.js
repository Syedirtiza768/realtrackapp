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
exports.FashionController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const store_access_service_js_1 = require("../channels/store-access.service.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const fashion_review_entity_js_1 = require("./entities/fashion-review.entity.js");
const fashion_dto_js_1 = require("./fashion.dto.js");
const verticals_service_js_1 = require("./verticals.service.js");
const upload_limits_js_1 = require("../storage/upload-limits.js");
const fashion_listings_service_js_1 = require("./fashion-listings.service.js");
const fashion_users_service_js_1 = require("./fashion-users.service.js");
const fashion_image_analysis_service_js_1 = require("./fashion-image-analysis.service.js");
let FashionController = class FashionController {
    verticals;
    userOrganizations;
    storeAccess;
    productRepo;
    reviewRepo;
    fashionListings;
    fashionUsers;
    fashionImages;
    constructor(verticals, userOrganizations, storeAccess, productRepo, reviewRepo, fashionListings, fashionUsers, fashionImages) {
        this.verticals = verticals;
        this.userOrganizations = userOrganizations;
        this.storeAccess = storeAccess;
        this.productRepo = productRepo;
        this.reviewRepo = reviewRepo;
        this.fashionListings = fashionListings;
        this.fashionUsers = fashionUsers;
        this.fashionImages = fashionImages;
    }
    async workspace(user, organizationId) {
        const org = await this.userOrganizations.resolveOrganizationId(user.id, organizationId);
        const stores = await this.authorizedFashionStores(user, org.organizationId);
        const [listingCount, reviewCount] = await Promise.all([
            this.productRepo.count({
                where: { organizationId: org.organizationId, vertical: 'fashion' },
            }),
            this.reviewRepo.count({
                where: { organizationId: org.organizationId, status: 'pending' },
            }),
        ]);
        return {
            organizationId: org.organizationId,
            organizationRole: org.member.role,
            stores: stores.map((store) => this.storeSummary(store)),
            metrics: { listingCount, pendingReviewCount: reviewCount },
        };
    }
    users(user, organizationId) {
        return this.fashionUsers.list(user, organizationId);
    }
    createUser(user, dto, organizationId) {
        return this.fashionUsers.create(user, dto, organizationId);
    }
    updateUserRole(user, id, dto, organizationId) {
        return this.fashionUsers.updateRole(user, id, dto, organizationId);
    }
    deactivateUser(user, id, organizationId) {
        return this.fashionUsers.deactivate(user, id, organizationId);
    }
    setUserStores(user, id, dto, organizationId) {
        return this.fashionUsers.setStores(user, id, dto, organizationId);
    }
    async stores(user, organizationId) {
        const org = await this.userOrganizations.resolveOrganizationId(user.id, organizationId);
        return (await this.authorizedFashionStores(user, org.organizationId)).map((store) => this.storeSummary(store));
    }
    async updateStore(user, id, dto, organizationId) {
        const org = await this.userOrganizations.resolveOrganizationId(user.id, organizationId);
        await this.storeAccess.assertStoreAccess(user, id, 'admin');
        const store = (await this.authorizedFashionStores(user, org.organizationId)).find((entry) => entry.id === id);
        if (!store)
            throw new common_1.NotFoundException('Fashion store not found');
        if (!dto.enabled)
            throw new common_1.ConflictException('Dedicated Fashion stores cannot be converted to another vertical');
        return this.verticals.getStoreConfig(store);
    }
    async listings(user, organizationId, limit = '50') {
        const org = await this.userOrganizations.resolveOrganizationId(user.id, organizationId);
        const products = await this.productRepo.find({
            where: { organizationId: org.organizationId, vertical: 'fashion' },
            order: { updatedAt: 'DESC' },
            take: Math.min(Math.max(Number(limit) || 50, 1), 200),
        });
        return products.map((product) => this.fashionListings.publicProduct(product));
    }
    listing(user, id, organizationId) {
        return this.fashionListings.detail(user, id, organizationId);
    }
    uploadPhotos(user, files, organizationId, sku) {
        return this.fashionImages.uploadPhotos(user, files, organizationId, sku);
    }
    analyzeImages(user, dto, organizationId) {
        return this.fashionImages.analyze(user, dto, organizationId);
    }
    generateContent(dto) {
        return this.fashionImages.generateListing(dto);
    }
    createListing(user, dto, organizationId) {
        return this.fashionListings.create(user, dto, organizationId);
    }
    updateListing(user, id, dto, organizationId) {
        return this.fashionListings.update(user, id, dto, organizationId);
    }
    reviewListing(user, id, dto, organizationId) {
        return this.fashionListings.review(user, id, dto, organizationId);
    }
    getReview(user, id, organizationId) {
        return this.fashionListings.getReview(user, id, organizationId);
    }
    incidents(user, organizationId) {
        return this.fashionListings.incidents(user, organizationId);
    }
    quarantine(user, id, organizationId) {
        return this.fashionListings.quarantine(user, id, organizationId);
    }
    async authorizedFashionStores(user, organizationId) {
        const accessible = await this.storeAccess.getAccessibleStoreIds(user);
        const stores = await this.verticals.listStoresForOrganization(organizationId);
        return stores.filter((store) => accessible.has(store.id) &&
            store.verticalConfig.enabledVerticals.length === 1 &&
            store.verticalConfig.enabledVerticals[0] === 'fashion');
    }
    storeSummary(store) {
        return {
            id: store.id,
            storeName: store.storeName,
            channel: store.channel,
            status: store.status,
            marketplaceId: store.ebayMarketplaceId,
            fashionEnabled: true,
            verticalConfig: this.verticals.getStoreConfig(store),
        };
    }
};
exports.FashionController = FashionController;
__decorate([
    (0, common_1.Get)('workspace'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.dashboard.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], FashionController.prototype, "workspace", null);
__decorate([
    (0, common_1.Get)('users'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.users.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "users", null);
__decorate([
    (0, common_1.Post)('users'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.users.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        fashion_dto_js_1.FashionUserCreateDto, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "createUser", null);
__decorate([
    (0, common_1.Patch)('users/:userId/role'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.roles.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, fashion_dto_js_1.FashionRoleDto, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "updateUserRole", null);
__decorate([
    (0, common_1.Patch)('users/:userId/deactivate'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.users.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "deactivateUser", null);
__decorate([
    (0, common_1.Patch)('users/:userId/stores'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.users.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, fashion_dto_js_1.FashionStoreAccessDto, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "setUserStores", null);
__decorate([
    (0, common_1.Get)('stores'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.stores.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], FashionController.prototype, "stores", null);
__decorate([
    (0, common_1.Patch)('stores/:storeId/config'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.settings.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('storeId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, fashion_dto_js_1.FashionStoreConfigDto, String]),
    __metadata("design:returntype", Promise)
], FashionController.prototype, "updateStore", null);
__decorate([
    (0, common_1.Get)('listings'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, Object]),
    __metadata("design:returntype", Promise)
], FashionController.prototype, "listings", null);
__decorate([
    (0, common_1.Get)('listings/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "listing", null);
__decorate([
    (0, common_1.Post)('listings/photos'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.create'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 24, upload_limits_js_1.IMAGE_UPLOAD_MULTER_OPTIONS)),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __param(3, (0, common_1.Query)('sku')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, Array, String, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "uploadPhotos", null);
__decorate([
    (0, common_1.Post)('listings/analyze-images'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.create'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        fashion_dto_js_1.AnalyzeFashionImagesDto, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "analyzeImages", null);
__decorate([
    (0, common_1.Post)('listings/generate-content'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fashion_dto_js_1.GenerateFashionListingDto]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "generateContent", null);
__decorate([
    (0, common_1.Post)('listings'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.create'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        fashion_dto_js_1.CreateFashionDraftDto, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "createListing", null);
__decorate([
    (0, common_1.Patch)('listings/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.update'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, fashion_dto_js_1.UpdateFashionDraftDto, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "updateListing", null);
__decorate([
    (0, common_1.Post)('listings/:id/review'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.review', 'fashion.authenticity.review'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, fashion_dto_js_1.FashionReviewDto, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "reviewListing", null);
__decorate([
    (0, common_1.Get)('listings/:id/review'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.authenticity.review'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "getReview", null);
__decorate([
    (0, common_1.Get)('incidents'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.incidents.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "incidents", null);
__decorate([
    (0, common_1.Post)('listings/:id/quarantine'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.incidents.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], FashionController.prototype, "quarantine", null);
exports.FashionController = FashionController = __decorate([
    (0, common_1.Controller)('fashion'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access'),
    __param(3, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(4, (0, typeorm_1.InjectRepository)(fashion_review_entity_js_1.FashionReview)),
    __metadata("design:paramtypes", [verticals_service_js_1.VerticalsService,
        user_organization_service_js_1.UserOrganizationService,
        store_access_service_js_1.StoreAccessService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        fashion_listings_service_js_1.FashionListingsService,
        fashion_users_service_js_1.FashionUsersService,
        fashion_image_analysis_service_js_1.FashionImageAnalysisService])
], FashionController);
//# sourceMappingURL=fashion.controller.js.map