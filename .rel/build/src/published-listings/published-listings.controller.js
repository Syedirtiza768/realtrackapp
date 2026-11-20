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
exports.PublishedListingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const ebay_integration_permissions_service_js_1 = require("../integrations/ebay/services/ebay-integration-permissions.service.js");
const published_listings_dto_js_1 = require("./dto/published-listings.dto.js");
const published_listings_service_js_1 = require("./services/published-listings.service.js");
const published_listings_sync_service_js_1 = require("./services/published-listings-sync.service.js");
const published_listings_action_service_js_1 = require("./services/published-listings-action.service.js");
const published_listings_bulk_service_js_1 = require("./services/published-listings-bulk.service.js");
const published_listings_audit_service_js_1 = require("./services/published-listings-audit.service.js");
const published_listings_pricing_service_js_1 = require("./services/published-listings-pricing.service.js");
const published_listings_trading_enrichment_service_js_1 = require("./services/published-listings-trading-enrichment.service.js");
const primemotive_listing_changes_service_js_1 = require("./services/primemotive-listing-changes.service.js");
let PublishedListingsController = class PublishedListingsController {
    listings;
    sync;
    actions;
    bulk;
    audit;
    pricing;
    permissions;
    tradingEnrichment;
    primemotiveChanges;
    constructor(listings, sync, actions, bulk, audit, pricing, permissions, tradingEnrichment, primemotiveChanges) {
        this.listings = listings;
        this.sync = sync;
        this.actions = actions;
        this.bulk = bulk;
        this.audit = audit;
        this.pricing = pricing;
        this.permissions = permissions;
        this.tradingEnrichment = tradingEnrichment;
        this.primemotiveChanges = primemotiveChanges;
    }
    async list(query, user) {
        const { organizationId } = await this.permissions.resolveOrganization(user.id, query.organizationId);
        return this.listings.list(organizationId, user, query);
    }
    async listPrimemotive(query, user) {
        const { organizationId } = await this.permissions.resolveOrganization(user.id, query.organizationId);
        return this.listings.listPrimemotive(organizationId, user, query);
    }
    async listPrimemotiveSalesEvents(query, user) {
        const { organizationId } = await this.permissions.resolveOrganization(user.id, query.organizationId);
        return this.listings.listPrimemotiveSalesEvents(organizationId, user, query);
    }
    async listPrimemotiveChanges(query, user) {
        const { organizationId } = await this.permissions.resolveOrganization(user.id, query.organizationId);
        return this.primemotiveChanges.listChanges(organizationId, user, query);
    }
    async recordPrimemotiveSale(dto, organizationId, timestamp, signature, request, user) {
        const resolved = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.listings.recordPrimemotiveSaleEvent(resolved.organizationId, user, dto, request.rawBody ?? Buffer.alloc(0), timestamp, signature);
    }
    async exportCsv(query, res, user) {
        const { organizationId } = await this.permissions.resolveOrganization(user.id, query.organizationId);
        const csv = await this.listings.exportCsv(organizationId, user, query);
        const dateStr = new Date().toISOString().slice(0, 10);
        const page = query.page ?? 1;
        res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="published-listings-export-${dateStr}-page-${page}.csv"`,
            'X-Export-Page': String(page),
            'X-Export-Page-Size': '10000',
        });
        res.send(csv);
    }
    async summary(organizationId, ebayAccountId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.listings.getSummary(orgId, user, ebayAccountId);
    }
    async stores(organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.listings.listStores(orgId, user);
    }
    async syncStatus(organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.listings.getSyncStatus(orgId, user);
    }
    async syncLogs(organizationId, ebayAccountId, limit = '20', user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        const items = await this.sync.getSyncLogs(orgId, ebayAccountId, Number(limit) || 20);
        return { items };
    }
    async syncListings(dto, user) {
        const { organizationId } = await this.permissions.resolveOrganization(user.id, dto.organizationId);
        return this.sync.enqueueSync({
            organizationId,
            ebayAccountId: dto.ebayAccountId,
            marketplaceId: dto.marketplaceId,
            userId: user.id,
            syncMode: dto.syncMode,
        });
    }
    async refreshCompetitorPricing(dto, user) {
        const { organizationId } = await this.permissions.resolveOrganization(user.id, dto.organizationId);
        if (dto.ebayAccountId) {
            return this.pricing.refreshForAccount(organizationId, dto.ebayAccountId);
        }
        return this.pricing.refreshForOrganization(organizationId);
    }
    async bulkAction(dto, user) {
        const { organizationId } = await this.permissions.resolveOrganization(user.id, dto.organizationId);
        const job = await this.bulk.createBulkJob(organizationId, user, dto);
        return { jobId: job.id, status: job.status, totalItems: job.totalItems };
    }
    async bulkStatus(jobId, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.bulk.getJob(jobId, orgId);
    }
    async tradingEnrichmentBudget() {
        return this.tradingEnrichment.getBudgetStatus();
    }
    async batchTradingEnrichment(dto, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        const listings = await this.listings.getByIdsRaw(dto.listingIds, orgId, user);
        return this.tradingEnrichment.preEnrichBatch(listings, {
            force: dto.force,
        });
    }
    async getOne(id, organizationId, includeCatalogData, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.listings.getById(id, orgId, user, includeCatalogData === true);
    }
    async getTradingEnrichment(id, organizationId, force, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        const listing = await this.listings.getByIdRaw(id, orgId, user);
        return this.tradingEnrichment.enrich(listing, {
            force: force === 'true' || force === '1',
        });
    }
    async revisions(id, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        await this.listings.getById(id, orgId, user);
        const items = await this.audit.listRevisions(id, orgId);
        return { items };
    }
    async revise(id, dto, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.actions.revise(id, orgId, user, dto);
    }
    async updatePolicies(id, dto, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.actions.updatePolicies(id, orgId, user, dto);
    }
    async refreshListingCompetitorPricing(id, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.pricing.refreshCompetitorPricing(id, orgId);
    }
    async end(id, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.actions.endListing(id, orgId, user);
    }
    async relist(id, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.actions.relist(id, orgId, user);
    }
    async refresh(id, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.actions.refreshListing(id, orgId, user);
    }
};
exports.PublishedListingsController = PublishedListingsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'List published eBay listings across connected stores',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [published_listings_dto_js_1.PublishedListingsQueryDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('primemotive'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.external_feed'),
    (0, swagger_1.ApiOperation)({
        summary: 'List active published eBay listings from the Primemotive store',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [published_listings_dto_js_1.PublishedListingsQueryDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "listPrimemotive", null);
__decorate([
    (0, common_1.Get)('primemotive/sales-events'),
    (0, swagger_1.ApiOperation)({
        summary: 'List recorded external sale events for Primemotive listings',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [published_listings_dto_js_1.PublishedListingsQueryDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "listPrimemotiveSalesEvents", null);
__decorate([
    (0, common_1.Get)('primemotive/changes'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.external_feed'),
    (0, swagger_1.ApiOperation)({
        summary: 'Read added, updated, and removed Primemotive listing changes',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [published_listings_dto_js_1.PublishedListingsQueryDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "listPrimemotiveChanges", null);
__decorate([
    (0, common_1.Post)('primemotive/webhooks/sales'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.sales.notify'),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Record a sale reported by the external Primemotive listing app',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Headers)('x-primemotive-timestamp')),
    __param(3, (0, common_1.Headers)('x-primemotive-signature')),
    __param(4, (0, common_1.Req)()),
    __param(5, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [published_listings_dto_js_1.PrimemotiveSaleWebhookDto, Object, Object, Object, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "recordPrimemotiveSale", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.export'),
    (0, swagger_1.ApiOperation)({ summary: 'Export published listings as CSV' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [published_listings_dto_js_1.PublishedListingsQueryDto, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "exportCsv", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, swagger_1.ApiOperation)({ summary: 'Dashboard summary counts for published listings' }),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, common_1.Query)('ebayAccountId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('stores'),
    (0, swagger_1.ApiOperation)({
        summary: 'Discover connected stores with published-listing counts (reader-safe)',
    }),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "stores", null);
__decorate([
    (0, common_1.Get)('sync-status'),
    (0, swagger_1.ApiOperation)({
        summary: 'Per-store published-listings sync health for marketplace readers',
    }),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "syncStatus", null);
__decorate([
    (0, common_1.Get)('sync-logs'),
    (0, swagger_1.ApiOperation)({ summary: 'Recent published listing sync logs' }),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, common_1.Query)('ebayAccountId')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "syncLogs", null);
__decorate([
    (0, common_1.Post)('sync'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.sync'),
    (0, swagger_1.ApiOperation)({ summary: 'Enqueue sync of published listings from eBay' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [published_listings_dto_js_1.SyncPublishedListingsDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "syncListings", null);
__decorate([
    (0, common_1.Post)('competitor-pricing/refresh'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.sync'),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh competitor pricing via Browse API' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [published_listings_dto_js_1.SyncPublishedListingsDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "refreshCompetitorPricing", null);
__decorate([
    (0, common_1.Post)('bulk'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.bulk'),
    (0, swagger_1.ApiOperation)({ summary: 'Enqueue bulk action on selected listings' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [published_listings_dto_js_1.BulkPublishedListingsDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "bulkAction", null);
__decorate([
    (0, common_1.Get)('bulk/:jobId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get bulk job status and per-listing results' }),
    __param(0, (0, common_1.Param)('jobId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "bulkStatus", null);
__decorate([
    (0, common_1.Get)('trading-enrichment/budget'),
    (0, swagger_1.ApiOperation)({
        summary: 'Check Trading API enrichment rate-limit budget status',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "tradingEnrichmentBudget", null);
__decorate([
    (0, common_1.Post)('trading-enrichment/batch'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.sync'),
    (0, swagger_1.ApiOperation)({
        summary: 'Pre-enrich a batch of listings via Trading API. ' +
            'Call with listing IDs to warm the cache before PartsBazar360 traffic.',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "batchTradingEnrichment", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get published listing detail' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Query)('includeCatalogData', new common_1.ParseBoolPipe({ optional: true }))),
    __param(3, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "getOne", null);
__decorate([
    (0, common_1.Get)(':id/trading-enrichment'),
    (0, swagger_1.ApiOperation)({
        summary: 'Fetch Trading API enrichment for a listing (images, compatibility, description, item specifics). ' +
            'Returns cached data when fresh (<7 days); fetches from eBay Trading API on cache miss. ' +
            'Rate-limited to ~4,500 calls/day across all listings.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Query)('force')),
    __param(3, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "getTradingEnrichment", null);
__decorate([
    (0, common_1.Get)(':id/revisions'),
    (0, swagger_1.ApiOperation)({ summary: 'Listing revision / audit history' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "revisions", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Revise a published listing on eBay' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __param(3, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, published_listings_dto_js_1.RevisePublishedListingDto, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "revise", null);
__decorate([
    (0, common_1.Patch)(':id/policies'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Update business policies (shipping/return/payment) on a published eBay listing',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __param(3, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, published_listings_dto_js_1.UpdatePoliciesDto, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "updatePolicies", null);
__decorate([
    (0, common_1.Post)(':id/competitor-pricing'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.sync'),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh competitor pricing for one listing' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "refreshListingCompetitorPricing", null);
__decorate([
    (0, common_1.Post)(':id/end'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'End a published listing on eBay' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "end", null);
__decorate([
    (0, common_1.Post)(':id/relist'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Relist an ended listing on eBay' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "relist", null);
__decorate([
    (0, common_1.Post)(':id/refresh'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.sync'),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh a single listing from eBay' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PublishedListingsController.prototype, "refresh", null);
exports.PublishedListingsController = PublishedListingsController = __decorate([
    (0, swagger_1.ApiTags)('published-listings'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('published-listings'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('published_listings.view'),
    __metadata("design:paramtypes", [published_listings_service_js_1.PublishedListingsService,
        published_listings_sync_service_js_1.PublishedListingsSyncService,
        published_listings_action_service_js_1.PublishedListingsActionService,
        published_listings_bulk_service_js_1.PublishedListingsBulkService,
        published_listings_audit_service_js_1.PublishedListingsAuditService,
        published_listings_pricing_service_js_1.PublishedListingsPricingService,
        ebay_integration_permissions_service_js_1.EbayIntegrationPermissionsService,
        published_listings_trading_enrichment_service_js_1.PublishedListingsTradingEnrichmentService,
        primemotive_listing_changes_service_js_1.PrimemotiveListingChangesService])
], PublishedListingsController);
//# sourceMappingURL=published-listings.controller.js.map