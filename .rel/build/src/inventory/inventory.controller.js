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
exports.InventoryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const inventory_service_js_1 = require("./inventory.service.js");
const inventory_workbench_service_js_1 = require("./inventory-workbench.service.js");
const inventory_auto_trigger_service_js_1 = require("./inventory-auto-trigger.service.js");
const enrichment_retry_service_js_1 = require("./enrichment-retry.service.js");
const inventory_dto_js_1 = require("./dto/inventory.dto.js");
const inventory_workbench_dto_js_1 = require("./dto/inventory-workbench.dto.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
let InventoryController = class InventoryController {
    inventoryService;
    workbench;
    autoTrigger;
    retryService;
    constructor(inventoryService, workbench, autoTrigger, retryService) {
        this.inventoryService = inventoryService;
        this.workbench = workbench;
        this.autoTrigger = autoTrigger;
        this.retryService = retryService;
    }
    async getEnrichmentStatus(listingId) {
        return this.autoTrigger.queryStatusWithStage(listingId);
    }
    listWorkbenchListings(query, user) {
        return this.workbench.listListings(query, user);
    }
    listFacets(query, user) {
        return this.workbench.listFacets(query, user);
    }
    bulkSoftDeleteListings(body) {
        return this.workbench.bulkSoftDeleteListings(body.ids ?? []);
    }
    getListingDetail(listingId) {
        return this.workbench.getListingDetail(listingId);
    }
    softDeleteListing(listingId) {
        return this.workbench.softDeleteListing(listingId);
    }
    updateListingImages(listingId, dto) {
        return this.workbench.updateListingImages(listingId, dto.imageUrls, dto.uploadedAssetIds);
    }
    reorderImages(listingId, dto) {
        return this.workbench.reorderListingImages(listingId, dto.imageUrls);
    }
    updateDonorVehicle(listingId, dto) {
        return this.workbench.updateDonorVehicle(listingId, dto);
    }
    lookupPart(dto) {
        return this.workbench.lookupPartForListing(dto.listingId);
    }
    bulkLookupParts(dto) {
        return this.workbench.bulkLookupParts(dto.listingIds);
    }
    async inlineEnrich(dto) {
        const result = await this.autoTrigger.enqueueAutoEnrich(dto.listingId, {
            force: dto.force,
        });
        return { listingId: dto.listingId, ...result };
    }
    async retryEnrichment(listingId) {
        const result = await this.autoTrigger.enqueueAutoEnrich(listingId, {
            force: true,
        });
        return { listingId, ...result };
    }
    async getEnrichmentRetryStatus(listingId) {
        const status = await this.retryService.getRetryStatus(listingId);
        if (!status) {
            return { listingId, found: false };
        }
        return { listingId, found: true, ...status };
    }
    async resetEnrichmentRetry(listingId) {
        const reset = await this.retryService.overridePermanentFailure(listingId);
        return { listingId, reset };
    }
    getFilterBrands() {
        return this.workbench.getFilterBrands();
    }
    getFilterMakes() {
        return this.workbench.getFilterMakes();
    }
    getFilterModels(make) {
        return this.workbench.getFilterModels(make);
    }
    getFilterCategories() {
        return this.workbench.getFilterCategories();
    }
    sendToCatalog(dto) {
        return this.workbench.sendToCatalog(dto.listingIds);
    }
    sendToPipeline(dto, user) {
        return this.workbench.sendToPipeline(dto.listingIds, user.id);
    }
    enrichListings(dto, user) {
        return this.workbench.sendToPipeline(dto.listingIds, user.id);
    }
    getLedger(listingId) {
        return this.inventoryService.getLedger(listingId);
    }
    adjust(listingId, dto) {
        return this.inventoryService.adjustQuantity(listingId, dto.change, dto.reason, dto.idempotencyKey, dto.sourceChannel);
    }
    reserve(listingId, dto) {
        return this.inventoryService.reserveQuantity(listingId, dto.quantity, dto.orderId);
    }
    release(listingId, dto) {
        return this.inventoryService.releaseReservation(listingId, dto.quantity, dto.orderId);
    }
    lowStock(dto) {
        return this.inventoryService.getLowStock(dto.threshold, dto.limit);
    }
    reconcile(dto) {
        return this.inventoryService.reconcile(dto.listingIds);
    }
    events(dto) {
        return this.inventoryService.getEvents(dto.listingId, dto.type, dto.since, dto.limit, dto.offset);
    }
    duplicates(confidence) {
        return this.inventoryService.findDuplicates(confidence ? parseFloat(confidence) : undefined);
    }
    getAllocations(listingId, storeId) {
        return this.inventoryService.getAllocations(listingId, storeId);
    }
    allocateToStore(listingId, body) {
        return this.inventoryService.allocateToStore(listingId, body.storeId, body.quantity);
    }
    reserveFromStore(listingId, body) {
        return this.inventoryService.reserveFromStore(listingId, body.storeId, body.quantity, body.orderId);
    }
};
exports.InventoryController = InventoryController;
__decorate([
    (0, common_1.Get)('listings/:listingId/enrichment-status'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get current enrichment status + stage for a listing (idle/ready/enriching/completed/failed + stage name)',
    }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getEnrichmentStatus", null);
__decorate([
    (0, common_1.Get)('listings'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List catalog listings for inventory workbench' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_workbench_dto_js_1.InventoryListingsQueryDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "listWorkbenchListings", null);
__decorate([
    (0, common_1.Get)('listings/facets'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Dynamic facet counts for inventory filters' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_workbench_dto_js_1.InventoryListingsQueryDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "listFacets", null);
__decorate([
    (0, common_1.Post)('listings/bulk-delete'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.delete'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Soft-delete multiple inventory listings' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "bulkSoftDeleteListings", null);
__decorate([
    (0, common_1.Get)('listings/:listingId/detail'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Full part detail for inventory workbench modal' }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "getListingDetail", null);
__decorate([
    (0, common_1.Delete)('listings/:listingId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.delete'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft-delete an inventory listing (recoverable via listings restore)',
    }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "softDeleteListing", null);
__decorate([
    (0, common_1.Patch)('listings/:listingId/images'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    (0, swagger_1.ApiOperation)({
        summary: 'Attach uploaded photos to an inventory draft listing',
    }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, inventory_workbench_dto_js_1.UpdateListingImagesDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "updateListingImages", null);
__decorate([
    (0, common_1.Patch)('listings/:listingId/images/reorder'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    (0, swagger_1.ApiOperation)({
        summary: 'Reorder or remove images for a listing. Pass the complete desired URL array.',
    }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, inventory_workbench_dto_js_1.ReorderImagesDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "reorderImages", null);
__decorate([
    (0, common_1.Patch)('listings/:listingId/donor-vehicle'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    (0, swagger_1.ApiOperation)({
        summary: 'Set the donor vehicle (VIN/Year/Make/Model) for a listing and re-run fitment + title optimization',
    }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, inventory_workbench_dto_js_1.UpdateDonorVehicleDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "updateDonorVehicle", null);
__decorate([
    (0, common_1.Post)('part-lookup'),
    (0, throttler_1.Throttle)({ medium: { limit: 10, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.enrich'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Vision-first fetch details for one inventory part (OEM + brand + photos → title, category, SEO notes)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_workbench_dto_js_1.InventoryPartLookupDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "lookupPart", null);
__decorate([
    (0, common_1.Post)('part-lookup/bulk'),
    (0, throttler_1.Throttle)({ medium: { limit: 3, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.enrich'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Vision-first fetch details for multiple inventory parts',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_workbench_dto_js_1.InventoryBulkPartLookupDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "bulkLookupParts", null);
__decorate([
    (0, common_1.Post)('inline-enrich'),
    (0, throttler_1.Throttle)({ medium: { limit: 10, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.enrich'),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, swagger_1.ApiOperation)({
        summary: 'Enqueue background inline enrichment (vision lookup + AI + US/AU/DE). Poll enrichment-status for progress.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_workbench_dto_js_1.InventoryInlineEnrichDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "inlineEnrich", null);
__decorate([
    (0, common_1.Post)('listings/:listingId/retry-enrichment'),
    (0, throttler_1.Throttle)({ medium: { limit: 10, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.enrich'),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, swagger_1.ApiOperation)({
        summary: 'Force re-enqueue inline enrichment for a stuck or incomplete listing',
    }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "retryEnrichment", null);
__decorate([
    (0, common_1.Get)('listings/:listingId/enrichment-retry-status'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get enrichment retry status — shows retry count, failure reason, next retry time, and permanent failure flag',
    }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getEnrichmentRetryStatus", null);
__decorate([
    (0, common_1.Post)('listings/:listingId/reset-enrichment-retry'),
    (0, throttler_1.Throttle)({ medium: { limit: 5, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.enrich'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Reset a permanently failed enrichment — clears retry count and failure flags, allowing auto-retry to resume',
    }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "resetEnrichmentRetry", null);
__decorate([
    (0, common_1.Get)('filters/brands'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Distinct brand values from listing records' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "getFilterBrands", null);
__decorate([
    (0, common_1.Get)('filters/makes'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({
        summary: 'Distinct extracted make values from listing records',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "getFilterMakes", null);
__decorate([
    (0, common_1.Get)('filters/models'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({
        summary: 'Distinct extracted model values, optionally filtered by make',
    }),
    __param(0, (0, common_1.Query)('make')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "getFilterModels", null);
__decorate([
    (0, common_1.Get)('filters/categories'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Distinct category names from listing records' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "getFilterCategories", null);
__decorate([
    (0, common_1.Post)('send-to-catalog'),
    (0, throttler_1.Throttle)({ medium: { limit: 10, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.enrich'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Create/update catalog products from enriched listing data',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_workbench_dto_js_1.InventorySendToCatalogDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "sendToCatalog", null);
__decorate([
    (0, common_1.Post)('send-to-pipeline'),
    (0, throttler_1.Throttle)({ medium: { limit: 5, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.enrich'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({
        summary: 'Send selected inventory parts to enrichment pipeline (one batch job, vision on photos)',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_workbench_dto_js_1.InventoryEnrichDto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "sendToPipeline", null);
__decorate([
    (0, common_1.Post)('enrich'),
    (0, throttler_1.Throttle)({ medium: { limit: 5, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.enrich'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Alias for send-to-pipeline (deprecated)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_workbench_dto_js_1.InventoryEnrichDto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "enrichListings", null);
__decorate([
    (0, common_1.Get)(':listingId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get inventory ledger and recent events for a listing',
    }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "getLedger", null);
__decorate([
    (0, common_1.Post)(':listingId/adjust'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.adjust'),
    (0, swagger_1.ApiOperation)({ summary: 'Adjust inventory quantity (idempotent)' }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, inventory_dto_js_1.AdjustInventoryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "adjust", null);
__decorate([
    (0, common_1.Post)(':listingId/reserve'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.allocate'),
    (0, swagger_1.ApiOperation)({ summary: 'Reserve inventory for a pending order' }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, inventory_dto_js_1.ReserveInventoryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "reserve", null);
__decorate([
    (0, common_1.Post)(':listingId/release'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.allocate'),
    (0, swagger_1.ApiOperation)({ summary: 'Release a reservation (e.g. order cancelled)' }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, inventory_dto_js_1.ReleaseInventoryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "release", null);
__decorate([
    (0, common_1.Get)('alerts/low-stock'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get items below low-stock threshold' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_dto_js_1.LowStockQueryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "lowStock", null);
__decorate([
    (0, common_1.Post)('reconcile'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.reconcile'),
    (0, swagger_1.ApiOperation)({ summary: 'Reconcile inventory for specified listings' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_dto_js_1.ReconcileDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "reconcile", null);
__decorate([
    (0, common_1.Get)('events/log'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Query inventory events' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_dto_js_1.InventoryEventsQueryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "events", null);
__decorate([
    (0, common_1.Get)('duplicates/scan'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({
        summary: 'Find duplicate listings by SKU/MPN/title similarity',
    }),
    __param(0, (0, common_1.Query)('confidence')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "duplicates", null);
__decorate([
    (0, common_1.Get)(':listingId/allocations'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get per-store allocations for a listing' }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('storeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "getAllocations", null);
__decorate([
    (0, common_1.Post)(':listingId/allocations'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.allocate'),
    (0, swagger_1.ApiOperation)({ summary: 'Allocate inventory to a specific store' }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "allocateToStore", null);
__decorate([
    (0, common_1.Post)(':listingId/allocations/reserve'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.allocate'),
    (0, swagger_1.ApiOperation)({
        summary: 'Reserve from store allocation (order placed on store)',
    }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "reserveFromStore", null);
exports.InventoryController = InventoryController = __decorate([
    (0, swagger_1.ApiTags)('inventory'),
    (0, common_1.Controller)('inventory'),
    __metadata("design:paramtypes", [inventory_service_js_1.InventoryService,
        inventory_workbench_service_js_1.InventoryWorkbenchService,
        inventory_auto_trigger_service_js_1.InventoryAutoTriggerService,
        enrichment_retry_service_js_1.EnrichmentRetryService])
], InventoryController);
//# sourceMappingURL=inventory.controller.js.map