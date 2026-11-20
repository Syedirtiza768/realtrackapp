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
exports.BusinessIndustrialEbayController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const current_user_decorator_js_1 = require("../../../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../../../auth/entities/user.entity.js");
const catalog_product_entity_js_1 = require("../../../catalog-import/entities/catalog-product.entity.js");
const require_permissions_decorator_js_1 = require("../../../rbac/decorators/require-permissions.decorator.js");
const ebay_integrations_dto_js_1 = require("../dto/ebay-integrations.dto.js");
const connected_ebay_account_entity_js_1 = require("../entities/connected-ebay-account.entity.js");
const ebay_integration_permissions_service_js_1 = require("../services/ebay-integration-permissions.service.js");
const ebay_integrations_oauth_service_js_1 = require("../services/ebay-integrations-oauth.service.js");
const ebay_multi_store_listing_service_js_1 = require("../services/ebay-multi-store-listing.service.js");
const business_industrial_service_js_1 = require("../../../verticals/business-industrial.service.js");
const verticals_service_js_1 = require("../../../verticals/verticals.service.js");
const ebay_integration_account_service_js_1 = require("../services/ebay-integration-account.service.js");
const ebay_policy_sync_service_js_1 = require("../services/ebay-policy-sync.service.js");
const ebay_taxonomy_api_service_js_1 = require("../../../channels/ebay/ebay-taxonomy-api.service.js");
const ebay_selling_metadata_service_js_1 = require("../../../channels/ebay/ebay-selling-metadata.service.js");
const ebay_listing_channel_entity_js_1 = require("../entities/ebay-listing-channel.entity.js");
let BusinessIndustrialEbayController = class BusinessIndustrialEbayController {
    oauth;
    permissions;
    listings;
    businessIndustrial;
    verticals;
    accountsService;
    policySync;
    taxonomy;
    sellingMetadata;
    productRepo;
    accountRepo;
    channelRepo;
    constructor(oauth, permissions, listings, businessIndustrial, verticals, accountsService, policySync, taxonomy, sellingMetadata, productRepo, accountRepo, channelRepo) {
        this.oauth = oauth;
        this.permissions = permissions;
        this.listings = listings;
        this.businessIndustrial = businessIndustrial;
        this.verticals = verticals;
        this.accountsService = accountsService;
        this.policySync = policySync;
        this.taxonomy = taxonomy;
        this.sellingMetadata = sellingMetadata;
        this.productRepo = productRepo;
        this.accountRepo = accountRepo;
        this.channelRepo = channelRepo;
    }
    async start(dto, user) {
        const { organizationId } = await this.permissions.resolveOrganization(user.id, dto.organizationId);
        await this.businessIndustrial.assertEnabled();
        return this.oauth.startOAuth({
            userId: user.id,
            organizationId,
            internalStoreId: dto.internalStoreId ?? null,
            marketplaceId: dto.marketplaceId,
            environment: dto.environment,
            accountDisplayName: dto.accountDisplayName?.trim() || 'Business & Industrial eBay store',
            vertical: 'business_industrial',
        });
    }
    async accounts(user, organizationId) {
        const org = await this.permissions.resolveOrganization(user.id, organizationId);
        const authorizedStores = await this.businessIndustrial.authorizedStores(user, org.organizationId);
        const accessible = new Set(authorizedStores.map((store) => store.id));
        const accounts = await this.accountRepo.find({
            where: { organizationId: org.organizationId },
            relations: ['primaryStore', 'marketplaces'],
        });
        return accounts
            .filter((account) => {
            if (!account.primaryStore || !accessible.has(account.primaryStoreId))
                return false;
            return account.connectionStatus === 'active';
        })
            .map((account) => ({
            id: account.id,
            accountName: account.accountDisplayName,
            ebayUsername: account.ebayUsername,
            accountDisplayName: account.accountDisplayName,
            primaryStoreId: account.primaryStoreId,
            connectionStatus: account.connectionStatus,
            status: account.connectionStatus,
            environment: account.environment,
            marketplaceId: account.primaryStore.ebayMarketplaceId,
            storeId: account.primaryStoreId,
            storeName: account.primaryStore.storeName,
            locationKey: account.primaryStore.locationKey,
            marketplaces: account.marketplaces
                .filter((marketplace) => marketplace.enabled)
                .map((marketplace) => ({
                marketplaceId: marketplace.marketplaceId,
                defaultPaymentPolicyId: marketplace.defaultPaymentPolicyId,
                defaultReturnPolicyId: marketplace.defaultReturnPolicyId,
                defaultFulfillmentPolicyId: marketplace.defaultFulfillmentPolicyId,
                defaultInventoryLocationKey: marketplace.defaultInventoryLocationKey,
            })),
        }));
    }
    async policies(user, id, organizationId, marketplaceId) {
        const { org, account } = await this.authorizedAccount(user, id, organizationId);
        if (marketplaceId)
            this.marketplace(account, marketplaceId);
        const result = await this.accountsService.getPolicies(id, org.organizationId);
        return {
            policies: result.policies.filter((policy) => !marketplaceId || policy.marketplaceId === marketplaceId),
        };
    }
    async syncPolicies(user, id, organizationId) {
        const { org } = await this.authorizedAccount(user, id, organizationId, 'admin');
        return this.policySync.syncPolicies(id, org.organizationId, user.id);
    }
    async categories(user, id, q, marketplaceId, organizationId) {
        const { account } = await this.authorizedAccount(user, id, organizationId);
        if (!q?.trim() || q.length > 200)
            throw new common_1.BadRequestException('Category search requires 1-200 characters');
        const tree = await this.taxonomy.getDefaultCategoryTreeId(this.marketplace(account, marketplaceId));
        return this.taxonomy.getCategorySuggestions(q.trim(), tree);
    }
    async categoryMetadata(user, id, categoryId, marketplaceId, organizationId) {
        const { account } = await this.authorizedAccount(user, id, organizationId);
        if (!/^\d{1,20}$/.test(categoryId))
            throw new common_1.BadRequestException('Invalid eBay category ID');
        const marketplace = this.marketplace(account, marketplaceId);
        const tree = await this.taxonomy.getDefaultCategoryTreeId(marketplace);
        const [aspects, policies] = await Promise.all([
            this.taxonomy.getItemAspectsForCategory(categoryId, tree),
            this.sellingMetadata.getCategoryPolicies(account.primaryStoreId, marketplace, categoryId),
        ]);
        return { marketplaceId: marketplace, categoryId, aspects, ...policies };
    }
    async validate(dto, user) {
        const organizationId = await this.assertPublishable(dto.catalogProductId, dto.targets, user, dto.organizationId);
        return this.listings.validateTargets({ ...dto, organizationId });
    }
    async publish(dto, user) {
        const organizationId = await this.assertPublishable(dto.catalogProductId, dto.targets, user, dto.organizationId);
        const { job, skipped } = await this.listings.createPublishJob({
            organizationId,
            requestedByUserId: user.id,
            catalogProductId: dto.catalogProductId,
            targets: dto.targets,
            idempotencyKey: dto.idempotencyKey,
        });
        return { jobId: job.id, status: job.status, skippedTargets: skipped };
    }
    async publishBulk(dto, user) {
        const { organizationId } = await this.permissions.resolveOrganization(user.id, dto.organizationId);
        const products = await this.productRepo.find({
            where: {
                organizationId,
                vertical: 'business_industrial',
                id: (0, typeorm_2.In)(dto.listingIds),
            },
            select: ['id', 'verticalValidationStatus', 'manualReview'],
        });
        if (!this.allowUnapprovedPublish() &&
            (products.length !== dto.listingIds.length ||
                products.some((product) => product.verticalValidationStatus !== 'approved' ||
                    product.manualReview))) {
            throw new common_1.BadRequestException('Every Business & Industrial listing must be approved and not quarantined before publishing');
        }
        for (const storeId of dto.storeIds) {
            await this.businessIndustrial.assertBusinessIndustrialStore(user, storeId, organizationId, 'operate');
        }
        const result = await this.listings.createBulkPublishJob({
            organizationId,
            requestedByUserId: user.id,
            listingIds: dto.listingIds,
            storeIds: dto.storeIds,
            policyOverrides: {
                requestedFulfillmentPolicyName: dto.requestedFulfillmentPolicyName,
                requestedPaymentPolicyName: dto.requestedPaymentPolicyName,
                requestedReturnPolicyName: dto.requestedReturnPolicyName,
            },
            idempotencyKey: dto.idempotencyKey,
        });
        return {
            jobId: result.job.id,
            status: result.job.status,
            targetCount: result.targetCount,
            dailyLimit: result.dailyLimit,
            dailyUsed: result.dailyUsed,
            dailyRemaining: Math.max(0, result.dailyLimit - result.dailyUsed),
            skipped: result.skipped,
        };
    }
    async getJob(user, id, organizationId) {
        const { org, targets } = await this.authorizedJob(user, id, organizationId);
        const job = await this.listings.getJob(id, org.organizationId);
        return {
            id: job.id,
            jobId: job.id,
            jobType: job.jobType,
            status: job.status,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            targets,
        };
    }
    async channels(user, catalogProductId, organizationId) {
        const org = await this.permissions.resolveOrganization(user.id, organizationId);
        const rows = await this.channelRepo.find({
            where: {
                organizationId: org.organizationId,
                ...(catalogProductId ? { catalogProductId } : {}),
            },
            relations: ['catalogProduct'],
            order: { updatedAt: 'DESC' },
            take: 200,
        });
        const authorizedStores = await this.businessIndustrial.authorizedStores(user, org.organizationId);
        const accessible = new Set(authorizedStores.map((store) => store.id));
        const items = [];
        for (const row of rows) {
            if (row.catalogProduct?.vertical !== 'business_industrial' ||
                row.catalogProduct.organizationId !== org.organizationId)
                continue;
            const account = await this.accountRepo.findOne({
                where: { id: row.ebayAccountId, organizationId: org.organizationId },
                relations: ['primaryStore'],
            });
            if (!account?.primaryStore || !accessible.has(account.primaryStoreId))
                continue;
            const config = this.verticals.getStoreConfig(account.primaryStore);
            if (config.enabledVerticals.length !== 1 ||
                config.enabledVerticals[0] !== 'business_industrial')
                continue;
            items.push({
                id: row.id,
                catalogProductId: row.catalogProductId,
                ebayAccountId: row.ebayAccountId,
                storeId: account.primaryStoreId,
                storeName: account.primaryStore.storeName,
                marketplaceId: row.marketplaceId,
                offerId: row.offerId,
                listingId: row.listingId,
                listingUrl: row.listingUrl,
                listingStatus: row.listingStatus,
                lastErrorMessage: row.lastErrorMessage,
                updatedAt: row.updatedAt,
            });
        }
        return { items, total: items.length };
    }
    end(user, id, organizationId) {
        return this.businessIndustrial.endListingChannel(user, id, organizationId);
    }
    async assertPublishable(productId, targets, user, organizationId) {
        const org = await this.permissions.resolveOrganization(user.id, organizationId);
        const product = await this.productRepo.findOne({
            where: {
                id: productId,
                organizationId: org.organizationId,
                vertical: 'business_industrial',
            },
        });
        if (!product)
            throw new common_1.BadRequestException('Business & Industrial listing not found in this workspace');
        if (!this.allowUnapprovedPublish() &&
            (product.verticalValidationStatus !== 'approved' || product.manualReview))
            throw new common_1.BadRequestException('Business & Industrial review must be approved and the listing must not be quarantined before publishing');
        if (!targets.length || targets.length > 20)
            throw new common_1.BadRequestException('Choose 1-20 Business & Industrial publishing targets');
        for (const target of targets) {
            const account = await this.accountRepo.findOne({
                where: { id: target.ebayAccountId, organizationId: org.organizationId },
                relations: ['primaryStore', 'marketplaces'],
            });
            if (!account?.primaryStore)
                throw new common_1.BadRequestException('Every eBay target must be a dedicated Business & Industrial seller store');
            await this.businessIndustrial.assertBusinessIndustrialStore(user, account.primaryStore.id, org.organizationId, 'operate');
            this.marketplace(account, target.marketplaceId);
        }
        return org.organizationId;
    }
    allowUnapprovedPublish() {
        return process.env.BUSINESS_INDUSTRIAL_ALLOW_UNAPPROVED_PUBLISH === 'true';
    }
    async authorizedAccount(user, id, organizationId, level = 'view') {
        const org = await this.permissions.resolveOrganization(user.id, organizationId);
        const account = await this.accountRepo.findOne({
            where: { id, organizationId: org.organizationId },
            relations: ['primaryStore', 'marketplaces'],
        });
        if (!account?.primaryStore)
            throw new common_1.NotFoundException('Business & Industrial eBay account not found');
        const config = this.verticals.getStoreConfig(account.primaryStore);
        if (config.enabledVerticals.length !== 1 ||
            config.enabledVerticals[0] !== 'business_industrial')
            throw new common_1.ForbiddenException('Seller store must belong exclusively to the Business & Industrial workspace');
        await this.businessIndustrial.assertBusinessIndustrialStore(user, account.primaryStoreId, org.organizationId, level);
        return { org, account };
    }
    marketplace(account, requested) {
        const marketplace = requested || account.primaryStore.ebayMarketplaceId;
        if (!marketplace ||
            !account.marketplaces.some((item) => item.enabled && item.marketplaceId === marketplace))
            throw new common_1.BadRequestException('Marketplace is not enabled for this Business & Industrial seller account');
        return marketplace;
    }
    async authorizedJob(user, id, organizationId) {
        const org = await this.permissions.resolveOrganization(user.id, organizationId);
        const targets = await this.listings.getJobTargets(id, org.organizationId);
        if (!targets.length)
            throw new common_1.NotFoundException('Business & Industrial job not found');
        for (const target of targets) {
            if (!target.catalogProductId ||
                !target.ebayAccountId ||
                (target.vertical && target.vertical !== 'business_industrial'))
                throw new common_1.NotFoundException('Business & Industrial job not found');
            if (!(await this.productRepo.existsBy({
                id: target.catalogProductId,
                organizationId: org.organizationId,
                vertical: 'business_industrial',
            })))
                throw new common_1.NotFoundException('Business & Industrial job not found');
            await this.authorizedAccount(user, target.ebayAccountId, org.organizationId);
        }
        return { org, targets };
    }
};
exports.BusinessIndustrialEbayController = BusinessIndustrialEbayController;
__decorate([
    (0, common_1.Post)('oauth/start'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.stores.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Start an eBay OAuth connection for Business & Industrial',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_integrations_dto_js_1.EbayOAuthStartDto, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialEbayController.prototype, "start", null);
__decorate([
    (0, common_1.Get)('accounts'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.stores.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialEbayController.prototype, "accounts", null);
__decorate([
    (0, common_1.Get)('accounts/:id/policies'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.stores.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __param(3, (0, common_1.Query)('marketplaceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String, String]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialEbayController.prototype, "policies", null);
__decorate([
    (0, common_1.Post)('accounts/:id/policies/sync'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.stores.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialEbayController.prototype, "syncPolicies", null);
__decorate([
    (0, common_1.Get)('accounts/:id/categories'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('marketplaceId')),
    __param(4, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String, String, String]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialEbayController.prototype, "categories", null);
__decorate([
    (0, common_1.Get)('accounts/:id/categories/:categoryId/metadata'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('categoryId')),
    __param(3, (0, common_1.Query)('marketplaceId')),
    __param(4, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String, String, String]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialEbayController.prototype, "categoryMetadata", null);
__decorate([
    (0, common_1.Post)('listings/validate'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.publish'),
    (0, swagger_1.ApiOperation)({
        summary: 'Validate an approved Business & Industrial listing for eBay targets',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_integrations_dto_js_1.EbayValidateDto, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialEbayController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('listings/publish'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.publish'),
    (0, swagger_1.ApiOperation)({
        summary: 'Enqueue an approved Business & Industrial listing for eBay publish',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_integrations_dto_js_1.EbayPublishJobDto, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialEbayController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)('listings/publish-bulk'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.publish'),
    (0, swagger_1.ApiOperation)({
        summary: 'Enqueue approved Business & Industrial listings for eBay publish',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_integrations_dto_js_1.EbayBulkPublishJobDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialEbayController.prototype, "publishBulk", null);
__decorate([
    (0, common_1.Get)('listing-jobs/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialEbayController.prototype, "getJob", null);
__decorate([
    (0, common_1.Get)('listings'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('catalogProductId', new common_1.ParseUUIDPipe({ optional: true }))),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialEbayController.prototype, "channels", null);
__decorate([
    (0, common_1.Post)('listings/:id/end'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.publish'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialEbayController.prototype, "end", null);
exports.BusinessIndustrialEbayController = BusinessIndustrialEbayController = __decorate([
    (0, swagger_1.ApiTags)('business-industrial-ebay'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('business-industrial/ebay'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access'),
    __param(9, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(10, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(11, (0, typeorm_1.InjectRepository)(ebay_listing_channel_entity_js_1.EbayListingChannel)),
    __metadata("design:paramtypes", [ebay_integrations_oauth_service_js_1.EbayIntegrationsOAuthService,
        ebay_integration_permissions_service_js_1.EbayIntegrationPermissionsService,
        ebay_multi_store_listing_service_js_1.EbayMultiStoreListingService,
        business_industrial_service_js_1.BusinessIndustrialService,
        verticals_service_js_1.VerticalsService,
        ebay_integration_account_service_js_1.EbayIntegrationAccountService,
        ebay_policy_sync_service_js_1.EbayPolicySyncService,
        ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService,
        ebay_selling_metadata_service_js_1.EbaySellingMetadataService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], BusinessIndustrialEbayController);
//# sourceMappingURL=business-industrial-ebay.controller.js.map