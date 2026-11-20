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
var EbayEnrichmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayEnrichmentService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const entities_1 = require("../entities");
let EbayEnrichmentService = EbayEnrichmentService_1 = class EbayEnrichmentService {
    motorsProductRepo;
    categoryMappingRepo;
    aspectRepo;
    configService;
    logger = new common_1.Logger(EbayEnrichmentService_1.name);
    CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    constructor(motorsProductRepo, categoryMappingRepo, aspectRepo, configService) {
        this.motorsProductRepo = motorsProductRepo;
        this.categoryMappingRepo = categoryMappingRepo;
        this.aspectRepo = aspectRepo;
        this.configService = configService;
    }
    async enrichProduct(motorsProductId) {
        const product = await this.motorsProductRepo.findOneOrFail({
            where: { id: motorsProductId },
        });
        const errors = [];
        const warnings = [];
        let cached = false;
        let categoryId = product.ebayCategoryId;
        let categoryName = product.ebayCategoryName;
        if (!categoryId && product.productType) {
            const mapping = await this.categoryMappingRepo.findOne({
                where: {
                    productType: product.productType,
                    active: true,
                    isMotorsCategory: true,
                },
            });
            if (mapping && this.isCacheFresh(mapping.lastSyncedAt)) {
                categoryId = mapping.ebayCategoryId;
                categoryName = mapping.ebayCategoryName;
                cached = true;
                this.logger.debug(`Cache hit for product type "${product.productType}" → category ${categoryId}`);
            }
            else {
                const suggested = await this.suggestCategory(product);
                if (suggested) {
                    categoryId = suggested.categoryId;
                    categoryName = suggested.categoryName;
                    await this.upsertCategoryMapping(suggested.categoryId, suggested.categoryName, product.productType, suggested.supportsCompatibility, suggested.compatibilityProperties);
                }
                else {
                    warnings.push('Could not determine eBay category from product data');
                }
            }
        }
        if (categoryId && categoryId !== product.ebayCategoryId) {
            product.ebayCategoryId = categoryId;
            product.ebayCategoryName = categoryName;
            await this.motorsProductRepo.save(product);
        }
        let aspects = [];
        if (categoryId) {
            aspects = await this.aspectRepo.find({
                where: { ebayCategoryId: categoryId },
            });
            if (aspects.length === 0 || !this.isAspectCacheFresh(aspects)) {
                const fetched = await this.fetchCategoryAspects(categoryId);
                if (fetched.length > 0) {
                    await this.aspectRepo.delete({ ebayCategoryId: categoryId });
                    aspects = await this.aspectRepo.save(fetched);
                }
                else if (aspects.length === 0) {
                    warnings.push(`No aspect requirements found for category ${categoryId}`);
                }
            }
            else {
                cached = true;
            }
        }
        let compatibilityProperties = [];
        if (categoryId) {
            const mapping = await this.categoryMappingRepo.findOne({
                where: { ebayCategoryId: categoryId },
            });
            compatibilityProperties = mapping?.compatibilityProperties || [];
        }
        const confidence = this.calculateEnrichmentConfidence(categoryId, aspects, compatibilityProperties, product);
        return {
            categoryId,
            categoryName,
            aspects,
            compatibilityProperties,
            enrichmentConfidence: confidence,
            errors,
            warnings,
            cached,
        };
    }
    async suggestCategory(product) {
        const searchTerms = [
            product.productType,
            product.productFamily,
            product.brand,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        if (!searchTerms)
            return null;
        const mappings = await this.categoryMappingRepo
            .createQueryBuilder('m')
            .where('m.active = true')
            .andWhere('m."isMotorsCategory" = true')
            .getMany();
        let bestMatch = null;
        let bestScore = 0;
        for (const mapping of mappings) {
            let score = 0;
            if (mapping.productType && product.productType) {
                const mapType = mapping.productType.toLowerCase();
                const prodType = product.productType.toLowerCase();
                if (mapType === prodType)
                    score += 10;
                else if (mapType.includes(prodType) || prodType.includes(mapType))
                    score += 5;
            }
            if (mapping.keywords) {
                for (const kw of mapping.keywords) {
                    if (searchTerms.includes(kw.toLowerCase())) {
                        score += 3;
                    }
                }
            }
            if (mapping.ebayCategoryName) {
                const catName = mapping.ebayCategoryName.toLowerCase();
                if (searchTerms.includes(catName) ||
                    catName.includes(product.productType?.toLowerCase() || '---')) {
                    score += 4;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestMatch = mapping;
            }
        }
        if (bestMatch && bestScore >= 3) {
            return {
                categoryId: bestMatch.ebayCategoryId,
                categoryName: bestMatch.ebayCategoryName,
                supportsCompatibility: bestMatch.supportsCompatibility,
                compatibilityProperties: bestMatch.compatibilityProperties || [],
            };
        }
        const fallback = mappings.find((m) => m.ebayCategoryName?.includes('Other'));
        if (fallback) {
            return {
                categoryId: fallback.ebayCategoryId,
                categoryName: fallback.ebayCategoryName,
                supportsCompatibility: fallback.supportsCompatibility,
                compatibilityProperties: fallback.compatibilityProperties || [],
            };
        }
        return null;
    }
    async fetchCategoryAspects(categoryId) {
        const mapping = await this.categoryMappingRepo.findOne({
            where: { ebayCategoryId: categoryId },
        });
        const aspects = [
            {
                ebayCategoryId: categoryId,
                aspectName: 'Brand',
                requirementLevel: entities_1.AspectRequirementLevel.REQUIRED,
                dataType: 'TEXT',
                maxLength: 65,
            },
            {
                ebayCategoryId: categoryId,
                aspectName: 'Manufacturer Part Number',
                requirementLevel: entities_1.AspectRequirementLevel.REQUIRED,
                dataType: 'TEXT',
                maxLength: 65,
            },
            {
                ebayCategoryId: categoryId,
                aspectName: 'Placement on Vehicle',
                requirementLevel: entities_1.AspectRequirementLevel.RECOMMENDED,
                dataType: 'TEXT',
                maxLength: 65,
                allowedValues: [
                    'Front',
                    'Rear',
                    'Left',
                    'Right',
                    'Front Left',
                    'Front Right',
                    'Rear Left',
                    'Rear Right',
                    'Upper',
                    'Lower',
                ],
            },
            {
                ebayCategoryId: categoryId,
                aspectName: 'Warranty',
                requirementLevel: entities_1.AspectRequirementLevel.RECOMMENDED,
                dataType: 'TEXT',
                maxLength: 65,
                allowedValues: [
                    '1 Year',
                    '2 Year',
                    '3 Year',
                    'Lifetime',
                    'No Warranty',
                    'Unspecified',
                ],
            },
            {
                ebayCategoryId: categoryId,
                aspectName: 'Fitment Type',
                requirementLevel: entities_1.AspectRequirementLevel.RECOMMENDED,
                dataType: 'TEXT',
                allowedValues: ['Direct Replacement', 'Performance/Custom'],
            },
        ];
        if (mapping?.supportsCompatibility) {
            aspects.push({
                ebayCategoryId: categoryId,
                aspectName: 'OE/OEM Part Number',
                requirementLevel: entities_1.AspectRequirementLevel.RECOMMENDED,
                dataType: 'TEXT',
                maxLength: 65,
            });
        }
        const materialCategories = [
            'Brake Pad',
            'Brake Caliper',
            'Control Arm',
            'Wheel Hub',
            'Radiator',
        ];
        if (mapping?.productType &&
            materialCategories.includes(mapping.productType)) {
            aspects.push({
                ebayCategoryId: categoryId,
                aspectName: 'Material',
                requirementLevel: entities_1.AspectRequirementLevel.RECOMMENDED,
                dataType: 'TEXT',
                maxLength: 65,
            }, {
                ebayCategoryId: categoryId,
                aspectName: 'Finish',
                requirementLevel: entities_1.AspectRequirementLevel.RECOMMENDED,
                dataType: 'TEXT',
                maxLength: 65,
            });
        }
        return aspects.map((a) => this.aspectRepo.create(a));
    }
    async upsertCategoryMapping(categoryId, categoryName, productType, supportsCompatibility, compatibilityProperties) {
        const existing = await this.categoryMappingRepo.findOne({
            where: { ebayCategoryId: categoryId },
        });
        if (existing) {
            existing.ebayCategoryName = categoryName || existing.ebayCategoryName;
            existing.productType = productType || existing.productType;
            existing.supportsCompatibility = supportsCompatibility;
            existing.compatibilityProperties = compatibilityProperties;
            existing.lastSyncedAt = new Date();
            await this.categoryMappingRepo.save(existing);
        }
        else {
            await this.categoryMappingRepo.save(this.categoryMappingRepo.create({
                ebayCategoryId: categoryId,
                ebayCategoryName: categoryName || '',
                productType,
                isMotorsCategory: true,
                supportsCompatibility,
                compatibilityProperties,
                lastSyncedAt: new Date(),
            }));
        }
    }
    calculateEnrichmentConfidence(categoryId, aspects, compatibilityProperties, product) {
        let score = 0;
        if (categoryId)
            score += 0.4;
        if (aspects.length > 0)
            score += 0.3;
        if (product.brand && product.mpn)
            score += 0.2;
        if (compatibilityProperties.length > 0)
            score += 0.1;
        return Math.min(1, score);
    }
    isCacheFresh(lastSynced) {
        if (!lastSynced)
            return false;
        return Date.now() - new Date(lastSynced).getTime() < this.CACHE_TTL_MS;
    }
    isAspectCacheFresh(aspects) {
        if (aspects.length === 0)
            return false;
        const oldest = aspects.reduce((min, a) => a.createdAt && new Date(a.createdAt) < min
            ? new Date(a.createdAt)
            : min, new Date());
        return Date.now() - oldest.getTime() < this.CACHE_TTL_MS;
    }
};
exports.EbayEnrichmentService = EbayEnrichmentService;
exports.EbayEnrichmentService = EbayEnrichmentService = EbayEnrichmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.MotorsProduct)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.EbayCategoryMapping)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.EbayAspectRequirement)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService])
], EbayEnrichmentService);
//# sourceMappingURL=ebay-enrichment.service.js.map