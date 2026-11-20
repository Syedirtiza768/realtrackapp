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
var ComplianceEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceEngineService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../entities");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
const ai_run_log_service_js_1 = require("../../common/openai/ai-run-log.service.js");
const TITLE_MAX_LENGTH = 80;
const TITLE_FORBIDDEN_PATTERNS = [
    /\b(FREE SHIPPING|FREE S&H|FREE RETURNS)\b/gi,
    /\b(BEST PRICE|LOWEST PRICE|CHEAPEST)\b/gi,
    /\b(L@@K|LOOK|WOW|RARE FIND|MUST SEE|HOT)\b/gi,
    /!{2,}/g,
    /\b([A-Z]{10,})\b/g,
];
const FORBIDDEN_HTML_TAGS = [
    'script',
    'iframe',
    'embed',
    'object',
    'form',
    'input',
    'style',
    'link',
];
const PROHIBITED_CLAIMS = [
    'lifetime warranty',
    'guaranteed to fit',
    'fits all vehicles',
    'universal fit',
    'one size fits all',
    'OEM quality',
    'factory replacement',
];
let ComplianceEngineService = ComplianceEngineService_1 = class ComplianceEngineService {
    validationResultRepo;
    motorsProductRepo;
    categoryMappingRepo;
    aspectRequirementRepo;
    catalogProductRepo;
    aiRunLogService;
    logger = new common_1.Logger(ComplianceEngineService_1.name);
    constructor(validationResultRepo, motorsProductRepo, categoryMappingRepo, aspectRequirementRepo, catalogProductRepo, aiRunLogService) {
        this.validationResultRepo = validationResultRepo;
        this.motorsProductRepo = motorsProductRepo;
        this.categoryMappingRepo = categoryMappingRepo;
        this.aspectRequirementRepo = aspectRequirementRepo;
        this.catalogProductRepo = catalogProductRepo;
        this.aiRunLogService = aiRunLogService;
    }
    async validateProduct(motorsProductId) {
        const product = await this.motorsProductRepo.findOneOrFail({
            where: { id: motorsProductId },
        });
        const errors = [];
        const warnings = [];
        const infos = [];
        await this.validateCategory(product, errors, warnings);
        await this.validateItemSpecifics(product, errors, warnings, infos);
        this.validateFitment(product, errors, warnings);
        this.validateTitle(product, errors, warnings);
        this.validateHtml(product, errors, warnings);
        this.validateProhibitedClaims(product, errors, warnings);
        this.validateIdentity(product, errors, warnings);
        this.validateConfidence(product, errors, warnings);
        const duplicateResult = await this.detectDuplicates(product);
        const overallScore = this.calculateComplianceScore(errors, warnings, infos);
        const publishable = errors.length === 0 && overallScore >= 0.7;
        const validationResult = this.validationResultRepo.create({
            motorsProductId,
            publishable,
            errors,
            warnings,
            infos,
            duplicateDetected: duplicateResult.detected,
            duplicateOfListingId: duplicateResult.duplicateId,
            duplicateMatchType: duplicateResult.matchType,
            overallComplianceScore: overallScore,
            aspectCoverage: await this.getAspectCoverage(product),
            fullPayload: this.buildFullPayload(product),
        });
        const saved = await this.validationResultRepo.save(validationResult);
        if (product.catalogProductId) {
            const catalog = await this.catalogProductRepo.findOne({
                where: { id: product.catalogProductId },
            });
            if (catalog?.sku) {
                await this.aiRunLogService.recordComplianceOutcome(catalog.sku, overallScore);
            }
        }
        return saved;
    }
    async validateCategory(product, errors, warnings) {
        if (!product.ebayCategoryId) {
            errors.push({
                code: 'MISSING_CATEGORY',
                field: 'ebayCategoryId',
                message: 'eBay category ID is required',
                severity: entities_1.ValidationSeverity.ERROR,
                suggestion: 'Resolve the product type to determine appropriate eBay Motors category',
            });
            return;
        }
        const mapping = await this.categoryMappingRepo.findOne({
            where: { ebayCategoryId: product.ebayCategoryId },
        });
        if (!mapping) {
            warnings.push({
                code: 'UNKNOWN_CATEGORY',
                field: 'ebayCategoryId',
                message: `Category ${product.ebayCategoryId} not found in Motors category mappings`,
                severity: entities_1.ValidationSeverity.WARNING,
            });
        }
        else if (mapping.supportsCompatibility && !product.fitmentRows?.length) {
            warnings.push({
                code: 'MISSING_COMPATIBILITY',
                field: 'fitmentRows',
                message: 'This category supports vehicle compatibility but no fitment data provided',
                severity: entities_1.ValidationSeverity.WARNING,
                suggestion: 'Add fitment/compatibility data for better listing visibility',
            });
        }
    }
    async validateItemSpecifics(product, errors, warnings, infos) {
        if (!product.ebayCategoryId)
            return;
        const requirements = await this.aspectRequirementRepo.find({
            where: { ebayCategoryId: product.ebayCategoryId },
        });
        const specifics = product.generatedItemSpecifics || {};
        for (const req of requirements) {
            const value = specifics[req.aspectName];
            if (req.requirementLevel === entities_1.AspectRequirementLevel.REQUIRED && !value) {
                errors.push({
                    code: 'MISSING_REQUIRED_ASPECT',
                    field: req.aspectName,
                    message: `Required item specific "${req.aspectName}" is missing`,
                    severity: entities_1.ValidationSeverity.ERROR,
                    suggestion: req.defaultValue
                        ? `Default value: ${req.defaultValue}`
                        : undefined,
                });
            }
            else if (req.requirementLevel === entities_1.AspectRequirementLevel.RECOMMENDED &&
                !value) {
                warnings.push({
                    code: 'MISSING_RECOMMENDED_ASPECT',
                    field: req.aspectName,
                    message: `Recommended item specific "${req.aspectName}" is missing`,
                    severity: entities_1.ValidationSeverity.WARNING,
                });
            }
            if (value && req.allowedValues && req.allowedValues.length > 0) {
                if (!req.allowedValues.includes(value)) {
                    warnings.push({
                        code: 'INVALID_ASPECT_VALUE',
                        field: req.aspectName,
                        message: `Value "${value}" is not in the allowed values for "${req.aspectName}"`,
                        severity: entities_1.ValidationSeverity.WARNING,
                        suggestion: `Allowed values: ${req.allowedValues.slice(0, 5).join(', ')}...`,
                    });
                }
            }
            if (value && req.maxLength && value.length > req.maxLength) {
                errors.push({
                    code: 'ASPECT_TOO_LONG',
                    field: req.aspectName,
                    message: `Value for "${req.aspectName}" exceeds max length of ${req.maxLength}`,
                    severity: entities_1.ValidationSeverity.ERROR,
                });
            }
        }
    }
    validateFitment(product, errors, warnings) {
        if (!product.fitmentRows || product.fitmentRows.length === 0) {
            if (product.compatibilityRequired) {
                errors.push({
                    code: 'FITMENT_REQUIRED',
                    field: 'fitmentRows',
                    message: 'Vehicle compatibility data is required for this category',
                    severity: entities_1.ValidationSeverity.ERROR,
                });
            }
            return;
        }
        const seen = new Set();
        for (let i = 0; i < product.fitmentRows.length; i++) {
            const row = product.fitmentRows[i];
            if (!row.year && !row.yearStart) {
                warnings.push({
                    code: 'FITMENT_MISSING_YEAR',
                    field: `fitmentRows[${i}]`,
                    message: `Fitment row ${i + 1} is missing year information`,
                    severity: entities_1.ValidationSeverity.WARNING,
                });
            }
            if (!row.make) {
                warnings.push({
                    code: 'FITMENT_MISSING_MAKE',
                    field: `fitmentRows[${i}]`,
                    message: `Fitment row ${i + 1} is missing make`,
                    severity: entities_1.ValidationSeverity.WARNING,
                });
            }
            if (!row.model) {
                warnings.push({
                    code: 'FITMENT_MISSING_MODEL',
                    field: `fitmentRows[${i}]`,
                    message: `Fitment row ${i + 1} is missing model`,
                    severity: entities_1.ValidationSeverity.WARNING,
                });
            }
            const key = `${row.year || row.yearStart}-${row.make}-${row.model}-${row.submodel || ''}-${row.engine || ''}`;
            if (seen.has(key)) {
                warnings.push({
                    code: 'FITMENT_DUPLICATE_ROW',
                    field: `fitmentRows[${i}]`,
                    message: `Duplicate fitment row detected: ${key}`,
                    severity: entities_1.ValidationSeverity.WARNING,
                });
            }
            seen.add(key);
            const year = parseInt(row.year || row.yearStart, 10);
            if (year && (year < 1900 || year > new Date().getFullYear() + 2)) {
                errors.push({
                    code: 'FITMENT_INVALID_YEAR',
                    field: `fitmentRows[${i}]`,
                    message: `Invalid year ${year} in fitment row ${i + 1}`,
                    severity: entities_1.ValidationSeverity.ERROR,
                });
            }
        }
    }
    validateTitle(product, errors, warnings) {
        const title = product.generatedTitle;
        if (!title) {
            errors.push({
                code: 'MISSING_TITLE',
                field: 'generatedTitle',
                message: 'Listing title is required',
                severity: entities_1.ValidationSeverity.ERROR,
            });
            return;
        }
        if (title.length > TITLE_MAX_LENGTH) {
            errors.push({
                code: 'TITLE_TOO_LONG',
                field: 'generatedTitle',
                message: `Title is ${title.length} characters, max is ${TITLE_MAX_LENGTH}`,
                severity: entities_1.ValidationSeverity.ERROR,
                suggestion: 'Shorten the title while keeping key product identifiers',
            });
        }
        for (const pattern of TITLE_FORBIDDEN_PATTERNS) {
            if (pattern.test(title)) {
                warnings.push({
                    code: 'TITLE_FORBIDDEN_PATTERN',
                    field: 'generatedTitle',
                    message: `Title contains a forbidden pattern: ${pattern.source}`,
                    severity: entities_1.ValidationSeverity.WARNING,
                });
            }
        }
        if (!product.brand || !title.includes(product.brand)) {
            warnings.push({
                code: 'TITLE_MISSING_BRAND',
                field: 'generatedTitle',
                message: 'Title should include the brand name',
                severity: entities_1.ValidationSeverity.WARNING,
            });
        }
        if (!product.mpn || !title.includes(product.mpn)) {
            warnings.push({
                code: 'TITLE_MISSING_MPN',
                field: 'generatedTitle',
                message: 'Title should include the MPN for better search visibility',
                severity: entities_1.ValidationSeverity.WARNING,
            });
        }
        if (title.length < 40) {
            warnings.push({
                code: 'TITLE_CAN_BE_IMPROVED',
                field: 'generatedTitle',
                message: 'Title is short and may not use all available keyword space',
                severity: entities_1.ValidationSeverity.WARNING,
            });
        }
    }
    validateHtml(product, errors, warnings) {
        const html = product.generatedHtmlDescription;
        if (!html)
            return;
        for (const tag of FORBIDDEN_HTML_TAGS) {
            const pattern = new RegExp(`<${tag}[\\s>]`, 'gi');
            if (pattern.test(html)) {
                errors.push({
                    code: 'HTML_FORBIDDEN_TAG',
                    field: 'generatedHtmlDescription',
                    message: `HTML description contains forbidden tag: <${tag}>`,
                    severity: entities_1.ValidationSeverity.ERROR,
                });
            }
        }
        if (/src\s*=\s*["']https?:/i.test(html)) {
            warnings.push({
                code: 'HTML_EXTERNAL_RESOURCE',
                field: 'generatedHtmlDescription',
                message: 'HTML description references external resources',
                severity: entities_1.ValidationSeverity.WARNING,
            });
        }
    }
    validateProhibitedClaims(product, errors, warnings) {
        const textToCheck = [
            product.generatedTitle,
            product.generatedHtmlDescription,
            ...(product.generatedBulletFeatures || []),
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        for (const claim of PROHIBITED_CLAIMS) {
            if (textToCheck.includes(claim.toLowerCase())) {
                warnings.push({
                    code: 'PROHIBITED_CLAIM',
                    field: 'content',
                    message: `Content contains prohibited claim: "${claim}"`,
                    severity: entities_1.ValidationSeverity.WARNING,
                    suggestion: 'Remove or rephrase this claim to comply with eBay policies',
                });
            }
        }
    }
    validateIdentity(product, errors, warnings) {
        if (!product.brand) {
            errors.push({
                code: 'MISSING_BRAND',
                field: 'brand',
                message: 'Product brand is required',
                severity: entities_1.ValidationSeverity.ERROR,
            });
        }
        if (!product.mpn) {
            errors.push({
                code: 'MISSING_MPN',
                field: 'mpn',
                message: 'Manufacturer Part Number is required',
                severity: entities_1.ValidationSeverity.ERROR,
            });
        }
        if (!product.condition) {
            warnings.push({
                code: 'MISSING_CONDITION',
                field: 'condition',
                message: 'Product condition not specified',
                severity: entities_1.ValidationSeverity.WARNING,
            });
        }
    }
    validateConfidence(product, errors, warnings) {
        if (product.identityConfidence !== null &&
            Number(product.identityConfidence) < 0.6) {
            errors.push({
                code: 'LOW_IDENTITY_CONFIDENCE',
                field: 'identityConfidence',
                message: `Identity confidence (${product.identityConfidence}) is below threshold`,
                severity: entities_1.ValidationSeverity.ERROR,
            });
        }
        if (product.fitmentConfidence !== null &&
            Number(product.fitmentConfidence) < 0.5) {
            warnings.push({
                code: 'LOW_FITMENT_CONFIDENCE',
                field: 'fitmentConfidence',
                message: `Fitment confidence (${product.fitmentConfidence}) is below recommended threshold`,
                severity: entities_1.ValidationSeverity.WARNING,
            });
        }
    }
    async detectDuplicates(product) {
        if (product.brand && product.mpn) {
            const existing = await this.motorsProductRepo.findOne({
                where: {
                    brand: product.brand,
                    mpn: product.mpn,
                    status: 'published',
                },
            });
            if (existing && existing.id !== product.id) {
                return {
                    detected: true,
                    duplicateId: existing.id,
                    matchType: 'brand_mpn',
                };
            }
        }
        if (product.generatedTitle) {
            const similar = await this.motorsProductRepo
                .createQueryBuilder('mp')
                .where('mp.id != :id', { id: product.id })
                .andWhere(`mp."generatedTitle" ILIKE :title`, {
                title: `%${product.generatedTitle.substring(0, 40)}%`,
            })
                .andWhere(`mp.status = 'published'`)
                .limit(1)
                .getOne();
            if (similar) {
                return {
                    detected: true,
                    duplicateId: similar.id,
                    matchType: 'title_similarity',
                };
            }
        }
        return { detected: false };
    }
    calculateComplianceScore(errors, warnings, infos) {
        let score = 1.0;
        score -= errors.length * 0.15;
        score -= warnings.length * 0.05;
        return Math.max(0, Math.min(1, score));
    }
    async getAspectCoverage(product) {
        if (!product.ebayCategoryId)
            return {};
        const requirements = await this.aspectRequirementRepo.find({
            where: { ebayCategoryId: product.ebayCategoryId },
        });
        const specifics = product.generatedItemSpecifics || {};
        const required = requirements.filter((r) => r.requirementLevel === entities_1.AspectRequirementLevel.REQUIRED);
        const recommended = requirements.filter((r) => r.requirementLevel === entities_1.AspectRequirementLevel.RECOMMENDED);
        const requiredCovered = required.filter((r) => specifics[r.aspectName]).length;
        const recommendedCovered = recommended.filter((r) => specifics[r.aspectName]).length;
        return {
            requiredTotal: required.length,
            requiredCovered,
            requiredCoverage: required.length > 0 ? requiredCovered / required.length : 1,
            recommendedTotal: recommended.length,
            recommendedCovered,
            recommendedCoverage: recommended.length > 0 ? recommendedCovered / recommended.length : 1,
        };
    }
    buildFullPayload(product) {
        return {
            title: product.generatedTitle,
            itemSpecifics: product.generatedItemSpecifics,
            description: product.generatedHtmlDescription,
            categoryId: product.ebayCategoryId,
            condition: product.condition,
            price: product.price,
            quantity: product.quantity,
            imageUrls: product.imageUrls,
            fitmentRows: product.fitmentRows,
            brand: product.brand,
            mpn: product.mpn,
        };
    }
};
exports.ComplianceEngineService = ComplianceEngineService;
exports.ComplianceEngineService = ComplianceEngineService = ComplianceEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ValidationResult)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.MotorsProduct)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.EbayCategoryMapping)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.EbayAspectRequirement)),
    __param(4, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ai_run_log_service_js_1.AiRunLogService])
], ComplianceEngineService);
//# sourceMappingURL=compliance-engine.service.js.map