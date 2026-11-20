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
exports.ImageEnrichmentController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const image_enrichment_service_js_1 = require("./image-enrichment.service.js");
const require_permissions_decorator_js_1 = require("../../rbac/decorators/require-permissions.decorator.js");
let ImageEnrichmentController = class ImageEnrichmentController {
    imageEnrichmentService;
    constructor(imageEnrichmentService) {
        this.imageEnrichmentService = imageEnrichmentService;
    }
    async enrichBatch(body) {
        const { parts, jobId, downloadImages = false } = body;
        if (!parts?.length) {
            return { results: [], progress: null };
        }
        const { results, progress } = await this.imageEnrichmentService.enrichBatch(parts, jobId, { downloadImages });
        return { results, progress };
    }
    async validateUrls(body) {
        const urls = body.urls?.slice(0, 200) ?? [];
        if (!urls.length)
            return { results: [], summary: { total: 0, accessible: 0, issues: 0 } };
        const results = await this.imageEnrichmentService.validateImageUrls(urls);
        const accessible = results.filter((r) => r.accessible).length;
        const withIssues = results.filter((r) => r.issues.length > 0).length;
        return {
            results,
            summary: { total: urls.length, accessible, issues: withIssues },
        };
    }
    async getStatus(jobId) {
        const progress = await this.imageEnrichmentService.getEnrichmentStatus(jobId);
        return { jobId, progress };
    }
};
exports.ImageEnrichmentController = ImageEnrichmentController;
__decorate([
    (0, common_1.Post)('enrich'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Enrich a batch of parts with images' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ImageEnrichmentController.prototype, "enrichBatch", null);
__decorate([
    (0, common_1.Post)('validate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Validate a batch of image URLs (accessibility, resolution, compliance)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ImageEnrichmentController.prototype, "validateUrls", null);
__decorate([
    (0, common_1.Get)(':jobId/status'),
    (0, throttler_1.Throttle)({ short: { limit: 30, ttl: 1000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Get image enrichment status for a pipeline job' }),
    __param(0, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ImageEnrichmentController.prototype, "getStatus", null);
exports.ImageEnrichmentController = ImageEnrichmentController = __decorate([
    (0, swagger_1.ApiTags)('Pipeline / Image Enrichment'),
    (0, common_1.Controller)('pipeline/images'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.run'),
    __metadata("design:paramtypes", [image_enrichment_service_js_1.ImageEnrichmentService])
], ImageEnrichmentController);
//# sourceMappingURL=image-enrichment.controller.js.map