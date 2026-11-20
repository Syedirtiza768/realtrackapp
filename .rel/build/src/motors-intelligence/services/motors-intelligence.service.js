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
var MotorsIntelligenceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotorsIntelligenceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const entities_1 = require("../entities");
const vision_extraction_service_1 = require("./vision-extraction.service");
const product_identity_service_1 = require("./product-identity.service");
const fitment_resolver_service_1 = require("./fitment-resolver.service");
const listing_generator_service_1 = require("./listing-generator.service");
const compliance_engine_service_1 = require("./compliance-engine.service");
const review_queue_service_1 = require("./review-queue.service");
const motors_publisher_service_1 = require("./motors-publisher.service");
const feature_flag_service_1 = require("../../common/feature-flags/feature-flag.service");
const AUTO_PUBLISH_THRESHOLDS = {
    identityConfidence: 0.85,
    fitmentConfidence: 0.7,
    complianceScore: 0.8,
    contentQuality: 0.75,
};
let MotorsIntelligenceService = MotorsIntelligenceService_1 = class MotorsIntelligenceService {
    motorsProductRepo;
    visionExtractionService;
    productIdentityService;
    fitmentResolverService;
    listingGeneratorService;
    complianceEngineService;
    reviewQueueService;
    motorsPublisherService;
    featureFlagService;
    configService;
    logger = new common_1.Logger(MotorsIntelligenceService_1.name);
    constructor(motorsProductRepo, visionExtractionService, productIdentityService, fitmentResolverService, listingGeneratorService, complianceEngineService, reviewQueueService, motorsPublisherService, featureFlagService, configService) {
        this.motorsProductRepo = motorsProductRepo;
        this.visionExtractionService = visionExtractionService;
        this.productIdentityService = productIdentityService;
        this.fitmentResolverService = fitmentResolverService;
        this.listingGeneratorService = listingGeneratorService;
        this.complianceEngineService = complianceEngineService;
        this.reviewQueueService = reviewQueueService;
        this.motorsPublisherService = motorsPublisherService;
        this.featureFlagService = featureFlagService;
        this.configService = configService;
    }
    async runPipeline(motorsProductId) {
        const product = await this.motorsProductRepo.findOneOrFail({
            where: { id: motorsProductId },
        });
        const result = {
            motorsProductId,
            status: product.status,
            identityConfidence: null,
            fitmentConfidence: null,
            complianceConfidence: null,
            publishable: false,
            reviewRequired: false,
            errors: [],
            warnings: [],
        };
        try {
            if (product.imageUrls?.length &&
                (await this.featureFlagService.isEnabled('motors_vision_extraction'))) {
                this.logger.log(`[${motorsProductId}] Starting vision extraction...`);
                product.status = entities_1.MotorsProductStatus.EXTRACTING;
                await this.motorsProductRepo.save(product);
                try {
                    await this.visionExtractionService.extractFromImages(motorsProductId, product.imageUrls);
                }
                catch (err) {
                    this.logger.warn(`Vision extraction failed: ${err.message}`);
                    result.warnings.push({
                        code: 'VISION_EXTRACTION_FAILED',
                        message: err.message,
                    });
                }
            }
            if (product.sourcePayload) {
                try {
                    await this.visionExtractionService.extractFromSupplierData(motorsProductId, product.sourcePayload);
                }
                catch (err) {
                    this.logger.warn(`Supplier extraction failed: ${err.message}`);
                }
            }
            this.logger.log(`[${motorsProductId}] Resolving product identity...`);
            product.status = entities_1.MotorsProductStatus.IDENTIFYING;
            await this.motorsProductRepo.save(product);
            const identityResult = await this.productIdentityService.resolveIdentity(motorsProductId);
            result.identityConfidence = identityResult.identityConfidence;
            if (identityResult.requiresReview) {
                for (const reason of identityResult.reviewReasons) {
                    const reviewReason = this.mapToReviewReason(reason);
                    if (reviewReason) {
                        await this.reviewQueueService.createReviewTask(motorsProductId, reviewReason, `Identity resolution: ${reason}`, {
                            candidatesSnapshot: identityResult.candidates.map((c) => ({
                                id: c.id,
                                brand: c.brand,
                                mpn: c.mpn,
                                source: c.source,
                                compositeScore: c.compositeScore,
                            })),
                        });
                        result.reviewRequired = true;
                        result.reviewTaskId = undefined;
                    }
                }
                if (identityResult.identityConfidence < 0.5) {
                    result.status = entities_1.MotorsProductStatus.REVIEW_REQUIRED;
                    return result;
                }
            }
            const updatedProduct = await this.motorsProductRepo.findOneOrFail({
                where: { id: motorsProductId },
            });
            if (await this.featureFlagService.isEnabled('motors_fitment_resolution')) {
                this.logger.log(`[${motorsProductId}] Resolving fitment...`);
                updatedProduct.status = entities_1.MotorsProductStatus.RESOLVING_FITMENT;
                await this.motorsProductRepo.save(updatedProduct);
                const fitmentResult = await this.fitmentResolverService.resolveFitment(motorsProductId);
                result.fitmentConfidence = fitmentResult.fitmentConfidence;
                if (!fitmentResult.resolved && updatedProduct.compatibilityRequired) {
                    await this.reviewQueueService.createReviewTask(motorsProductId, entities_1.ReviewTaskReason.MISSING_FITMENT, 'Fitment data required but not resolved', { fitmentSnapshot: fitmentResult.fitmentRows });
                    result.reviewRequired = true;
                }
                if (fitmentResult.errors.length > 0) {
                    result.errors.push(...fitmentResult.errors.map((e) => ({
                        code: 'FITMENT_ERROR',
                        message: e,
                    })));
                }
            }
            if (await this.featureFlagService.isEnabled('motors_listing_generation')) {
                this.logger.log(`[${motorsProductId}] Generating listing content...`);
                const reloaded = await this.motorsProductRepo.findOneOrFail({
                    where: { id: motorsProductId },
                });
                reloaded.status = entities_1.MotorsProductStatus.GENERATING_LISTING;
                await this.motorsProductRepo.save(reloaded);
                const input = {
                    brand: reloaded.brand || '',
                    mpn: reloaded.mpn || '',
                    productType: reloaded.productType || '',
                    placement: reloaded.placement || undefined,
                    material: reloaded.material || undefined,
                    finish: reloaded.finish || undefined,
                    includes: reloaded.includes || undefined,
                    features: reloaded.features || undefined,
                    condition: reloaded.condition || 'New',
                    compatibleVehicleSummary: reloaded.compatibleVehicleSummary || undefined,
                    categoryId: reloaded.ebayCategoryId || '',
                    requiredAspects: {},
                    forbiddenClaims: [],
                    titleCharLimit: 80,
                    dimensions: reloaded.dimensions || undefined,
                    quantityPerPack: reloaded.quantityPerPack || undefined,
                    sideOrientation: reloaded.sideOrientation || undefined,
                    frontRear: reloaded.frontRear || undefined,
                    oemPartNumber: reloaded.oemPartNumber || undefined,
                };
                try {
                    const generation = await this.listingGeneratorService.generateListing(motorsProductId, input);
                    reloaded.generatedTitle = generation.generatedTitle;
                    reloaded.generatedItemSpecifics = generation.generatedItemSpecifics;
                    reloaded.generatedBulletFeatures = generation.generatedBulletFeatures;
                    reloaded.generatedHtmlDescription =
                        generation.generatedHtmlDescription;
                    reloaded.generatedKeywordRationale = generation.keywordRationale;
                    reloaded.generatedSearchTags = generation.searchTags;
                    reloaded.contentQualityScore = generation.overallQualityScore;
                    await this.motorsProductRepo.save(reloaded);
                }
                catch (err) {
                    this.logger.error(`Listing generation failed: ${err.message}`);
                    result.errors.push({
                        code: 'GENERATION_FAILED',
                        message: err.message,
                    });
                }
            }
            if (await this.featureFlagService.isEnabled('motors_compliance_engine')) {
                this.logger.log(`[${motorsProductId}] Running compliance validation...`);
                const reloaded = await this.motorsProductRepo.findOneOrFail({
                    where: { id: motorsProductId },
                });
                reloaded.status = entities_1.MotorsProductStatus.VALIDATING;
                await this.motorsProductRepo.save(reloaded);
                const validationResult = await this.complianceEngineService.validateProduct(motorsProductId);
                result.complianceConfidence = validationResult.overallComplianceScore;
                result.publishable = validationResult.publishable;
                result.errors.push(...validationResult.errors);
                result.warnings.push(...validationResult.warnings);
                reloaded.complianceConfidence = validationResult.overallComplianceScore;
                if (validationResult.errors.length > 0) {
                    await this.reviewQueueService.createReviewTask(motorsProductId, entities_1.ReviewTaskReason.COMPLIANCE_FAILURE, `Compliance validation failed with ${validationResult.errors.length} errors`, { complianceSnapshot: validationResult });
                    result.reviewRequired = true;
                    reloaded.status = entities_1.MotorsProductStatus.REVIEW_REQUIRED;
                }
                else if (result.reviewRequired) {
                    reloaded.status = entities_1.MotorsProductStatus.REVIEW_REQUIRED;
                }
                else {
                    reloaded.status = entities_1.MotorsProductStatus.APPROVED;
                }
                await this.motorsProductRepo.save(reloaded);
            }
            if (result.publishable &&
                !result.reviewRequired &&
                (await this.featureFlagService.isEnabled('motors_auto_publish'))) {
                const final = await this.motorsProductRepo.findOneOrFail({
                    where: { id: motorsProductId },
                });
                if (this.meetsAutoPublishThresholds(final)) {
                    this.logger.log(`[${motorsProductId}] All thresholds met - marking for auto-publish`);
                    final.status = entities_1.MotorsProductStatus.APPROVED;
                    final.approvedAt = new Date();
                    final.approvedBy = 'system:auto_publish';
                    await this.motorsProductRepo.save(final);
                }
            }
            result.status = (await this.motorsProductRepo.findOneOrFail({
                where: { id: motorsProductId },
            })).status;
        }
        catch (error) {
            this.logger.error(`Pipeline failed for ${motorsProductId}: ${error.message}`, error.stack);
            const product = await this.motorsProductRepo.findOne({
                where: { id: motorsProductId },
            });
            if (product) {
                product.status = entities_1.MotorsProductStatus.FAILED;
                product.publishError = error.message;
                await this.motorsProductRepo.save(product);
            }
            result.status = entities_1.MotorsProductStatus.FAILED;
            result.errors.push({ code: 'PIPELINE_FAILED', message: error.message });
        }
        return result;
    }
    async getProduct(id) {
        return this.motorsProductRepo.findOneOrFail({ where: { id } });
    }
    async getProducts(query) {
        const qb = this.motorsProductRepo.createQueryBuilder('mp');
        if (query.status) {
            qb.andWhere('mp.status = :status', { status: query.status });
        }
        if (query.sourceType) {
            qb.andWhere('mp."sourceType" = :sourceType', {
                sourceType: query.sourceType,
            });
        }
        if (query.brand) {
            qb.andWhere('mp.brand ILIKE :brand', { brand: `%${query.brand}%` });
        }
        if (query.productType) {
            qb.andWhere('mp."productType" ILIKE :productType', {
                productType: `%${query.productType}%`,
            });
        }
        if (query.search) {
            qb.andWhere(`(mp.brand ILIKE :search OR mp.mpn ILIKE :search OR mp."productType" ILIKE :search OR mp."generatedTitle" ILIKE :search)`, { search: `%${query.search}%` });
        }
        qb.orderBy(`mp."${query.sortBy || 'createdAt'}"`, query.sortOrder || 'DESC');
        const total = await qb.getCount();
        const products = await qb
            .skip(query.offset || 0)
            .take(query.limit || 50)
            .getMany();
        return { products, total };
    }
    async listProducts(query) {
        const page = Number(query.page || 1);
        const limit = Number(query.limit || 25);
        const result = await this.getProducts({
            ...query,
            offset: (page - 1) * limit,
            limit,
        });
        return { items: result.products, total: result.total };
    }
    async batchCreateProducts(products, actorId) {
        const created = [];
        for (const data of products) {
            created.push(await this.createProduct(data, actorId));
        }
        return created;
    }
    async deleteProduct(id) {
        const product = await this.motorsProductRepo.findOneOrFail({
            where: { id },
        });
        await this.motorsProductRepo.softRemove(product);
    }
    async publish(motorsProductId, connectionId) {
        return this.motorsPublisherService.publishToEbay(motorsProductId, connectionId);
    }
    async createProduct(data, actorId) {
        const { createdBy: _ignored, ...rest } = data;
        if (rest.mpn) {
            rest.mpnNormalized = rest.mpn
                .toUpperCase()
                .replace(/[-–—.\s]/g, '')
                .trim();
        }
        if (rest.brand) {
            rest.brandNormalized = rest.brand.toLowerCase().replace(/[^a-z0-9]/g, '');
        }
        const product = this.motorsProductRepo.create({
            ...rest,
            createdBy: actorId ?? null,
        });
        return this.motorsProductRepo.save(product);
    }
    async updateProduct(id, data) {
        const product = await this.motorsProductRepo.findOneOrFail({
            where: { id },
        });
        if (data.mpn) {
            data.mpnNormalized = data.mpn
                .toUpperCase()
                .replace(/[-–—.\s]/g, '')
                .trim();
        }
        if (data.brand) {
            data.brandNormalized = data.brand.toLowerCase().replace(/[^a-z0-9]/g, '');
        }
        Object.assign(product, data);
        return this.motorsProductRepo.save(product);
    }
    async getStats() {
        const statusCounts = await this.motorsProductRepo
            .createQueryBuilder('mp')
            .select('mp.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .groupBy('mp.status')
            .getRawMany();
        const sourceTypeCounts = await this.motorsProductRepo
            .createQueryBuilder('mp')
            .select('mp."sourceType"', 'sourceType')
            .addSelect('COUNT(*)', 'count')
            .groupBy('mp."sourceType"')
            .getRawMany();
        const avgConfidence = await this.motorsProductRepo
            .createQueryBuilder('mp')
            .select('AVG(mp."identityConfidence")', 'avgIdentity')
            .addSelect('AVG(mp."fitmentConfidence")', 'avgFitment')
            .addSelect('AVG(mp."complianceConfidence")', 'avgCompliance')
            .addSelect('AVG(mp."contentQualityScore")', 'avgQuality')
            .where('mp.status NOT IN (:...excluded)', {
            excluded: [entities_1.MotorsProductStatus.PENDING, entities_1.MotorsProductStatus.FAILED],
        })
            .getRawOne();
        return {
            byStatus: statusCounts,
            bySourceType: sourceTypeCounts,
            averageConfidence: avgConfidence,
            total: await this.motorsProductRepo.count(),
        };
    }
    meetsAutoPublishThresholds(product) {
        return (Number(product.identityConfidence || 0) >=
            AUTO_PUBLISH_THRESHOLDS.identityConfidence &&
            Number(product.fitmentConfidence || 0) >=
                AUTO_PUBLISH_THRESHOLDS.fitmentConfidence &&
            Number(product.complianceConfidence || 0) >=
                AUTO_PUBLISH_THRESHOLDS.complianceScore &&
            Number(product.contentQualityScore || 0) >=
                AUTO_PUBLISH_THRESHOLDS.contentQuality);
    }
    mapToReviewReason(reason) {
        const mapping = {
            multiple_identities: entities_1.ReviewTaskReason.MULTIPLE_IDENTITIES,
            low_confidence: entities_1.ReviewTaskReason.LOW_CONFIDENCE,
            brand_ambiguity: entities_1.ReviewTaskReason.BRAND_AMBIGUITY,
            quantity_ambiguity: entities_1.ReviewTaskReason.QUANTITY_AMBIGUITY,
            side_orientation_conflict: entities_1.ReviewTaskReason.SIDE_ORIENTATION_CONFLICT,
            front_rear_conflict: entities_1.ReviewTaskReason.FRONT_REAR_CONFLICT,
            ocr_conflict: entities_1.ReviewTaskReason.OCR_CONFLICT,
            image_only: entities_1.ReviewTaskReason.IMAGE_ONLY,
        };
        return mapping[reason] || null;
    }
};
exports.MotorsIntelligenceService = MotorsIntelligenceService;
exports.MotorsIntelligenceService = MotorsIntelligenceService = MotorsIntelligenceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.MotorsProduct)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        vision_extraction_service_1.VisionExtractionService,
        product_identity_service_1.ProductIdentityService,
        fitment_resolver_service_1.FitmentResolverService,
        listing_generator_service_1.ListingGeneratorService,
        compliance_engine_service_1.ComplianceEngineService,
        review_queue_service_1.ReviewQueueService,
        motors_publisher_service_1.MotorsPublisherService,
        feature_flag_service_1.FeatureFlagService,
        config_1.ConfigService])
], MotorsIntelligenceService);
//# sourceMappingURL=motors-intelligence.service.js.map