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
exports.MotorsIntelligenceController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const event_emitter_1 = require("@nestjs/event-emitter");
const motors_intelligence_service_1 = require("../services/motors-intelligence.service");
const ebay_enrichment_service_1 = require("../services/ebay-enrichment.service");
const storage_service_1 = require("../../storage/storage.service");
const dto_1 = require("../dto");
const entities_1 = require("../entities");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const require_permissions_decorator_js_1 = require("../../rbac/decorators/require-permissions.decorator.js");
const current_user_decorator_js_1 = require("../../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../../auth/entities/user.entity.js");
let MotorsIntelligenceController = class MotorsIntelligenceController {
    motorsService;
    ebayEnrichmentService;
    storageService;
    eventEmitter;
    pipelineQueue;
    constructor(motorsService, ebayEnrichmentService, storageService, eventEmitter, pipelineQueue) {
        this.motorsService = motorsService;
        this.ebayEnrichmentService = ebayEnrichmentService;
        this.storageService = storageService;
        this.eventEmitter = eventEmitter;
        this.pipelineQueue = pipelineQueue;
    }
    async uploadImages(dto, user) {
        const product = await this.motorsService.createProduct({
            sourceType: entities_1.MotorsSourceType.IMAGE_UPLOAD,
            brand: dto.brand || null,
            mpn: dto.mpn || null,
            productType: dto.productType || null,
            condition: dto.condition || 'New',
            price: dto.price || null,
            quantity: dto.quantity || null,
            sourcePayload: {
                files: dto.files,
                autoRunPipeline: dto.autoRunPipeline ?? true,
            },
        }, user.id);
        const uploadUrls = await Promise.all(dto.files.map(async (file) => {
            const result = await this.storageService.generateUploadUrl(`motors-${product.id}-${file.fileName}`, file.mimeType);
            return {
                fileName: file.fileName,
                uploadUrl: result.uploadUrl,
                key: result.s3Key,
            };
        }));
        return {
            motorsProductId: product.id,
            uploadUrls,
            status: 'awaiting_upload',
        };
    }
    async confirmUpload(id, dto) {
        const imageUrls = dto.uploadedKeys.map((key) => this.storageService.getCdnUrl(key));
        await this.motorsService.updateProduct(id, {
            imageUrls,
        });
        let pipelineStarted = false;
        if (dto.autoRunPipeline !== false) {
            await this.pipelineQueue.add('process', {
                motorsProductId: id,
                stage: 'full',
            }, {
                priority: 1,
                attempts: 2,
                backoff: { type: 'exponential', delay: 5000 },
            });
            pipelineStarted = true;
        }
        return {
            motorsProductId: id,
            imageUrls,
            pipelineStarted,
            status: pipelineStarted ? 'pipeline_queued' : 'images_confirmed',
        };
    }
    async streamProgress(id, res) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        const TERMINAL_STATUSES = new Set([
            entities_1.MotorsProductStatus.APPROVED,
            entities_1.MotorsProductStatus.PUBLISHED,
            entities_1.MotorsProductStatus.FAILED,
            entities_1.MotorsProductStatus.REJECTED,
            entities_1.MotorsProductStatus.REVIEW_REQUIRED,
        ]);
        const STAGE_MAP = {
            [entities_1.MotorsProductStatus.PENDING]: {
                stage: 'upload',
                label: 'Upload Complete',
                order: 0,
            },
            [entities_1.MotorsProductStatus.EXTRACTING]: {
                stage: 'extraction',
                label: 'AI Vision Analysis',
                order: 1,
            },
            [entities_1.MotorsProductStatus.IDENTIFYING]: {
                stage: 'identity',
                label: 'Product Identification',
                order: 2,
            },
            [entities_1.MotorsProductStatus.RESOLVING_FITMENT]: {
                stage: 'fitment',
                label: 'Fitment Resolution',
                order: 3,
            },
            [entities_1.MotorsProductStatus.GENERATING_LISTING]: {
                stage: 'listing',
                label: 'Listing Generation',
                order: 4,
            },
            [entities_1.MotorsProductStatus.VALIDATING]: {
                stage: 'compliance',
                label: 'Compliance Check',
                order: 5,
            },
            [entities_1.MotorsProductStatus.APPROVED]: {
                stage: 'complete',
                label: 'Ready to Publish',
                order: 6,
            },
            [entities_1.MotorsProductStatus.REVIEW_REQUIRED]: {
                stage: 'review',
                label: 'Review Required',
                order: 6,
            },
            [entities_1.MotorsProductStatus.PUBLISHED]: {
                stage: 'published',
                label: 'Published',
                order: 7,
            },
            [entities_1.MotorsProductStatus.FAILED]: {
                stage: 'failed',
                label: 'Failed',
                order: -1,
            },
        };
        const ALL_STAGES = [
            'upload',
            'extraction',
            'identity',
            'fitment',
            'listing',
            'compliance',
            'complete',
        ];
        const buildProgress = (product) => {
            const statusInfo = STAGE_MAP[product.status] || {
                stage: 'unknown',
                label: product.status,
                order: -1,
            };
            const currentOrder = statusInfo.order;
            const stages = ALL_STAGES.map((stage, idx) => {
                let status = 'pending';
                if (idx < currentOrder)
                    status = 'completed';
                else if (idx === currentOrder && !TERMINAL_STATUSES.has(product.status))
                    status = 'running';
                else if (idx === currentOrder &&
                    product.status === entities_1.MotorsProductStatus.APPROVED)
                    status = 'completed';
                else if (product.status === entities_1.MotorsProductStatus.FAILED &&
                    idx === currentOrder)
                    status = 'failed';
                const stageLabels = {
                    upload: 'Upload Complete',
                    extraction: 'AI Vision Analysis',
                    identity: 'Product Identification',
                    fitment: 'Fitment Resolution',
                    listing: 'Listing Generation',
                    compliance: 'Compliance Check',
                    complete: 'Ready to Publish',
                };
                return {
                    stage,
                    label: stageLabels[stage] || stage,
                    status,
                };
            });
            return {
                motorsProductId: product.id,
                overallStatus: product.status,
                currentStage: statusInfo.stage,
                stages,
                confidence: {
                    identity: product.identityConfidence
                        ? Number(product.identityConfidence)
                        : null,
                    fitment: product.fitmentConfidence
                        ? Number(product.fitmentConfidence)
                        : null,
                    compliance: product.complianceConfidence
                        ? Number(product.complianceConfidence)
                        : null,
                    content: product.contentQualityScore
                        ? Number(product.contentQualityScore)
                        : null,
                },
                completedAt: TERMINAL_STATUSES.has(product.status)
                    ? new Date().toISOString()
                    : undefined,
            };
        };
        let lastStatus = '';
        let consecutiveErrors = 0;
        const maxErrors = 5;
        const pollInterval = setInterval(async () => {
            try {
                const product = await this.motorsService.getProduct(id);
                consecutiveErrors = 0;
                if (product.status !== lastStatus) {
                    lastStatus = product.status;
                    const progress = buildProgress(product);
                    res.write(`data: ${JSON.stringify(progress)}\n\n`);
                }
                if (TERMINAL_STATUSES.has(product.status)) {
                    clearInterval(pollInterval);
                    res.write(`data: ${JSON.stringify({ ...buildProgress(product), done: true })}\n\n`);
                    res.end();
                }
            }
            catch (err) {
                consecutiveErrors++;
                if (consecutiveErrors >= maxErrors) {
                    clearInterval(pollInterval);
                    res.write(`data: ${JSON.stringify({ error: 'Product not found or polling failed' })}\n\n`);
                    res.end();
                }
            }
        }, 1000);
        res.on('close', () => {
            clearInterval(pollInterval);
        });
    }
    async enrichProduct(id) {
        return this.ebayEnrichmentService.enrichProduct(id);
    }
    async createProduct(dto, user) {
        return this.motorsService.createProduct(dto, user.id);
    }
    async batchCreate(dto, user) {
        return this.motorsService.batchCreateProducts(dto.products, user.id);
    }
    async listProducts(query) {
        return this.motorsService.listProducts(query);
    }
    async getProduct(id) {
        return this.motorsService.getProduct(id);
    }
    async updateProduct(id, dto) {
        return this.motorsService.updateProduct(id, dto);
    }
    async deleteProduct(id) {
        return this.motorsService.deleteProduct(id);
    }
    async runPipeline(id) {
        return this.motorsService.runPipeline(id);
    }
    async publish(id, connectionId) {
        return this.motorsService.publish(id, connectionId);
    }
    async getStats() {
        return this.motorsService.getStats();
    }
};
exports.MotorsIntelligenceController = MotorsIntelligenceController;
__decorate([
    (0, common_1.Post)('products/upload-images'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motors.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Start image-based product creation with presigned S3 URLs',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ImageUploadRequestDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], MotorsIntelligenceController.prototype, "uploadImages", null);
__decorate([
    (0, common_1.Post)('products/:id/confirm-upload'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motors.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Confirm images uploaded to S3, optionally start pipeline',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.ConfirmUploadDto]),
    __metadata("design:returntype", Promise)
], MotorsIntelligenceController.prototype, "confirmUpload", null);
__decorate([
    (0, common_1.Get)('products/:id/progress'),
    (0, swagger_1.ApiOperation)({ summary: 'Stream pipeline progress via Server-Sent Events' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MotorsIntelligenceController.prototype, "streamProgress", null);
__decorate([
    (0, common_1.Post)('products/:id/enrich'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motors.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Run eBay enrichment (category + aspects) for a product',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MotorsIntelligenceController.prototype, "enrichProduct", null);
__decorate([
    (0, common_1.Post)('products'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motors.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new Motors product and start pipeline' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateMotorsProductDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], MotorsIntelligenceController.prototype, "createProduct", null);
__decorate([
    (0, common_1.Post)('products/batch'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motors.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Batch create Motors products' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.BatchCreateMotorsProductDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], MotorsIntelligenceController.prototype, "batchCreate", null);
__decorate([
    (0, common_1.Get)('products'),
    (0, swagger_1.ApiOperation)({ summary: 'List Motors products with filters' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.MotorsProductQueryDto]),
    __metadata("design:returntype", Promise)
], MotorsIntelligenceController.prototype, "listProducts", null);
__decorate([
    (0, common_1.Get)('products/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a single Motors product by ID' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MotorsIntelligenceController.prototype, "getProduct", null);
__decorate([
    (0, common_1.Patch)('products/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motors.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a Motors product' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateMotorsProductDto]),
    __metadata("design:returntype", Promise)
], MotorsIntelligenceController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Delete)('products/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motors.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Soft-delete a Motors product' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MotorsIntelligenceController.prototype, "deleteProduct", null);
__decorate([
    (0, common_1.Post)('products/:id/run-pipeline'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motors.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Re-run the full pipeline for a product' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MotorsIntelligenceController.prototype, "runPipeline", null);
__decorate([
    (0, common_1.Post)('products/:id/publish'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motors.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Publish a Motors product to eBay' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)('connectionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MotorsIntelligenceController.prototype, "publish", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Motors Intelligence pipeline statistics' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MotorsIntelligenceController.prototype, "getStats", null);
exports.MotorsIntelligenceController = MotorsIntelligenceController = __decorate([
    (0, swagger_1.ApiTags)('Motors Intelligence'),
    (0, common_1.Controller)('motors-intelligence'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motors.view'),
    __param(4, (0, bullmq_1.InjectQueue)('motors-pipeline')),
    __metadata("design:paramtypes", [motors_intelligence_service_1.MotorsIntelligenceService,
        ebay_enrichment_service_1.EbayEnrichmentService,
        storage_service_1.StorageService,
        event_emitter_1.EventEmitter2,
        bullmq_2.Queue])
], MotorsIntelligenceController);
//# sourceMappingURL=motors-intelligence.controller.js.map