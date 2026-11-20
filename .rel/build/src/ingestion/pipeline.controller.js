"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const event_emitter_1 = require("@nestjs/event-emitter");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const pipeline_service_js_1 = require("./pipeline.service.js");
const pre_enriched_febest_js_1 = require("./pre-enriched-febest.js");
const single_listing_form_service_js_1 = require("./services/single-listing-form.service.js");
const add_intake_part_dto_js_1 = require("./dto/add-intake-part.dto.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const pipeline_marketplaces_js_1 = require("../common/marketplaces/pipeline-marketplaces.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
const teams_service_js_1 = require("../teams/teams.service.js");
const vertical_types_js_1 = require("../verticals/vertical.types.js");
let PipelineController = class PipelineController {
    pipelineService;
    singleListingForm;
    rbac;
    teamsService;
    events;
    constructor(pipelineService, singleListingForm, rbac, teamsService, events) {
        this.pipelineService = pipelineService;
        this.singleListingForm = singleListingForm;
        this.rbac = rbac;
        this.teamsService = teamsService;
        this.events = events;
    }
    async generateEnterpriseOptimization(id, body) {
        return this.pipelineService.generateEnterpriseOptimization(id, body);
    }
    async getOptimizationStatus(id, marketplace) {
        return this.pipelineService.getOptimizationStatus(id, marketplace);
    }
    async getProductOptimization(_jobId, productId) {
        return this.pipelineService.getProductOptimization(productId);
    }
    async rerunProductOptimization(productId, body) {
        const product = await this.pipelineService.rerunProductOptimization(productId, body?.marketplace ?? 'US');
        return { product };
    }
    async markManualReview(productId, body) {
        const product = await this.pipelineService.markProductManualReview(productId, body?.enabled !== false);
        return { product };
    }
    async verifyTitles(id) {
        return this.pipelineService.verifyJobTitles(id);
    }
    async bypassOptimization(id) {
        return this.pipelineService.bypassJobOptimization(id);
    }
    async runCombinedOptimization(id, body) {
        return this.pipelineService.runCombinedOptimization(id, body);
    }
    async uploadAndStart(file, teamId, conditionLabel, marketplace, storeId, shippingProfileName, returnProfileName, paymentProfileName, fulfillmentPolicyId, paymentPolicyId, returnPolicyId, verticalRaw, importModeRaw, user) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        if (!(0, pipeline_marketplaces_js_1.isPipelineMarketplaceCode)(marketplace?.trim())) {
            throw new common_1.BadRequestException('marketplace must be US, UK, AU, or DE');
        }
        const marketplaceCode = marketplace.trim();
        const verticalValue = verticalRaw?.trim() || vertical_types_js_1.DEFAULT_PRODUCT_VERTICAL;
        if (!(0, vertical_types_js_1.isProductVertical)(verticalValue)) {
            throw new common_1.BadRequestException('vertical must be automotive, business_industrial, or fashion');
        }
        const vertical = verticalValue;
        const manageAllTeams = await this.rbac.userHasPermission(user.id, 'teams.manage');
        const job = await this.pipelineService.createJobFromUpload(file.originalname, file.buffer, user.id, teamId, conditionLabel, manageAllTeams, {
            marketplace: marketplaceCode,
            storeId: storeId?.trim(),
            shippingProfileName: shippingProfileName?.trim(),
            returnProfileName: returnProfileName?.trim(),
            paymentProfileName: paymentProfileName?.trim(),
            fulfillmentPolicyId: fulfillmentPolicyId?.trim(),
            paymentPolicyId: paymentPolicyId?.trim(),
            returnPolicyId: returnPolicyId?.trim(),
        }, user, vertical, (importModeRaw?.trim() || 'legacy_gridx'));
        return { job };
    }
    async dryRunPreEnrichedFebest(file) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        const validation = (0, pre_enriched_febest_js_1.parsePreEnrichedFebestWorkbook)(file.buffer);
        return {
            mode: pre_enriched_febest_js_1.PRE_ENRICHED_FEBEST_MODE,
            filename: file.originalname,
            validation,
        };
    }
    async singleListingBrands(q) {
        return this.singleListingForm.listBrands(q);
    }
    async singleListingLookupPricing() {
        return this.singleListingForm.getLookupPricing();
    }
    async singleListingPartLookup(body) {
        return this.singleListingForm.lookupPart(body);
    }
    async addIntakePart(body, user) {
        const result = await this.singleListingForm.createIntakePart(body);
        const listing = result.listing;
        if (listing.customLabelSku) {
            this.events.emit('stock.intake.received', {
                userId: user.id,
                sku: listing.customLabelSku,
                vertical: 'automotive',
                quantity: listing.quantityNum ?? 1,
                listingRecordId: listing.id,
                title: listing.title,
                imageUrl: listing.itemPhotoUrl?.split('|')[0] ?? null,
                binCode: body.location ?? null,
                conditionId: body.conditionId,
                idempotencyKey: `auto-parts-intake:${listing.id}`,
            });
        }
        return result;
    }
    async createSingleListing(body, user) {
        const job = await this.pipelineService.createSingleJob(body, user.id);
        return { job };
    }
    async listJobs(user, status, displayStatus, teamIds, limit, offset) {
        const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
        const manageAllTeams = await this.rbac.userHasPermission(user.id, 'teams.manage');
        const parsedTeamIds = teamIds
            ? teamIds
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined;
        if (parsedTeamIds?.length) {
            await this.teamsService.assertUserCanAccessTeams(user.id, parsedTeamIds, manageAllTeams);
        }
        return this.pipelineService.listJobs(status, limit ?? 20, offset ?? 0, user.id, viewAll, displayStatus, parsedTeamIds);
    }
    async getJob(id, user) {
        const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
        const job = await this.pipelineService.getJob(id, user.id, viewAll);
        return { job };
    }
    async retryJob(id, user) {
        const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
        const job = await this.pipelineService.retryJob(id, user.id, viewAll);
        return { job };
    }
    async cancelJob(id, user) {
        const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
        const job = await this.pipelineService.cancelJob(id, user.id, viewAll);
        return { job };
    }
    async resumeImport(id, user) {
        const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
        const job = await this.pipelineService.resumeImport(id, user.id, viewAll);
        return { job };
    }
    async deleteJob(id, user) {
        const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
        await this.pipelineService.deleteJob(id, user.id, viewAll);
        return { deleted: true };
    }
    async getStats() {
        return this.pipelineService.getStats();
    }
    async downloadOutput(id, template, res) {
        const job = await this.pipelineService.getJob(id);
        let filePath = null;
        let filename;
        switch (template) {
            case 'us':
                filePath = job.outputUsPath;
                filename = `US-Motors-Listings-${job.id.slice(0, 8)}.xlsx`;
                break;
            case 'au':
                filePath = job.outputAuPath;
                filename = `AU-Category-Listings-${job.id.slice(0, 8)}.xlsx`;
                break;
            case 'de':
                filePath = job.outputDePath;
                filename = `DE-Category-Listings-${job.id.slice(0, 8)}.xlsx`;
                break;
            case 'uk':
                filePath = job.outputUkPath;
                filename = `UK-Category-Listings-${job.id.slice(0, 8)}.xlsx`;
                break;
            case 'report':
                filePath = job.reportPath;
                filename = `Enrichment-Report-${job.id.slice(0, 8)}.json`;
                break;
            case 'input':
                filePath = job.storedFilePath;
                filename = job.originalFilename;
                break;
            default:
                throw new Error(`Unknown template: ${template}. Use: us, uk, au, de, report, input`);
        }
        if (!filePath || !fs.existsSync(filePath)) {
            res.status(404).json({
                message: `Output file not yet available for template: ${template}`,
            });
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        let mimeType;
        if (ext === '.json') {
            mimeType = 'application/json';
        }
        else if (ext === '.csv') {
            mimeType = 'text/csv';
        }
        else if (ext === '.xls') {
            mimeType = 'application/vnd.ms-excel';
        }
        else {
            mimeType =
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        fs.createReadStream(filePath).pipe(res);
    }
};
exports.PipelineController = PipelineController;
__decorate([
    (0, common_1.Post)('jobs/:id/enterprise-optimize'),
    (0, throttler_1.Throttle)({ medium: { limit: 5, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.run'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Generate enterprise-grade AI listing optimization, compliance scoring, and upload payloads',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "generateEnterpriseOptimization", null);
__decorate([
    (0, common_1.Get)('jobs/:id/optimization'),
    (0, throttler_1.Throttle)({ short: { limit: 30, ttl: 1000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.view'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get mandatory listing optimization status for a pipeline job',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('marketplace')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "getOptimizationStatus", null);
__decorate([
    (0, common_1.Get)('jobs/:id/products/:productId/optimization'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.view'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get optimization details for a single catalog product',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "getProductOptimization", null);
__decorate([
    (0, common_1.Post)('jobs/:id/products/:productId/rerun-optimization'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.run'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Admin/debug: force re-run optimization for one product',
    }),
    __param(0, (0, common_1.Param)('productId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "rerunProductOptimization", null);
__decorate([
    (0, common_1.Post)('jobs/:id/products/:productId/manual-review'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.review'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Send product to manual review queue' }),
    __param(0, (0, common_1.Param)('productId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "markManualReview", null);
__decorate([
    (0, common_1.Post)('jobs/:id/verify-titles'),
    (0, throttler_1.Throttle)({ medium: { limit: 5, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.review'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Text-only AI consistency check: does each product title match its identified part (partType/mpn/brand/category)? Flags mismatches for manual review; does not call the eBay Browse API.',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "verifyTitles", null);
__decorate([
    (0, common_1.Post)('jobs/:id/bypass-optimization'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Bypass mandatory optimization — mark all products as completed so downloads unlock',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "bypassOptimization", null);
__decorate([
    (0, common_1.Post)('jobs/:id/optimize-all'),
    (0, throttler_1.Throttle)({ medium: { limit: 5, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.run'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Re-run mandatory listing optimization for entire job (admin/debug)',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "runCombinedOptimization", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, throttler_1.Throttle)({ medium: { limit: 3, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.run'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({
        summary: 'Upload an Excel/CSV file and start the enrichment pipeline; supports legacy_gridx and pre_enriched_febest_v1',
    }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('teamId')),
    __param(2, (0, common_1.Body)('conditionLabel')),
    __param(3, (0, common_1.Body)('marketplace')),
    __param(4, (0, common_1.Body)('storeId')),
    __param(5, (0, common_1.Body)('shippingProfileName')),
    __param(6, (0, common_1.Body)('returnProfileName')),
    __param(7, (0, common_1.Body)('paymentProfileName')),
    __param(8, (0, common_1.Body)('fulfillmentPolicyId')),
    __param(9, (0, common_1.Body)('paymentPolicyId')),
    __param(10, (0, common_1.Body)('returnPolicyId')),
    __param(11, (0, common_1.Body)('vertical')),
    __param(12, (0, common_1.Body)('importMode')),
    __param(13, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, Object, Object, Object, Object, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "uploadAndStart", null);
__decorate([
    (0, common_1.Post)('pre-enriched-febest/dry-run'),
    (0, throttler_1.Throttle)({ medium: { limit: 5, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.run'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({
        summary: 'Validate a pre_enriched_febest_v1 workbook without creating a job or writing production data',
    }),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "dryRunPreEnrichedFebest", null);
__decorate([
    (0, common_1.Get)('single-listing/brands'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.create'),
    (0, swagger_1.ApiOperation)({
        summary: 'List brand/make options (catalog + static OEM list) for new listing form',
    }),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "singleListingBrands", null);
__decorate([
    (0, common_1.Get)('single-listing/lookup-pricing'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.create'),
    (0, swagger_1.ApiOperation)({
        summary: 'Estimated OpenRouter cost for single-listing part lookup at scale',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "singleListingLookupPricing", null);
__decorate([
    (0, common_1.Post)('single-listing/part-lookup'),
    (0, throttler_1.Throttle)({ medium: { limit: 10, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequireAnyPermission)('inventory.enrich', 'listings.create'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'AI part lookup from OEM + brand (+ photos when provided). Text-only when no images.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "singleListingPartLookup", null);
__decorate([
    (0, common_1.Post)('single-listing/add-part'),
    (0, throttler_1.Throttle)({ medium: { limit: 20, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.create'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({
        summary: 'Warehouse intake — save part type, condition, price, and identity as draft inventory',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [add_intake_part_dto_js_1.AddIntakePartDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "addIntakePart", null);
__decorate([
    (0, common_1.Post)('single'),
    (0, throttler_1.Throttle)({ medium: { limit: 5, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.run'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({
        summary: 'Submit a single listing for pipeline enrichment (generates a single-row CSV internally)',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "createSingleListing", null);
__decorate([
    (0, common_1.Get)('jobs'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List pipeline jobs' }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('displayStatus')),
    __param(3, (0, common_1.Query)('teamIds')),
    __param(4, (0, common_1.Query)('limit')),
    __param(5, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "listJobs", null);
__decorate([
    (0, common_1.Get)('jobs/:id'),
    (0, throttler_1.Throttle)({ short: { limit: 30, ttl: 1000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get pipeline job details' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "getJob", null);
__decorate([
    (0, common_1.Post)('jobs/:id/retry'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Retry a failed pipeline job' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "retryJob", null);
__decorate([
    (0, common_1.Post)('jobs/:id/cancel'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a pending/processing pipeline job' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "cancelJob", null);
__decorate([
    (0, common_1.Post)('jobs/:id/resume-import'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Resume catalog import for a job that finished enrichment but got stuck during import (reuses on-disk output, does not re-run enrichment)',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "resumeImport", null);
__decorate([
    (0, common_1.Post)('jobs/:id/delete'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Permanently delete a pipeline job and its uploads',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "deleteJob", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get pipeline aggregate stats' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('jobs/:id/download/:template'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.export'),
    (0, swagger_1.ApiOperation)({
        summary: 'Download pipeline output file (us, uk, au, de, report)',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('template')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "downloadOutput", null);
exports.PipelineController = PipelineController = __decorate([
    (0, swagger_1.ApiTags)('Pipeline'),
    (0, common_1.Controller)('pipeline'),
    __metadata("design:paramtypes", [pipeline_service_js_1.PipelineService,
        single_listing_form_service_js_1.SingleListingFormService,
        rbac_service_js_1.RbacService,
        teams_service_js_1.TeamsService,
        event_emitter_1.EventEmitter2])
], PipelineController);
//# sourceMappingURL=pipeline.controller.js.map