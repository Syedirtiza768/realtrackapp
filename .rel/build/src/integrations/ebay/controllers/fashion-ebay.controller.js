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
exports.FashionEbayController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const catalog_product_entity_js_1 = require("../../../catalog-import/entities/catalog-product.entity.js");
const connected_ebay_account_entity_js_1 = require("../entities/connected-ebay-account.entity.js");
const ebay_listing_channel_entity_js_1 = require("../entities/ebay-listing-channel.entity.js");
const verticals_service_js_1 = require("../../../verticals/verticals.service.js");
const fashion_listings_service_js_1 = require("../../../verticals/fashion-listings.service.js");
const store_access_service_js_1 = require("../../../channels/store-access.service.js");
const ebay_taxonomy_api_service_js_1 = require("../../../channels/ebay/ebay-taxonomy-api.service.js");
const ebay_selling_metadata_service_js_1 = require("../../../channels/ebay/ebay-selling-metadata.service.js");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_js_1 = require("../../../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../../../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("../../../rbac/decorators/require-permissions.decorator.js");
const ebay_integrations_dto_js_1 = require("../dto/ebay-integrations.dto.js");
const ebay_integration_permissions_service_js_1 = require("../services/ebay-integration-permissions.service.js");
const ebay_integrations_oauth_service_js_1 = require("../services/ebay-integrations-oauth.service.js");
const ebay_multi_store_listing_service_js_1 = require("../services/ebay-multi-store-listing.service.js");
const ebay_integration_account_service_js_1 = require("../services/ebay-integration-account.service.js");
const ebay_policy_sync_service_js_1 = require("../services/ebay-policy-sync.service.js");
let FashionEbayController = class FashionEbayController {
    oauth;
    permissions;
    listings;
    verticals;
    productRepo;
    accountRepo;
    fashion;
    storeAccess;
    accountsService;
    policySync;
    taxonomy;
    sellingMetadata;
    channelRepo;
    constructor(oauth, permissions, listings, verticals, productRepo, accountRepo, fashion, storeAccess, accountsService, policySync, taxonomy, sellingMetadata, channelRepo) {
        this.oauth = oauth;
        this.permissions = permissions;
        this.listings = listings;
        this.verticals = verticals;
        this.productRepo = productRepo;
        this.accountRepo = accountRepo;
        this.fashion = fashion;
        this.storeAccess = storeAccess;
        this.accountsService = accountsService;
        this.policySync = policySync;
        this.taxonomy = taxonomy;
        this.sellingMetadata = sellingMetadata;
        this.channelRepo = channelRepo;
    }
    async start(dto, user) {
        const { organizationId } = await this.permissions.resolveOrganization(user.id, dto.organizationId);
        await this.verticals.assertFeatureEnabled();
        if (dto.internalStoreId)
            throw new common_1.BadRequestException('Fashion connections must create a dedicated seller store');
        return this.oauth.startOAuth({
            userId: user.id,
            organizationId,
            internalStoreId: null,
            marketplaceId: dto.marketplaceId,
            environment: dto.environment,
            accountDisplayName: dto.accountDisplayName?.trim() || 'Fashion eBay store',
            vertical: 'fashion',
        });
    }
    async accounts(user, organizationId) {
        const org = await this.permissions.resolveOrganization(user.id, organizationId);
        const accessible = await this.storeAccess.getAccessibleStoreIds(user);
        const accounts = await this.accountRepo.find({
            where: { organizationId: org.organizationId },
            relations: ['primaryStore', 'marketplaces'],
        });
        return accounts
            .filter((account) => {
            if (!account.primaryStore || !accessible.has(account.primaryStoreId))
                return false;
            const config = this.verticals.getStoreConfig(account.primaryStore);
            return (config.enabledVerticals.length === 1 &&
                config.enabledVerticals[0] === 'fashion');
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
            marketplaces: account.marketplaces
                .filter((mp) => mp.enabled)
                .map((mp) => ({
                marketplaceId: mp.marketplaceId,
                defaultPaymentPolicyId: mp.defaultPaymentPolicyId,
                defaultReturnPolicyId: mp.defaultReturnPolicyId,
                defaultFulfillmentPolicyId: mp.defaultFulfillmentPolicyId,
                defaultInventoryLocationKey: mp.defaultInventoryLocationKey,
            })),
        }));
    }
    async reconnect(user, id, organizationId) {
        const { org, account } = await this.authorizedAccount(user, id, organizationId, 'admin');
        await this.verticals.assertFeatureEnabled();
        if (account.connectionSource === 'sellerpundit')
            throw new common_1.BadRequestException('SellerPundit connections are re-authorized through SellerPundit');
        return this.oauth.startOAuth({
            userId: user.id,
            organizationId: org.organizationId,
            internalStoreId: null,
            marketplaceId: account.primaryStore.ebayMarketplaceId || 'EBAY_US',
            environment: account.environment,
            accountDisplayName: account.accountDisplayName,
            vertical: 'fashion',
            reconnectAccountId: account.id,
        });
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
        const marketplace = this.marketplace(account, marketplaceId);
        const tree = await this.taxonomy.getDefaultCategoryTreeId(marketplace);
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
        const organizationId = await this.assertPublishable(dto, user);
        return this.listings.validateTargets({ ...dto, organizationId });
    }
    async publish(dto, user) {
        const organizationId = await this.assertPublishable(dto, user);
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
        const org = await this.permissions.resolveOrganization(user.id, dto.organizationId);
        await this.verticals.assertFeatureEnabled();
        const listingIds = [...new Set(dto.listingIds)];
        const storeIds = [...new Set(dto.storeIds)];
        const products = await this.productRepo.find({
            where: {
                id: (0, typeorm_2.In)(listingIds),
                organizationId: org.organizationId,
                vertical: 'fashion',
            },
            select: ['id'],
        });
        if (products.length !== listingIds.length)
            throw new common_1.BadRequestException('One or more selected Fashion catalog products were not found');
        for (const product of products)
            await this.fashion.assertApproved(product.id, org.organizationId);
        const accessible = await this.storeAccess.getAccessibleStoreIds(user);
        const accounts = await this.accountRepo.find({
            where: {
                organizationId: org.organizationId,
                primaryStoreId: (0, typeorm_2.In)(storeIds),
                connectionStatus: 'active',
            },
            relations: ['primaryStore'],
        });
        const accountByStore = new Map(accounts.map((account) => [account.primaryStoreId, account]));
        for (const storeId of storeIds) {
            const account = accountByStore.get(storeId);
            if (!account?.primaryStore)
                throw new common_1.BadRequestException('One or more selected stores are not active Fashion eBay stores');
            if (!accessible.has(storeId))
                throw new common_1.ForbiddenException('You do not have access to one or more selected Fashion stores');
            await this.storeAccess.assertStoreAccess(user, storeId, 'operate');
            const config = this.verticals.getStoreConfig(account.primaryStore);
            if (config.enabledVerticals.length !== 1 ||
                config.enabledVerticals[0] !== 'fashion')
                throw new common_1.BadRequestException('Fashion publishing requires dedicated Fashion stores');
        }
        let policyOverridesByStore;
        if (dto.storePolicies) {
            const policyRows = new Map(dto.storePolicies.map((row) => [row.storeId, row]));
            if (policyRows.size !== dto.storePolicies.length ||
                policyRows.size !== storeIds.length ||
                storeIds.some((storeId) => !policyRows.has(storeId)))
                throw new common_1.BadRequestException('Choose policy values for each selected Fashion store exactly once.');
            policyOverridesByStore = Object.fromEntries([...policyRows.entries()].map(([storeId, row]) => [storeId, {
                    requestedFulfillmentPolicyName: row.requestedFulfillmentPolicyName,
                    requestedPaymentPolicyName: row.requestedPaymentPolicyName,
                    requestedReturnPolicyName: row.requestedReturnPolicyName,
                }]));
        }
        const result = await this.listings.createBulkPublishJob({
            organizationId: org.organizationId,
            requestedByUserId: user.id,
            listingIds,
            storeIds,
            policyOverridesByStore,
            marketplaceByStore: Object.fromEntries((dto.storePolicies ?? []).flatMap(({ storeId, marketplaceId }) => marketplaceId ? [[storeId, marketplaceId]] : [])),
            idempotencyKey: dto.idempotencyKey,
        });
        return {
            jobId: result.job.id,
            status: result.job.status,
            targetCount: result.targetCount,
            dailyLimit: result.dailyLimit,
            dailyUsed: result.dailyUsed,
            skippedTargets: result.skipped,
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
    async getJobTargets(user, id, organizationId) {
        return (await this.authorizedJob(user, id, organizationId)).targets;
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
        const accessible = await this.storeAccess.getAccessibleStoreIds(user);
        const items = [];
        for (const row of rows) {
            if (row.catalogProduct?.vertical !== 'fashion' ||
                row.catalogProduct.organizationId !== org.organizationId)
                continue;
            try {
                const account = await this.fashion.account(row.ebayAccountId, org.organizationId);
                if (!accessible.has(account.primaryStoreId))
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
            catch (error) {
                if (!(error instanceof common_1.ForbiddenException ||
                    error instanceof common_1.NotFoundException))
                    throw error;
            }
        }
        return { items, total: items.length };
    }
    end(user, id, organizationId) {
        return this.fashion.end(user, id, organizationId);
    }
    async authorizedAccount(user, id, organizationId, level = 'view') {
        const org = await this.permissions.resolveOrganization(user.id, organizationId);
        const account = await this.fashion.account(id, org.organizationId);
        await this.storeAccess.assertStoreAccess(user, account.primaryStoreId, level);
        return { org, account };
    }
    marketplace(account, requested) {
        const marketplace = requested || account.primaryStore.ebayMarketplaceId;
        if (!marketplace ||
            !account.marketplaces.some((mp) => mp.enabled && mp.marketplaceId === marketplace))
            throw new common_1.BadRequestException('Marketplace is not enabled for this Fashion seller account');
        return marketplace;
    }
    async assertPublishable(dto, user) {
        const org = await this.permissions.resolveOrganization(user.id, dto.organizationId);
        await this.verticals.assertFeatureEnabled();
        await this.fashion.assertApproved(dto.catalogProductId, org.organizationId);
        if (!dto.targets.length || dto.targets.length > 20)
            throw new common_1.BadRequestException('Choose 1-20 Fashion publishing targets');
        for (const target of dto.targets) {
            const { account } = await this.authorizedAccount(user, target.ebayAccountId, org.organizationId, 'operate');
            this.marketplace(account, target.marketplaceId);
        }
        return org.organizationId;
    }
    async authorizedJob(user, id, organizationId) {
        const org = await this.permissions.resolveOrganization(user.id, organizationId);
        const targets = await this.listings.getJobTargets(id, org.organizationId);
        if (!targets.length)
            throw new common_1.NotFoundException('Fashion job not found');
        for (const target of targets) {
            if (!target.catalogProductId ||
                !target.ebayAccountId ||
                (target.vertical && target.vertical !== 'fashion'))
                throw new common_1.NotFoundException('Fashion job not found');
            if (!(await this.productRepo.existsBy({
                id: target.catalogProductId,
                organizationId: org.organizationId,
                vertical: 'fashion',
            })))
                throw new common_1.NotFoundException('Fashion job not found');
            await this.authorizedAccount(user, target.ebayAccountId, org.organizationId);
        }
        return { org, targets };
    }
};
exports.FashionEbayController = FashionEbayController;
__decorate([
    (0, common_1.Post)('oauth/start'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.stores.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_integrations_dto_js_1.EbayOAuthStartDto, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], FashionEbayController.prototype, "start", null);
__decorate([
    (0, common_1.Get)('accounts'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.stores.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], FashionEbayController.prototype, "accounts", null);
__decorate([
    (0, common_1.Post)('accounts/:id/reconnect'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.stores.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], FashionEbayController.prototype, "reconnect", null);
__decorate([
    (0, common_1.Get)('accounts/:id/policies'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.stores.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __param(3, (0, common_1.Query)('marketplaceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String, String]),
    __metadata("design:returntype", Promise)
], FashionEbayController.prototype, "policies", null);
__decorate([
    (0, common_1.Post)('accounts/:id/policies/sync'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.stores.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], FashionEbayController.prototype, "syncPolicies", null);
__decorate([
    (0, common_1.Get)('accounts/:id/categories'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('marketplaceId')),
    __param(4, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String, String, String]),
    __metadata("design:returntype", Promise)
], FashionEbayController.prototype, "categories", null);
__decorate([
    (0, common_1.Get)('accounts/:id/categories/:categoryId/metadata'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('categoryId')),
    __param(3, (0, common_1.Query)('marketplaceId')),
    __param(4, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String, String, String]),
    __metadata("design:returntype", Promise)
], FashionEbayController.prototype, "categoryMetadata", null);
__decorate([
    (0, common_1.Post)('listings/validate'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.publish'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_integrations_dto_js_1.EbayValidateDto, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], FashionEbayController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('listings/publish'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.publish'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_integrations_dto_js_1.EbayPublishJobDto, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], FashionEbayController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)('listings/publish-bulk'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.publish'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_integrations_dto_js_1.EbayBulkPublishJobDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], FashionEbayController.prototype, "publishBulk", null);
__decorate([
    (0, common_1.Get)('listing-jobs/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], FashionEbayController.prototype, "getJob", null);
__decorate([
    (0, common_1.Get)('listing-jobs/:id/targets'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], FashionEbayController.prototype, "getJobTargets", null);
__decorate([
    (0, common_1.Get)('listings'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('catalogProductId', new common_1.ParseUUIDPipe({ optional: true }))),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], FashionEbayController.prototype, "channels", null);
__decorate([
    (0, common_1.Post)('listings/:id/end'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.publish'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], FashionEbayController.prototype, "end", null);
exports.FashionEbayController = FashionEbayController = __decorate([
    (0, swagger_1.ApiTags)('fashion-ebay'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('fashion/ebay'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access'),
    __param(4, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(5, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(12, (0, typeorm_1.InjectRepository)(ebay_listing_channel_entity_js_1.EbayListingChannel)),
    __metadata("design:paramtypes", [ebay_integrations_oauth_service_js_1.EbayIntegrationsOAuthService,
        ebay_integration_permissions_service_js_1.EbayIntegrationPermissionsService,
        ebay_multi_store_listing_service_js_1.EbayMultiStoreListingService,
        verticals_service_js_1.VerticalsService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        fashion_listings_service_js_1.FashionListingsService,
        store_access_service_js_1.StoreAccessService,
        ebay_integration_account_service_js_1.EbayIntegrationAccountService,
        ebay_policy_sync_service_js_1.EbayPolicySyncService,
        ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService,
        ebay_selling_metadata_service_js_1.EbaySellingMetadataService,
        typeorm_2.Repository])
], FashionEbayController);
//# sourceMappingURL=fashion-ebay.controller.js.map