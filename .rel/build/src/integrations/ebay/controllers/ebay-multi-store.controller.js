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
exports.EbayMultiStoreController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const current_user_decorator_js_1 = require("../../../auth/decorators/current-user.decorator.js");
const require_permissions_decorator_js_1 = require("../../../rbac/decorators/require-permissions.decorator.js");
const user_entity_js_1 = require("../../../auth/entities/user.entity.js");
const ebay_integrations_dto_js_1 = require("../dto/ebay-integrations.dto.js");
const ebay_multi_store_listing_service_js_1 = require("../services/ebay-multi-store-listing.service.js");
const ebay_integration_permissions_service_js_1 = require("../services/ebay-integration-permissions.service.js");
const ebay_listing_channel_entity_js_1 = require("../entities/ebay-listing-channel.entity.js");
const ebay_api_error_entity_js_1 = require("../entities/ebay-api-error.entity.js");
const listing_action_log_entity_js_1 = require("../entities/listing-action-log.entity.js");
const ebay_integrations_dto_js_2 = require("../dto/ebay-integrations.dto.js");
const throttler_1 = require("@nestjs/throttler");
let EbayMultiStoreController = class EbayMultiStoreController {
    listings;
    permissions;
    channelRepo;
    errorRepo;
    logRepo;
    constructor(listings, permissions, channelRepo, errorRepo, logRepo) {
        this.listings = listings;
        this.permissions = permissions;
        this.channelRepo = channelRepo;
        this.errorRepo = errorRepo;
        this.logRepo = logRepo;
    }
    async validate(dto, user) {
        const { organizationId } = await this.permissions.resolveOrganization(user.id, dto.organizationId);
        return this.listings.validateTargets({ ...dto, organizationId });
    }
    async publish(dto, user) {
        const { organizationId, member } = await this.permissions.resolveOrganization(user.id, dto.organizationId);
        this.permissions.assertCanPublish(member.role);
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
        const { organizationId, member } = await this.permissions.resolveOrganization(user.id, dto.organizationId);
        this.permissions.assertCanPublish(member.role);
        const result = await this.listings.createBulkPublishJob({
            organizationId,
            requestedByUserId: user.id,
            listingIds: dto.listingIds,
            storeIds: dto.storeIds,
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
    async getJob(id, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.listings.getJob(id, orgId);
    }
    async getJobTargets(id, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.listings.getJobTargets(id, orgId);
    }
    async listChannels(organizationId, user, ebayAccountId, marketplaceId, status, limit = '50') {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        const qb = this.channelRepo
            .createQueryBuilder('c')
            .where('c.organizationId = :organizationId', { organizationId: orgId })
            .orderBy('c.updatedAt', 'DESC')
            .take(Math.min(Number(limit) || 50, 200));
        if (ebayAccountId) {
            qb.andWhere('c.ebayAccountId = :ebayAccountId', { ebayAccountId });
        }
        if (marketplaceId) {
            qb.andWhere('c.marketplaceId = :marketplaceId', { marketplaceId });
        }
        if (status) {
            qb.andWhere('c.listingStatus = :status', { status });
        }
        const [items, total] = await qb.getManyAndCount();
        return { total, items };
    }
    async listErrors(organizationId, user, limit = '50') {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        const items = await this.errorRepo.find({
            where: { organizationId: orgId },
            order: { createdAt: 'DESC' },
            take: Math.min(Number(limit) || 50, 200),
        });
        return { items };
    }
    async activity(organizationId, user, limit = '100') {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        const items = await this.logRepo.find({
            where: { organizationId: orgId },
            order: { createdAt: 'DESC' },
            take: Math.min(Number(limit) || 100, 500),
        });
        return { items };
    }
};
exports.EbayMultiStoreController = EbayMultiStoreController;
__decorate([
    (0, common_1.Post)('listings/validate'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.publish'),
    (0, swagger_1.ApiOperation)({
        summary: 'Validate catalog product for one or more eBay targets',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_integrations_dto_js_1.EbayValidateDto, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], EbayMultiStoreController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('listings/publish'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.publish'),
    (0, swagger_1.ApiOperation)({
        summary: 'Enqueue multi-store publish job (one worker per target)',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_integrations_dto_js_1.EbayPublishJobDto, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], EbayMultiStoreController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)('listings/publish-bulk'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.publish'),
    (0, swagger_1.ApiOperation)({
        summary: 'Enqueue up to 500 listings as one durable multi-store publish job',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_integrations_dto_js_2.EbayBulkPublishJobDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], EbayMultiStoreController.prototype, "publishBulk", null);
__decorate([
    (0, common_1.Get)('listing-jobs/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get listing job status' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], EbayMultiStoreController.prototype, "getJob", null);
__decorate([
    (0, common_1.Get)('listing-jobs/:id/targets'),
    (0, throttler_1.Throttle)({
        short: { limit: 20, ttl: 1_000 },
        medium: { limit: 500, ttl: 60_000 },
        long: { limit: 5_000, ttl: 3_600_000 },
    }),
    (0, swagger_1.ApiOperation)({ summary: 'List per-store targets for a job' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], EbayMultiStoreController.prototype, "getJobTargets", null);
__decorate([
    (0, common_1.Get)('listings'),
    (0, swagger_1.ApiOperation)({ summary: 'List eBay listing channels' }),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('ebayAccountId')),
    __param(3, (0, common_1.Query)('marketplaceId')),
    __param(4, (0, common_1.Query)('status')),
    __param(5, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], EbayMultiStoreController.prototype, "listChannels", null);
__decorate([
    (0, common_1.Get)('errors'),
    (0, swagger_1.ApiOperation)({ summary: 'List recent eBay API errors' }),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User, Object]),
    __metadata("design:returntype", Promise)
], EbayMultiStoreController.prototype, "listErrors", null);
__decorate([
    (0, common_1.Get)('activity-logs'),
    (0, swagger_1.ApiOperation)({ summary: 'Listing / integration activity logs' }),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User, Object]),
    __metadata("design:returntype", Promise)
], EbayMultiStoreController.prototype, "activity", null);
exports.EbayMultiStoreController = EbayMultiStoreController = __decorate([
    (0, swagger_1.ApiTags)('ebay-multi-store'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('ebay'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.view'),
    __param(2, (0, typeorm_1.InjectRepository)(ebay_listing_channel_entity_js_1.EbayListingChannel)),
    __param(3, (0, typeorm_1.InjectRepository)(ebay_api_error_entity_js_1.EbayApiError)),
    __param(4, (0, typeorm_1.InjectRepository)(listing_action_log_entity_js_1.ListingActionLog)),
    __metadata("design:paramtypes", [ebay_multi_store_listing_service_js_1.EbayMultiStoreListingService,
        ebay_integration_permissions_service_js_1.EbayIntegrationPermissionsService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], EbayMultiStoreController);
//# sourceMappingURL=ebay-multi-store.controller.js.map