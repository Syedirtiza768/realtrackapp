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
var ProductIdentityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductIdentityService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../entities");
const catalog_product_entity_1 = require("../../catalog-import/entities/catalog-product.entity");
const IDENTITY_WEIGHTS = {
    exactMpn: 0.35,
    brandMatch: 0.2,
    ocrMpn: 0.15,
    visualFamily: 0.1,
    dimensionMatch: 0.1,
    supplierDescSimilarity: 0.05,
    fitmentConsistency: 0.05,
};
const CONFIDENCE_THRESHOLDS = {
    AUTO_APPROVE: 0.85,
    REVIEW_REQUIRED: 0.6,
    REJECT: 0.3,
};
let ProductIdentityService = ProductIdentityService_1 = class ProductIdentityService {
    motorsProductRepo;
    candidateRepo;
    extractedAttrRepo;
    catalogProductRepo;
    correctionRuleRepo;
    logger = new common_1.Logger(ProductIdentityService_1.name);
    constructor(motorsProductRepo, candidateRepo, extractedAttrRepo, catalogProductRepo, correctionRuleRepo) {
        this.motorsProductRepo = motorsProductRepo;
        this.candidateRepo = candidateRepo;
        this.extractedAttrRepo = extractedAttrRepo;
        this.catalogProductRepo = catalogProductRepo;
        this.correctionRuleRepo = correctionRuleRepo;
    }
    async resolveIdentity(motorsProductId) {
        const product = await this.motorsProductRepo.findOneOrFail({
            where: { id: motorsProductId },
        });
        const extractions = await this.extractedAttrRepo.find({
            where: { motorsProductId },
            order: { createdAt: 'DESC' },
        });
        const signals = this.mergeExtractionSignals(extractions);
        let candidates = await this.deterministicResolution(motorsProductId, signals);
        if (candidates.length === 0 && extractions.length > 0) {
            candidates = await this.aiAssistedCandidateGeneration(motorsProductId, signals, extractions);
        }
        for (const candidate of candidates) {
            candidate.compositeScore = this.computeCompositeScore(candidate);
        }
        candidates.sort((a, b) => Number(b.compositeScore) - Number(a.compositeScore));
        candidates.forEach((c, i) => {
            c.rank = i + 1;
        });
        const savedCandidates = await this.candidateRepo.save(candidates);
        const validationResult = this.applyValidationGates(savedCandidates, signals);
        if (validationResult.resolved && validationResult.winner) {
            validationResult.winner.status = entities_1.CandidateStatus.SELECTED;
            await this.candidateRepo.save(validationResult.winner);
            await this.applyWinnerToProduct(product, validationResult.winner);
        }
        return validationResult;
    }
    mergeExtractionSignals(extractions) {
        const signals = {
            brands: [],
            mpns: [],
            oemNumbers: [],
            productTypes: [],
            productFamilies: [],
            placements: [],
            conditions: [],
            sideOrientations: [],
            frontRears: [],
            features: [],
            fitmentRaw: [],
            dimensions: null,
        };
        for (const ext of extractions) {
            if (ext.extractedBrand)
                signals.brands.push(ext.extractedBrand);
            if (ext.extractedMpn)
                signals.mpns.push(ext.extractedMpn);
            if (ext.extractedOemNumber)
                signals.oemNumbers.push(ext.extractedOemNumber);
            if (ext.extractedProductType)
                signals.productTypes.push(ext.extractedProductType);
            if (ext.extractedProductFamily)
                signals.productFamilies.push(ext.extractedProductFamily);
            if (ext.extractedPlacement)
                signals.placements.push(ext.extractedPlacement);
            if (ext.extractedCondition)
                signals.conditions.push(ext.extractedCondition);
            if (ext.extractedSideOrientation)
                signals.sideOrientations.push(ext.extractedSideOrientation);
            if (ext.extractedFrontRear)
                signals.frontRears.push(ext.extractedFrontRear);
            if (ext.extractedFeatures)
                signals.features.push(...ext.extractedFeatures);
            if (ext.extractedFitmentRaw)
                signals.fitmentRaw.push(...ext.extractedFitmentRaw);
            if (ext.extractedDimensions && !signals.dimensions) {
                signals.dimensions = ext.extractedDimensions;
            }
            if (ext.normalizedOutput) {
                if (ext.normalizedOutput.brand)
                    signals.brands.push(ext.normalizedOutput.brand);
                if (ext.normalizedOutput.mpn)
                    signals.mpns.push(ext.normalizedOutput.mpn);
                if (ext.normalizedOutput.productType)
                    signals.productTypes.push(ext.normalizedOutput.productType);
            }
        }
        signals.brands = [...new Set(signals.brands)];
        signals.mpns = [...new Set(signals.mpns)];
        signals.oemNumbers = [...new Set(signals.oemNumbers)];
        signals.productTypes = [...new Set(signals.productTypes)];
        signals.productFamilies = [...new Set(signals.productFamilies)];
        signals.placements = [...new Set(signals.placements)];
        signals.conditions = [...new Set(signals.conditions)];
        return signals;
    }
    async deterministicResolution(motorsProductId, signals) {
        const candidates = [];
        for (const mpn of signals.mpns) {
            const normalized = this.normalizeMpn(mpn);
            const catalogMatches = await this.catalogProductRepo.find({
                where: { mpnNormalized: normalized },
                take: 5,
            });
            for (const match of catalogMatches) {
                const candidate = this.candidateRepo.create({
                    motorsProductId,
                    brand: match.brand,
                    mpn: match.mpn,
                    mpnNormalized: match.mpnNormalized,
                    oemPartNumber: match.oemPartNumber,
                    productType: match.partType,
                    placement: match.placement,
                    condition: match.conditionLabel,
                    source: 'internal_sku',
                    sourceReference: match.id,
                    exactMpnScore: normalized === match.mpnNormalized ? 1.0 : 0.0,
                    brandMatchScore: this.scoreBrandMatch(signals.brands, match.brand),
                    candidateData: {
                        catalogProductId: match.id,
                        sku: match.sku,
                        title: match.title,
                        categoryId: match.categoryId,
                        imageUrls: match.imageUrls,
                        fitmentData: match.fitmentData,
                    },
                });
                candidates.push(candidate);
            }
        }
        if (candidates.length === 0) {
            for (const mpn of signals.mpns) {
                const prefixMatches = await this.catalogProductRepo
                    .createQueryBuilder('cp')
                    .where(`cp."mpnNormalized" LIKE :pattern`, {
                    pattern: `${this.normalizeMpn(mpn)}%`,
                })
                    .limit(5)
                    .getMany();
                for (const match of prefixMatches) {
                    const candidate = this.candidateRepo.create({
                        motorsProductId,
                        brand: match.brand,
                        mpn: match.mpn,
                        mpnNormalized: match.mpnNormalized,
                        oemPartNumber: match.oemPartNumber,
                        productType: match.partType,
                        placement: match.placement,
                        condition: match.conditionLabel,
                        source: 'supplier_mpn',
                        sourceReference: match.id,
                        exactMpnScore: 0.7,
                        brandMatchScore: this.scoreBrandMatch(signals.brands, match.brand),
                        candidateData: {
                            catalogProductId: match.id,
                            sku: match.sku,
                            title: match.title,
                        },
                    });
                    candidates.push(candidate);
                }
            }
        }
        for (const oem of signals.oemNumbers) {
            const oemMatches = await this.catalogProductRepo.find({
                where: { oemPartNumber: (0, typeorm_2.ILike)(`%${oem}%`) },
                take: 5,
            });
            for (const match of oemMatches) {
                const exists = candidates.some((c) => c.mpnNormalized === match.mpnNormalized &&
                    c.source !== 'oem_interchange');
                if (!exists) {
                    const candidate = this.candidateRepo.create({
                        motorsProductId,
                        brand: match.brand,
                        mpn: match.mpn,
                        mpnNormalized: match.mpnNormalized,
                        oemPartNumber: match.oemPartNumber,
                        productType: match.partType,
                        source: 'oem_interchange',
                        sourceReference: match.id,
                        exactMpnScore: 0.5,
                        brandMatchScore: this.scoreBrandMatch(signals.brands, match.brand),
                        candidateData: {
                            catalogProductId: match.id,
                            matchedOem: oem,
                        },
                    });
                    candidates.push(candidate);
                }
            }
        }
        return candidates;
    }
    async aiAssistedCandidateGeneration(motorsProductId, signals, extractions) {
        const candidates = [];
        const bestExtraction = extractions[0];
        if (bestExtraction) {
            const brandQuery = signals.brands[0];
            const typeQuery = signals.productTypes[0];
            if (brandQuery || typeQuery) {
                const qb = this.catalogProductRepo.createQueryBuilder('cp');
                if (brandQuery) {
                    qb.andWhere(`cp."brandNormalized" ILIKE :brand`, {
                        brand: `%${brandQuery.toLowerCase()}%`,
                    });
                }
                if (typeQuery) {
                    qb.andWhere(`(cp."partType" ILIKE :type OR cp."title" ILIKE :typeTitle)`, {
                        type: `%${typeQuery}%`,
                        typeTitle: `%${typeQuery}%`,
                    });
                }
                const matches = await qb.limit(10).getMany();
                for (const match of matches) {
                    const candidate = this.candidateRepo.create({
                        motorsProductId,
                        brand: match.brand,
                        mpn: match.mpn,
                        mpnNormalized: match.mpnNormalized,
                        oemPartNumber: match.oemPartNumber,
                        productType: match.partType,
                        placement: match.placement,
                        source: 'ai_vision',
                        sourceReference: bestExtraction.id,
                        exactMpnScore: this.scoreMpnSimilarity(signals.mpns, match.mpnNormalized),
                        brandMatchScore: this.scoreBrandMatch(signals.brands, match.brand),
                        ocrMpnScore: bestExtraction.confidenceScores?.mpn || 0,
                        visualFamilyScore: this.scoreProductTypeSimilarity(signals.productTypes, match.partType),
                        candidateData: {
                            catalogProductId: match.id,
                            sku: match.sku,
                            title: match.title,
                        },
                    });
                    candidates.push(candidate);
                }
            }
        }
        return candidates;
    }
    applyValidationGates(candidates, signals) {
        const reviewReasons = [];
        if (candidates.length === 0) {
            return {
                resolved: false,
                candidates: [],
                winner: null,
                identityConfidence: 0,
                requiresReview: true,
                reviewReasons: ['No candidates found'],
            };
        }
        const topCandidate = candidates[0];
        const confidence = Number(topCandidate.compositeScore);
        if (candidates.length > 1) {
            const secondBest = Number(candidates[1].compositeScore);
            if (confidence - secondBest < 0.15) {
                reviewReasons.push('multiple_identities');
            }
        }
        if (confidence < CONFIDENCE_THRESHOLDS.REVIEW_REQUIRED) {
            reviewReasons.push('low_confidence');
        }
        if (signals.brands.length > 1) {
            const uniqueBrands = signals.brands
                .map((b) => b.toLowerCase())
                .filter((b, i, a) => a.indexOf(b) === i);
            if (uniqueBrands.length > 1) {
                reviewReasons.push('brand_ambiguity');
            }
        }
        if (signals.conditions?.length > 1) {
            reviewReasons.push('quantity_ambiguity');
        }
        if (signals.sideOrientations?.length > 1) {
            const unique = [
                ...new Set(signals.sideOrientations.map((s) => s.toLowerCase())),
            ];
            if (unique.length > 1) {
                reviewReasons.push('side_orientation_conflict');
            }
        }
        if (signals.frontRears?.length > 1) {
            const unique = [
                ...new Set(signals.frontRears.map((s) => s.toLowerCase())),
            ];
            if (unique.length > 1) {
                reviewReasons.push('front_rear_conflict');
            }
        }
        const resolved = confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPROVE &&
            reviewReasons.length === 0;
        return {
            resolved,
            candidates,
            winner: resolved || confidence >= CONFIDENCE_THRESHOLDS.REVIEW_REQUIRED
                ? topCandidate
                : null,
            identityConfidence: confidence,
            requiresReview: reviewReasons.length > 0 ||
                confidence < CONFIDENCE_THRESHOLDS.AUTO_APPROVE,
            reviewReasons,
        };
    }
    async applyWinnerToProduct(product, winner) {
        product.brand = winner.brand;
        product.brandNormalized =
            winner.brand?.toLowerCase().replace(/[^a-z0-9]/g, '') || null;
        product.mpn = winner.mpn;
        product.mpnNormalized = winner.mpnNormalized;
        product.oemPartNumber = winner.oemPartNumber;
        product.productType = winner.productType;
        product.productFamily = winner.productFamily;
        product.placement = winner.placement;
        product.condition = winner.condition;
        product.identityConfidence = Number(winner.compositeScore);
        if (winner.candidateData?.catalogProductId) {
            const catalogProduct = await this.catalogProductRepo.findOne({
                where: { id: winner.candidateData.catalogProductId },
            });
            if (catalogProduct) {
                product.catalogProductId = catalogProduct.id;
                if (catalogProduct.categoryId) {
                    product.ebayCategoryId = catalogProduct.categoryId;
                    product.ebayCategoryName = catalogProduct.categoryName;
                }
                if (catalogProduct.imageUrls &&
                    (!product.imageUrls || product.imageUrls.length === 0)) {
                    product.imageUrls = catalogProduct.imageUrls;
                }
                if (catalogProduct.fitmentData) {
                    product.fitmentRows = catalogProduct.fitmentData;
                }
            }
        }
        await this.motorsProductRepo.save(product);
    }
    computeCompositeScore(candidate) {
        return Number((IDENTITY_WEIGHTS.exactMpn * Number(candidate.exactMpnScore) +
            IDENTITY_WEIGHTS.brandMatch * Number(candidate.brandMatchScore) +
            IDENTITY_WEIGHTS.ocrMpn * Number(candidate.ocrMpnScore) +
            IDENTITY_WEIGHTS.visualFamily * Number(candidate.visualFamilyScore) +
            IDENTITY_WEIGHTS.dimensionMatch *
                Number(candidate.dimensionMatchScore) +
            IDENTITY_WEIGHTS.supplierDescSimilarity *
                Number(candidate.supplierDescSimilarityScore) +
            IDENTITY_WEIGHTS.fitmentConsistency *
                Number(candidate.fitmentConsistencyScore)).toFixed(4));
    }
    normalizeMpn(mpn) {
        return mpn
            .toUpperCase()
            .replace(/[-–—.\s]/g, '')
            .replace(/O/g, '0')
            .replace(/I/g, '1')
            .trim();
    }
    scoreBrandMatch(extractedBrands, candidateBrand) {
        if (!candidateBrand || extractedBrands.length === 0)
            return 0;
        const normalized = candidateBrand.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const brand of extractedBrands) {
            const normalizedBrand = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalizedBrand === normalized)
                return 1.0;
            if (normalizedBrand.includes(normalized) ||
                normalized.includes(normalizedBrand))
                return 0.8;
        }
        return 0;
    }
    scoreMpnSimilarity(extractedMpns, candidateMpn) {
        if (!candidateMpn || extractedMpns.length === 0)
            return 0;
        const normalizedCandidate = this.normalizeMpn(candidateMpn);
        for (const mpn of extractedMpns) {
            const normalizedExtracted = this.normalizeMpn(mpn);
            if (normalizedExtracted === normalizedCandidate)
                return 1.0;
            if (normalizedCandidate.startsWith(normalizedExtracted) ||
                normalizedExtracted.startsWith(normalizedCandidate))
                return 0.7;
            if (this.roughSimilarity(normalizedExtracted, normalizedCandidate) > 0.85)
                return 0.6;
        }
        return 0;
    }
    scoreProductTypeSimilarity(extractedTypes, candidateType) {
        if (!candidateType || extractedTypes.length === 0)
            return 0;
        const normalizedCandidate = candidateType.toLowerCase();
        for (const type of extractedTypes) {
            const normalizedExtracted = type.toLowerCase();
            if (normalizedExtracted === normalizedCandidate)
                return 1.0;
            if (normalizedCandidate.includes(normalizedExtracted) ||
                normalizedExtracted.includes(normalizedCandidate))
                return 0.7;
        }
        return 0;
    }
    roughSimilarity(a, b) {
        if (a === b)
            return 1.0;
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;
        if (longer.length === 0)
            return 1.0;
        let matches = 0;
        for (let i = 0; i < shorter.length; i++) {
            if (shorter[i] === longer[i])
                matches++;
        }
        return matches / longer.length;
    }
};
exports.ProductIdentityService = ProductIdentityService;
exports.ProductIdentityService = ProductIdentityService = ProductIdentityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.MotorsProduct)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProductCandidate)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.ExtractedAttribute)),
    __param(3, (0, typeorm_1.InjectRepository)(catalog_product_entity_1.CatalogProduct)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.CorrectionRule)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ProductIdentityService);
//# sourceMappingURL=product-identity.service.js.map