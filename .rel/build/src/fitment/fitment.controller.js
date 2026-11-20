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
exports.FitmentController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const fitment_service_js_1 = require("./fitment.service.js");
const fitment_matcher_service_js_1 = require("./fitment-matcher.service.js");
const fitment_import_service_js_1 = require("./fitment-import.service.js");
const ebay_mvl_service_js_1 = require("./ebay-mvl.service.js");
const ebay_mvl_import_service_js_1 = require("./ebay-mvl-import.service.js");
const ebay_mvl_store_service_js_1 = require("./ebay-mvl-store.service.js");
const ebay_mvl_import_dto_js_1 = require("./dto/ebay-mvl-import.dto.js");
const ebay_mvl_marketplace_util_js_1 = require("./ebay-mvl-marketplace.util.js");
const vin_decode_service_js_1 = require("./vin-decode.service.js");
const vin_export_service_js_1 = require("./vin-export.service.js");
const vin_db_export_service_js_1 = require("./vin-db-export.service.js");
const create_fitment_dto_js_1 = require("./dto/create-fitment.dto.js");
const search_fitment_dto_js_1 = require("./dto/search-fitment.dto.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
let FitmentController = class FitmentController {
    fitmentService;
    matcherService;
    importService;
    mvlService;
    mvlImportService;
    mvlStoreService;
    vinService;
    vinExport;
    vinDbExport;
    constructor(fitmentService, matcherService, importService, mvlService, mvlImportService, mvlStoreService, vinService, vinExport, vinDbExport) {
        this.fitmentService = fitmentService;
        this.matcherService = matcherService;
        this.importService = importService;
        this.mvlService = mvlService;
        this.mvlImportService = mvlImportService;
        this.mvlStoreService = mvlStoreService;
        this.vinService = vinService;
        this.vinExport = vinExport;
        this.vinDbExport = vinDbExport;
    }
    getMakes(q) {
        return this.fitmentService.getMakes(q);
    }
    getModels(makeId) {
        return this.fitmentService.getModels(makeId);
    }
    getSubmodels(modelId) {
        return this.fitmentService.getSubmodels(modelId);
    }
    getEngines(q) {
        return this.fitmentService.getEngines(q);
    }
    searchByVehicle(dto) {
        return this.fitmentService.searchByVehicle(dto);
    }
    getListingFitments(listingId) {
        return this.fitmentService.getListingFitments(listingId);
    }
    createFitment(listingId, dto) {
        return this.fitmentService.createFitment(listingId, dto);
    }
    deleteFitment(fitmentId) {
        return this.fitmentService.deleteFitment(fitmentId);
    }
    verifyFitment(fitmentId, dto) {
        return this.fitmentService.verifyFitment(fitmentId, dto.verified);
    }
    detectFitment(dto) {
        return this.matcherService.detectFromText(dto.text ?? '');
    }
    bulkImport(body, user) {
        return this.importService.enqueueBulkImport(body.rows, user.id);
    }
    getCompatibilityProperties(categoryId, treeId) {
        return this.mvlService.fetchCompatibilityTree(categoryId, treeId);
    }
    getPropertyValues(categoryId, propertyName, q, limit, offset, allQuery) {
        const reserved = new Set(['q', 'limit', 'offset', 'treeId']);
        const filters = {};
        if (allQuery) {
            for (const [key, val] of Object.entries(allQuery)) {
                if (!reserved.has(key) && typeof val === 'string' && val) {
                    filters[key] = val;
                }
            }
        }
        return this.mvlService.getPropertyValues(categoryId, propertyName, filters, q, limit ? parseInt(limit, 10) : undefined, offset ? parseInt(offset, 10) : undefined, allQuery?.['treeId']);
    }
    buildCompatibility(body) {
        return this.mvlService.buildCompatibilityArray(body.selections);
    }
    getEbayMakes(categoryId = '6000', q, limit, offset) {
        return this.mvlService.getMakes(categoryId, q, limit ? parseInt(limit, 10) : undefined, offset ? parseInt(offset, 10) : undefined);
    }
    getEbayModels(make, categoryId = '6000', q, limit, offset, treeId) {
        return this.mvlService.getModels(categoryId, make, q, limit ? parseInt(limit, 10) : undefined, offset ? parseInt(offset, 10) : undefined, treeId);
    }
    getEbayMvlStatus() {
        return this.mvlStoreService.getStatusSummary();
    }
    listEbayMvlReleases(marketplace) {
        return this.mvlStoreService.listReleases(marketplace ? (0, ebay_mvl_marketplace_util_js_1.resolveMvlMarketplace)(marketplace) : undefined);
    }
    importEbayMvlDirectory(dto) {
        return this.mvlImportService.importDirectory(dto.directory, {
            force: dto.force,
        });
    }
    importEbayMvlFile(dto) {
        return this.mvlImportService.importFile(dto.filePath, dto.marketplace ? (0, ebay_mvl_marketplace_util_js_1.resolveMvlMarketplace)(dto.marketplace) : undefined, { force: dto.force });
    }
    async validateEbayMvlBatch(dto) {
        const marketplace = (0, ebay_mvl_marketplace_util_js_1.resolveMvlMarketplace)(dto.marketplace);
        return this.mvlService.validateFitmentData(dto.rows ?? [], '6000', {
            treeId: (0, ebay_mvl_marketplace_util_js_1.mvlMarketplaceToTreeId)(marketplace),
        });
    }
    decodeVin(vin) {
        return this.vinService.decode(vin);
    }
    vinToEbayFilter(vin) {
        return this.vinService.toEbayCompatibilityFilter(vin);
    }
    getListingsByVin(vin) {
        return this.fitmentService.findListingsByVin(vin);
    }
    async exportVinPipelineInput(vin, res) {
        const result = await this.vinExport.generatePipelineInput(vin);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${result.filename}"`,
            'X-Vehicle-Info': `${result.vehicleInfo.year} ${result.vehicleInfo.make} ${result.vehicleInfo.model}`,
            'X-Part-Count': String(result.partCount),
            'X-Category-Count': String(result.categoryCount),
        });
        res.end(result.buffer);
    }
    async exportVinDbListings(vin, res) {
        const result = await this.vinDbExport.exportListingsByVin(vin);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${result.filename}"`,
            'X-Listing-Count': String(result.listingCount),
            'X-Match-Strategy': result.matchStrategy,
            'X-Vehicle-Info': `${result.vehicleInfo.year} ${result.vehicleInfo.make} ${result.vehicleInfo.model}`,
        });
        res.end(result.buffer);
    }
};
exports.FitmentController = FitmentController;
__decorate([
    (0, common_1.Get)('makes'),
    (0, swagger_1.ApiOperation)({ summary: 'List all makes (optional fuzzy search)' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: false }),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "getMakes", null);
__decorate([
    (0, common_1.Get)('makes/:makeId/models'),
    (0, swagger_1.ApiOperation)({ summary: 'List models for a make' }),
    (0, swagger_1.ApiParam)({ name: 'makeId', type: Number }),
    __param(0, (0, common_1.Param)('makeId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "getModels", null);
__decorate([
    (0, common_1.Get)('models/:modelId/submodels'),
    (0, swagger_1.ApiOperation)({ summary: 'List submodels for a model' }),
    (0, swagger_1.ApiParam)({ name: 'modelId', type: Number }),
    __param(0, (0, common_1.Param)('modelId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "getSubmodels", null);
__decorate([
    (0, common_1.Get)('engines'),
    (0, swagger_1.ApiOperation)({ summary: 'List engines (optional fuzzy search)' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: false }),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "getEngines", null);
__decorate([
    (0, common_1.Get)('search'),
    (0, swagger_1.ApiOperation)({ summary: 'Search parts by vehicle fitment' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_fitment_dto_js_1.SearchFitmentDto]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "searchByVehicle", null);
__decorate([
    (0, common_1.Get)('listing/:listingId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all fitments for a listing' }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "getListingFitments", null);
__decorate([
    (0, common_1.Post)('listing/:listingId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fitment.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Add fitment to a listing' }),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_fitment_dto_js_1.CreateFitmentDto]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "createFitment", null);
__decorate([
    (0, common_1.Delete)(':fitmentId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fitment.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a fitment record' }),
    __param(0, (0, common_1.Param)('fitmentId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "deleteFitment", null);
__decorate([
    (0, common_1.Patch)(':fitmentId/verify'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fitment.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Verify or unverify a fitment record' }),
    __param(0, (0, common_1.Param)('fitmentId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_fitment_dto_js_1.VerifyFitmentDto]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "verifyFitment", null);
__decorate([
    (0, common_1.Post)('detect'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fitment.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Detect fitment from raw text via AI/regex' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_fitment_dto_js_1.FitmentDetectionDto]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "detectFitment", null);
__decorate([
    (0, common_1.Post)('bulk-import'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fitment.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Enqueue ACES XML/CSV bulk import' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "bulkImport", null);
__decorate([
    (0, common_1.Get)('compatibility-properties/:categoryId'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get compatibility property names for an eBay category',
    }),
    (0, swagger_1.ApiParam)({ name: 'categoryId', type: String, example: '6000' }),
    (0, swagger_1.ApiQuery)({
        name: 'treeId',
        required: false,
        description: 'eBay category tree ID (default: 0 for US)',
    }),
    __param(0, (0, common_1.Param)('categoryId')),
    __param(1, (0, common_1.Query)('treeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "getCompatibilityProperties", null);
__decorate([
    (0, common_1.Get)('property-values/:categoryId/:propertyName'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get cascading property values (e.g. Models for a Make)',
    }),
    (0, swagger_1.ApiParam)({ name: 'categoryId', type: String, example: '6000' }),
    (0, swagger_1.ApiParam)({ name: 'propertyName', type: String, example: 'Model' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: false, description: 'Text search filter' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, type: Number }),
    __param(0, (0, common_1.Param)('categoryId')),
    __param(1, (0, common_1.Param)('propertyName')),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('offset')),
    __param(5, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, Object]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "getPropertyValues", null);
__decorate([
    (0, common_1.Post)('build-compatibility'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fitment.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Convert fitment selections to eBay compatibility JSON',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "buildCompatibility", null);
__decorate([
    (0, common_1.Get)('ebay-makes'),
    (0, swagger_1.ApiOperation)({ summary: 'Paginated eBay Make search (shorthand)' }),
    (0, swagger_1.ApiQuery)({ name: 'categoryId', required: false, example: '6000' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, type: Number }),
    __param(0, (0, common_1.Query)('categoryId')),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "getEbayMakes", null);
__decorate([
    (0, common_1.Get)('ebay-models'),
    (0, swagger_1.ApiOperation)({ summary: 'Paginated eBay Model search filtered by Make' }),
    (0, swagger_1.ApiQuery)({ name: 'categoryId', required: false, example: '6000' }),
    (0, swagger_1.ApiQuery)({ name: 'make', required: true }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, type: Number }),
    __param(0, (0, common_1.Query)('make')),
    __param(1, (0, common_1.Query)('categoryId')),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('offset')),
    __param(5, (0, common_1.Query)('treeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String, String]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "getEbayModels", null);
__decorate([
    (0, common_1.Get)('ebay-mvl/status'),
    (0, swagger_1.ApiOperation)({ summary: 'Active eBay MVL releases per marketplace' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "getEbayMvlStatus", null);
__decorate([
    (0, common_1.Get)('ebay-mvl/releases'),
    (0, swagger_1.ApiOperation)({ summary: 'List imported eBay MVL releases' }),
    (0, swagger_1.ApiQuery)({ name: 'marketplace', required: false, example: 'US' }),
    __param(0, (0, common_1.Query)('marketplace')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "listEbayMvlReleases", null);
__decorate([
    (0, common_1.Post)('ebay-mvl/import'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fitment.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Import eBay MVL workbooks from a server directory',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_mvl_import_dto_js_1.ImportEbayMvlDirectoryDto]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "importEbayMvlDirectory", null);
__decorate([
    (0, common_1.Post)('ebay-mvl/import-file'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fitment.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Import a single eBay MVL workbook by path' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_mvl_import_dto_js_1.ImportEbayMvlFileDto]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "importEbayMvlFile", null);
__decorate([
    (0, common_1.Post)('ebay-mvl/validate-batch'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fitment.view'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Validate fitment rows against local eBay MVL (DB-first)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_mvl_import_dto_js_1.ValidateEbayMvlBatchDto]),
    __metadata("design:returntype", Promise)
], FitmentController.prototype, "validateEbayMvlBatch", null);
__decorate([
    (0, common_1.Get)('vin/:vin'),
    (0, swagger_1.ApiOperation)({
        summary: 'Decode a VIN via NHTSA and map to eBay compatibility filter',
    }),
    (0, swagger_1.ApiParam)({ name: 'vin', type: String, example: '1HGCV1F34LA000001' }),
    __param(0, (0, common_1.Param)('vin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "decodeVin", null);
__decorate([
    (0, common_1.Get)('vin/:vin/ebay-filter'),
    (0, swagger_1.ApiOperation)({
        summary: 'Decode VIN and return eBay compatibility filter object',
    }),
    (0, swagger_1.ApiParam)({ name: 'vin', type: String }),
    __param(0, (0, common_1.Param)('vin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "vinToEbayFilter", null);
__decorate([
    (0, common_1.Get)('vin/:vin/listings'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get all part listings that fit a vehicle identified by VIN',
    }),
    (0, swagger_1.ApiParam)({ name: 'vin', type: String, example: '1HGCV1F34LA000001' }),
    __param(0, (0, common_1.Param)('vin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FitmentController.prototype, "getListingsByVin", null);
__decorate([
    (0, common_1.Get)('vin/:vin/export'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fitment.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Generate a pipeline-ready XLSX file from VIN',
        description: 'Decodes the VIN, generates a comprehensive parts catalog via AI, and returns a GridX Connect XLSX file that can be directly uploaded to POST /api/pipeline/upload',
    }),
    (0, swagger_1.ApiParam)({ name: 'vin', type: String, example: 'JTNB29HK8K3019731' }),
    __param(0, (0, common_1.Param)('vin')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], FitmentController.prototype, "exportVinPipelineInput", null);
__decorate([
    (0, common_1.Get)('vin/:vin/export-db'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fitment.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Export VIN-matched database listings as XLSX',
        description: 'Finds listings in the database that match the VIN-decoded vehicle and exports them as an XLSX file with images, pricing, and all listing data.',
    }),
    (0, swagger_1.ApiParam)({ name: 'vin', type: String, example: '1HGCV1F34LA000001' }),
    __param(0, (0, common_1.Param)('vin')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], FitmentController.prototype, "exportVinDbListings", null);
exports.FitmentController = FitmentController = __decorate([
    (0, swagger_1.ApiTags)('fitment'),
    (0, common_1.Controller)('fitment'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fitment.view'),
    __metadata("design:paramtypes", [fitment_service_js_1.FitmentService,
        fitment_matcher_service_js_1.FitmentMatcherService,
        fitment_import_service_js_1.FitmentImportService,
        ebay_mvl_service_js_1.EbayMvlService,
        ebay_mvl_import_service_js_1.EbayMvlImportService,
        ebay_mvl_store_service_js_1.EbayMvlStoreService,
        vin_decode_service_js_1.VinDecodeService,
        vin_export_service_js_1.VinExportService,
        vin_db_export_service_js_1.VinDbExportService])
], FitmentController);
//# sourceMappingURL=fitment.controller.js.map