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
var EbayComplianceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayComplianceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const openai_service_js_1 = require("../../common/openai/openai.service.js");
const catalog_product_entity_js_1 = require("../entities/catalog-product.entity.js");
const compliance_audit_service_js_1 = require("./compliance-audit.service.js");
const ai_run_log_service_js_1 = require("../../common/openai/ai-run-log.service.js");
const ebay_listing_text_util_js_1 = require("../../channels/ebay/ebay-listing-text.util.js");
const REQUIRED_ITEM_SPECIFICS = ['Brand', 'Manufacturer Part Number'];
const RECOMMENDED_ITEM_SPECIFICS = [
    'Interchange Part Number',
    'UPC',
    'Placement on Vehicle',
    'Fitment Type',
    'Warranty',
    'Country/Region of Manufacture',
    'Type',
    'Material',
];
const TITLE_MAX_LENGTH = ebay_listing_text_util_js_1.EBAY_TITLE_MAX_LENGTH;
const TITLE_FORBIDDEN_PATTERNS = [
    /\b(FREE SHIPPING|FREE S&H|FREE RETURNS)\b/gi,
    /\b(BEST PRICE|LOWEST PRICE|CHEAPEST)\b/gi,
    /\b(L@@K|LOOK|WOW|RARE FIND|MUST SEE|HOT)\b/gi,
    /!{2,}/g,
    /\*{2,}/g,
    /\b[A-HJ-NPR-Z0-9]{17}\b/g,
];
const CONDITION_MAP = {
    '1000': 'New',
    '1500': 'New other',
    '1750': 'New with defects',
    '2000': 'Certified refurbished',
    '2500': 'Seller refurbished',
    '3000': 'Used',
    '7000': 'For parts or not working',
};
let EbayComplianceService = EbayComplianceService_1 = class EbayComplianceService {
    productRepo;
    openai;
    config;
    auditService;
    aiRunLogService;
    logger = new common_1.Logger(EbayComplianceService_1.name);
    constructor(productRepo, openai, config, auditService, aiRunLogService) {
        this.productRepo = productRepo;
        this.openai = openai;
        this.config = config;
        this.auditService = auditService;
        this.aiRunLogService = aiRunLogService;
    }
    async recordPublishOutcome(sku, published, publishError, ebayCategoryId) {
        await this.aiRunLogService.recordPublishOutcome(sku, published, publishError, ebayCategoryId);
    }
    async validateBatch(productIds, autoFix = true) {
        const results = [];
        for (const productId of productIds) {
            try {
                const result = await this.validateProduct(productId, autoFix);
                results.push(result);
            }
            catch (err) {
                this.logger.warn(`Compliance check failed for ${productId}: ${err}`);
                results.push(this.createErrorResult(productId, String(err)));
            }
        }
        const compliantCount = results.filter((r) => r.compliant).length;
        const autoFixedCount = results.filter((r) => r.autoCorrections.length > 0).length;
        const allIssues = results.flatMap((r) => r.issues);
        const issueCounts = new Map();
        for (const issue of allIssues) {
            issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1);
        }
        const topIssues = [...issueCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([code, count]) => ({ code, count }));
        return {
            totalRecords: results.length,
            compliantRecords: compliantCount,
            nonCompliantRecords: results.length - compliantCount,
            autoFixedRecords: autoFixedCount,
            averageComplianceScore: results.length > 0
                ? Math.round((results.reduce((sum, r) => sum + r.complianceScore, 0) /
                    results.length) *
                    100) / 100
                : 0,
            results,
            summary: {
                errorCount: allIssues.filter((i) => i.severity === 'error').length,
                warningCount: allIssues.filter((i) => i.severity === 'warning').length,
                infoCount: allIssues.filter((i) => i.severity === 'info').length,
                totalAutoCorrections: results.reduce((sum, r) => sum + r.autoCorrections.length, 0),
                topIssues,
            },
        };
    }
    async validateProduct(productId, autoFix = true) {
        const product = await this.productRepo.findOneBy({ id: productId });
        if (!product) {
            return this.createErrorResult(productId, 'Product not found');
        }
        const issues = [];
        const autoCorrections = [];
        const categoryValidation = await this.validateCategory(product);
        issues.push(...categoryValidation.issues);
        const itemSpecifics = await this.validateItemSpecifics(product, autoFix);
        issues.push(...itemSpecifics.issues);
        if (autoFix && itemSpecifics.autoFilled.length > 0) {
            for (const fill of itemSpecifics.autoFilled) {
                autoCorrections.push({
                    code: 'AUTO_FILL_SPECIFIC',
                    field: fill.field,
                    message: `Auto-filled missing item specific: ${fill.field} = ${fill.value}`,
                    severity: 'info',
                    autoFixed: true,
                    fixedValue: fill.value,
                });
            }
        }
        const titleOptimization = await this.validateAndOptimizeTitle(product, autoFix);
        issues.push(...titleOptimization.issues);
        if (titleOptimization.applied &&
            titleOptimization.optimizedTitle !== titleOptimization.originalTitle) {
            autoCorrections.push({
                code: 'TITLE_OPTIMIZED',
                field: 'title',
                message: 'Title was optimized for eBay SEO',
                severity: 'info',
                autoFixed: true,
                originalValue: titleOptimization.originalTitle,
                fixedValue: titleOptimization.optimizedTitle,
            });
        }
        const descriptionResult = await this.validateDescription(product, autoFix);
        issues.push(...descriptionResult.issues);
        if (descriptionResult.enhanced) {
            autoCorrections.push({
                code: 'DESCRIPTION_ENHANCED',
                field: 'description',
                message: 'Description was enhanced with structured content',
                severity: 'info',
                autoFixed: true,
            });
        }
        const fitmentResult = this.validateFitment(product);
        issues.push(...fitmentResult.issues);
        const imageResult = this.validateImages(product);
        issues.push(...imageResult.issues);
        const pricingResult = this.validatePricing(product);
        issues.push(...pricingResult.issues);
        const errors = issues.filter((i) => i.severity === 'error');
        const warnings = issues.filter((i) => i.severity === 'warning');
        const complianceScore = this.calculateComplianceScore(errors.length, warnings.length);
        const compliant = errors.length === 0 && complianceScore >= 0.7;
        if (autoFix && autoCorrections.length > 0) {
            await this.applyAutoCorrections(product, autoCorrections, titleOptimization, descriptionResult, itemSpecifics);
        }
        await this.logComplianceAudit(productId, product.importId, complianceScore, issues, autoCorrections);
        if (product.sku) {
            await this.aiRunLogService.recordComplianceOutcome(product.sku, complianceScore);
        }
        return {
            productId,
            sku: product.sku,
            compliant,
            complianceScore,
            issues,
            autoCorrections,
            categoryValidation,
            titleOptimization,
            descriptionEnhancement: descriptionResult,
            fitmentValidation: fitmentResult,
            imageCompliance: imageResult,
            pricingValidation: pricingResult,
            itemSpecifics,
        };
    }
    async validateImportProducts(importId, autoFix = true, limit = 500) {
        const products = await this.productRepo.find({
            where: { importId },
            take: limit,
            order: { createdAt: 'ASC' },
        });
        if (products.length === 0) {
            return {
                totalRecords: 0,
                compliantRecords: 0,
                nonCompliantRecords: 0,
                autoFixedRecords: 0,
                averageComplianceScore: 0,
                results: [],
                summary: {
                    errorCount: 0,
                    warningCount: 0,
                    infoCount: 0,
                    totalAutoCorrections: 0,
                    topIssues: [],
                },
            };
        }
        return this.validateBatch(products.map((p) => p.id), autoFix);
    }
    validateRowData(data) {
        const errors = [];
        const warnings = [];
        const autoCorrections = [];
        const title = data['title'] || '';
        if (!title) {
            errors.push('Title is required');
        }
        else {
            if (title.length > 80) {
                const trimmed = title.slice(0, 80);
                autoCorrections.push({
                    field: 'title',
                    original: title,
                    corrected: trimmed,
                });
                data['title'] = trimmed;
            }
            for (const pattern of TITLE_FORBIDDEN_PATTERNS) {
                if (pattern.test(title)) {
                    const cleaned = title
                        .replace(pattern, '')
                        .replace(/\s{2,}/g, ' ')
                        .trim();
                    autoCorrections.push({
                        field: 'title',
                        original: title,
                        corrected: cleaned,
                    });
                    data['title'] = cleaned;
                    break;
                }
            }
        }
        if (!data['brand'] || !data['brand'].trim()) {
            const inferred = this.inferBrandFromTitle(data['title'] || '');
            if (inferred) {
                data['brand'] = inferred;
                autoCorrections.push({
                    field: 'brand',
                    original: '(empty)',
                    corrected: inferred,
                });
            }
        }
        if (!data['brand'] || !data['brand'].trim()) {
            errors.push('Brand is required for eBay Motors');
        }
        if (!data['mpn'] || !data['mpn'].trim()) {
            warnings.push('Manufacturer Part Number is strongly recommended');
        }
        if (data['price']) {
            const price = parseFloat(data['price'].replace(/[$,\s]/g, ''));
            if (isNaN(price) || price <= 0) {
                errors.push('Price must be a positive number');
            }
            else if (price < 0.01) {
                errors.push('Price below minimum threshold ($0.01)');
            }
        }
        if (data['quantity']) {
            const qty = parseInt(data['quantity'], 10);
            if (isNaN(qty) || qty < 1) {
                warnings.push('Quantity should be at least 1');
            }
        }
        if (data['conditionId']) {
            const validConditions = [
                '1000',
                '1500',
                '1750',
                '2000',
                '2500',
                '3000',
                '7000',
            ];
            const cleanCondition = data['conditionId'].replace(/-.*/, '');
            if (!validConditions.includes(cleanCondition)) {
                warnings.push(`Condition ID "${data['conditionId']}" is not a standard eBay condition`);
            }
        }
        if (data['upc'] && data['upc'].trim()) {
            const upc = data['upc'].replace(/\s/g, '');
            if (upc !== 'Does not apply' && upc !== 'N/A') {
                if (!/^\d{12,13}$/.test(upc)) {
                    warnings.push('UPC must be 12 or 13 digits');
                }
                else if (!this.validateUpcCheckDigit(upc)) {
                    warnings.push('UPC check digit is invalid');
                }
            }
        }
        if (!data['imageUrls'] || !data['imageUrls'].trim()) {
            warnings.push('At least 1 image is required for eBay listings');
        }
        else {
            const urls = data['imageUrls'].split('|').filter(Boolean);
            const validUrls = urls.filter((u) => /^https?:\/\/.+/i.test(u));
            if (validUrls.length === 0) {
                warnings.push('No valid image URLs found');
            }
        }
        return {
            compliant: errors.length === 0,
            errors,
            warnings,
            autoCorrections,
        };
    }
    inferBrandFromTitle(title) {
        const t = title.trim();
        if (!t)
            return null;
        const lower = t.toLowerCase();
        const brands = [
            ['mercedes-benz', 'Mercedes-Benz'],
            ['mercedes', 'Mercedes-Benz'],
            ['bmw', 'BMW'],
            ['audi', 'Audi'],
            ['porsche', 'Porsche'],
            ['volkswagen', 'Volkswagen'],
            ['toyota', 'Toyota'],
            ['honda', 'Honda'],
            ['nissan', 'Nissan'],
            ['mazda', 'Mazda'],
            ['subaru', 'Subaru'],
            ['lexus', 'Lexus'],
            ['acura', 'Acura'],
            ['infiniti', 'Infiniti'],
            ['hyundai', 'Hyundai'],
            ['kia', 'Kia'],
            ['genesis', 'Genesis'],
            ['ford', 'Ford'],
            ['chevrolet', 'Chevrolet'],
            ['chevy', 'Chevrolet'],
            ['gmc', 'GMC'],
            ['cadillac', 'Cadillac'],
            ['dodge', 'Dodge'],
            ['chrysler', 'Chrysler'],
            ['jeep', 'Jeep'],
            ['ram', 'RAM'],
            ['tesla', 'Tesla'],
            ['volvo', 'Volvo'],
            ['land rover', 'Land Rover'],
            ['jaguar', 'Jaguar'],
            ['mini', 'MINI'],
            ['fiat', 'Fiat'],
            ['alfa romeo', 'Alfa Romeo'],
            ['maserati', 'Maserati'],
            ['ferrari', 'Ferrari'],
            ['lamborghini', 'Lamborghini'],
            ['bentley', 'Bentley'],
            ['rolls-royce', 'Rolls-Royce'],
            ['rolls royce', 'Rolls-Royce'],
            ['mitsubishi', 'Mitsubishi'],
            ['suzuki', 'Suzuki'],
            ['isuzu', 'Isuzu'],
        ];
        for (const [needle, brand] of brands) {
            if (lower.includes(needle))
                return brand;
        }
        return null;
    }
    validateUpcCheckDigit(upc) {
        const digits = upc.split('').map(Number);
        if (digits.length === 12) {
            let sum = 0;
            for (let i = 0; i < 11; i++) {
                sum += digits[i] * (i % 2 === 0 ? 3 : 1);
            }
            const checkDigit = (10 - (sum % 10)) % 10;
            return checkDigit === digits[11];
        }
        else if (digits.length === 13) {
            let sum = 0;
            for (let i = 0; i < 12; i++) {
                sum += digits[i] * (i % 2 === 0 ? 1 : 3);
            }
            const checkDigit = (10 - (sum % 10)) % 10;
            return checkDigit === digits[12];
        }
        return false;
    }
    async logComplianceAudit(productId, importId, score, issues, corrections) {
        const entries = [
            {
                productId,
                importId,
                action: 'validation',
                field: '_overall',
                reason: `Compliance score: ${score} | ${issues.length} issues | ${corrections.length} corrections`,
                severity: score >= 0.7 ? 'info' : 'warning',
                complianceScore: score,
                autoFixed: corrections.length > 0,
            },
            ...corrections.map((c) => ({
                productId,
                importId,
                action: c.code.includes('TITLE')
                    ? 'title_optimization'
                    : c.code.includes('DESCRIPTION')
                        ? 'description_enhancement'
                        : c.code.includes('CATEGORY')
                            ? 'category_mapping'
                            : c.code.includes('SPECIFIC')
                                ? 'item_specifics_fill'
                                : 'auto_correction',
                field: c.field,
                originalValue: c.originalValue ?? null,
                newValue: c.fixedValue ?? null,
                reason: c.message,
                severity: c.severity,
                complianceScore: null,
                autoFixed: true,
            })),
        ];
        await this.auditService.logBatch(entries);
    }
    async validateCategory(product) {
        const issues = [];
        if (!product.categoryId) {
            const suggested = await this.suggestCategory(product);
            if (suggested) {
                return {
                    valid: false,
                    suggestedCategoryId: suggested.id,
                    suggestedCategoryName: suggested.name,
                    confidence: suggested.confidence,
                    issues: [
                        {
                            code: 'MISSING_CATEGORY',
                            field: 'categoryId',
                            message: 'eBay category is missing',
                            severity: 'error',
                            suggestion: `Suggested: ${suggested.name} (${suggested.id})`,
                        },
                    ],
                };
            }
            issues.push({
                code: 'MISSING_CATEGORY',
                field: 'categoryId',
                message: 'eBay category is required for listing',
                severity: 'error',
            });
            return {
                valid: false,
                suggestedCategoryId: null,
                suggestedCategoryName: null,
                confidence: 0,
                issues,
            };
        }
        return {
            valid: true,
            suggestedCategoryId: product.categoryId,
            suggestedCategoryName: product.categoryName ?? null,
            confidence: 1.0,
            issues,
        };
    }
    async suggestCategory(product) {
        try {
            const response = await this.openai.chat({
                systemPrompt: `You are an eBay Motors category specialist. Given auto part info, suggest the best eBay Motors category. Return JSON: {"id":"<ebay_category_id>","name":"<category_name>","confidence":0.0-1.0}. Common categories:
- 33631: Car & Truck Parts & Accessories
- 174104: Brakes & Brake Parts
- 33626: Engines & Components
- 33612: Exterior Parts & Accessories
- 33694: Interior Parts & Accessories
- 33602: Lighting & Lamps
- 33611: Suspension & Steering
Return ONLY JSON.`,
                userPrompt: `Part: ${product.title}\nBrand: ${product.brand || 'N/A'}\nType: ${product.partType || 'N/A'}\nMPN: ${product.mpn || 'N/A'}`,
                maxTokens: 150,
                temperature: 0.1,
            });
            const text = response.content
                .replace(/```json?\n?/g, '')
                .replace(/```/g, '')
                .trim();
            return JSON.parse(text);
        }
        catch {
            return null;
        }
    }
    async validateItemSpecifics(product, autoFix) {
        const issues = [];
        const autoFilled = [];
        const missingRequired = [];
        const specificsMap = {
            Brand: product.brand,
            'Manufacturer Part Number': product.mpn,
        };
        for (const specific of REQUIRED_ITEM_SPECIFICS) {
            const value = specificsMap[specific];
            if (!value || value.trim() === '') {
                missingRequired.push(specific);
                issues.push({
                    code: 'MISSING_REQUIRED_SPECIFIC',
                    field: specific,
                    message: `Required item specific "${specific}" is missing`,
                    severity: 'error',
                    suggestion: `Provide a valid ${specific}`,
                });
            }
        }
        const recommendedMap = {
            'Interchange Part Number': product.oemPartNumber,
            UPC: product.upc,
            'Placement on Vehicle': product.placement,
            Type: product.partType,
            Material: product.material,
        };
        for (const specific of RECOMMENDED_ITEM_SPECIFICS) {
            const value = recommendedMap[specific];
            if (!value || value.trim() === '') {
                issues.push({
                    code: 'MISSING_RECOMMENDED_SPECIFIC',
                    field: specific,
                    message: `Recommended item specific "${specific}" is not provided`,
                    severity: 'warning',
                });
            }
        }
        if (autoFix && missingRequired.length > 0) {
            const filled = await this.autoFillSpecifics(product, missingRequired);
            autoFilled.push(...filled);
        }
        const totalRequired = REQUIRED_ITEM_SPECIFICS.length;
        const totalPresent = totalRequired - missingRequired.length + autoFilled.length;
        return {
            totalRequired,
            totalPresent: Math.min(totalPresent, totalRequired),
            coveragePercent: Math.round((totalPresent / totalRequired) * 100),
            missingRequired,
            autoFilled,
            issues,
        };
    }
    async autoFillSpecifics(product, missingFields) {
        try {
            const response = await this.openai.chat({
                systemPrompt: `You are an automotive parts data specialist. Given a product and missing item specifics, infer the most likely values. Return JSON array: [{"field":"...","value":"..."}]. Only fill fields you are confident about. If unsure, omit that field. Return ONLY JSON array.`,
                userPrompt: `Product: ${product.title}
SKU: ${product.sku || 'N/A'}
Brand: ${product.brand || 'N/A'}
MPN: ${product.mpn || 'N/A'}
Description: ${(product.description || '').slice(0, 200)}

Missing fields: ${missingFields.join(', ')}`,
                maxTokens: 300,
                temperature: 0.1,
            });
            const text = response.content
                .replace(/```json?\n?/g, '')
                .replace(/```/g, '')
                .trim();
            const fills = JSON.parse(text);
            return fills.filter((f) => f.field && f.value && missingFields.includes(f.field));
        }
        catch {
            return [];
        }
    }
    async validateAndOptimizeTitle(product, autoFix) {
        const issues = [];
        const originalTitle = product.title || '';
        let optimizedTitle = originalTitle;
        let applied = false;
        if (originalTitle.length > TITLE_MAX_LENGTH) {
            issues.push({
                code: 'TITLE_TOO_LONG',
                field: 'title',
                message: `Title exceeds ${TITLE_MAX_LENGTH} characters (${originalTitle.length})`,
                severity: 'error',
                suggestion: `Shorten title to ${TITLE_MAX_LENGTH} characters`,
            });
        }
        if (originalTitle.length === 0) {
            issues.push({
                code: 'TITLE_EMPTY',
                field: 'title',
                message: 'Title is empty',
                severity: 'error',
            });
            return {
                originalTitle,
                optimizedTitle,
                applied: false,
                lengthOk: false,
                seoScore: 0,
                issues,
            };
        }
        for (const pattern of TITLE_FORBIDDEN_PATTERNS) {
            if (pattern.test(originalTitle)) {
                issues.push({
                    code: 'TITLE_FORBIDDEN_CONTENT',
                    field: 'title',
                    message: `Title contains forbidden content matching ${pattern.source}`,
                    severity: 'error',
                    suggestion: 'Remove promotional or spammy text',
                });
            }
        }
        if (!(0, ebay_listing_text_util_js_1.matchesStrictEbayTitleStructure)(originalTitle)) {
            issues.push({
                code: 'TITLE_STRUCTURE_INVALID',
                field: 'title',
                message: 'Title does not follow the required structure: [Year Range] [Make] [Model/Generation] [Position] [Part Name] [OEM Part Number] OEM Used',
                severity: 'error',
                suggestion: 'Rewrite the title to match the eBay Motors title guideline structure',
            });
        }
        const words = originalTitle.toLowerCase().split(/\s+/);
        const duplicates = words.filter((w, i) => words.indexOf(w) !== i && w.length > 3);
        if (duplicates.length > 0) {
            issues.push({
                code: 'TITLE_DUPLICATE_WORDS',
                field: 'title',
                message: `Title contains duplicate words: ${[...new Set(duplicates)].join(', ')}`,
                severity: 'warning',
            });
        }
        const seoScore = this.calculateTitleSeoScore(originalTitle, product);
        if (autoFix &&
            originalTitle.length > 0 &&
            (issues.some((i) => i.severity === 'error') || seoScore < 0.6)) {
            optimizedTitle = await this.generateOptimizedTitle(product);
            if (optimizedTitle && optimizedTitle !== originalTitle) {
                applied = true;
            }
            else {
                optimizedTitle = originalTitle;
            }
        }
        return {
            originalTitle,
            optimizedTitle,
            applied,
            lengthOk: originalTitle.length <= TITLE_MAX_LENGTH,
            seoScore,
            issues,
        };
    }
    calculateTitleSeoScore(title, product) {
        let score = 0.5;
        if (product.brand &&
            title.toLowerCase().includes(product.brand.toLowerCase()))
            score += 0.15;
        if (product.mpn && title.toLowerCase().includes(product.mpn.toLowerCase()))
            score += 0.15;
        if (title.length >= 50 && title.length <= 80)
            score += 0.1;
        else if (title.length >= 30 && title.length < 50)
            score += 0.05;
        if (title !== title.toUpperCase())
            score += 0.05;
        if (/\b(for|fits)\b/i.test(title))
            score += 0.05;
        return Math.min(1, Math.round(score * 100) / 100);
    }
    async generateOptimizedTitle(product) {
        try {
            const response = await this.openai.chat({
                systemPrompt: `You are an eBay SEO specialist for automotive parts. Generate an optimized listing title following these rules:
- Max 80 characters
- Include: Brand, Part Type, Key Fitment, Core Keyword
- No spammy phrases (FREE SHIPPING, BEST PRICE, L@@K, etc.)
- No excessive punctuation or ALL CAPS
- Natural, professional language
- TITLE RULE: The title MUST reflect the stated Condition. If Condition is Used/Refurbished, do NOT include "New" in the title. If Condition is New, do NOT include "Used".
- NEVER include VIN numbers or duplicate make/model in the title
- TITLE STRUCTURE (strictly follow): [Year Range] [Make] [Model/Generation] [Position] [Part Name] [OEM Part Number] OEM Used
- Example: 2012-2018 Audi A6 C7 Front Left Fog Light 8T0941699E OEM Used
- Max 80 characters. Put Year, Make, Model first. Include the OEM part number. Include position (Left/Right, Front/Rear) when applicable. Add 'OEM Used' at end if space permits.
- Return ONLY the title text, nothing else.`,
                userPrompt: `Generate an optimized eBay title for:
Brand: ${product.brand || 'N/A'}
MPN: ${product.mpn || 'N/A'}
Part Type: ${product.partType || 'N/A'}
Current Title: ${product.title}
Condition: ${product.conditionLabel || product.conditionId || 'N/A'}`,
                maxTokens: 100,
                temperature: 0.3,
            });
            const title = response.content
                .replace(/^["']|["']$/g, '')
                .trim();
            return title.length <= TITLE_MAX_LENGTH
                ? title
                : title.slice(0, TITLE_MAX_LENGTH);
        }
        catch {
            return product.title;
        }
    }
    async validateDescription(product, autoFix) {
        const issues = [];
        const description = product.description || '';
        let enhanced = false;
        let enhancedDescription = null;
        if (!description || description.trim().length < 20) {
            issues.push({
                code: 'DESCRIPTION_MISSING',
                field: 'description',
                message: 'Product description is missing or too short',
                severity: 'warning',
                suggestion: 'Add a detailed description with features, compatibility, and condition',
            });
            if (autoFix) {
                enhancedDescription = await this.generateDescription(product);
                if (enhancedDescription)
                    enhanced = true;
            }
        }
        else {
            const hasScript = /<script[\s>]/i.test(description);
            const hasIframe = /<iframe[\s>]/i.test(description);
            if (hasScript || hasIframe) {
                issues.push({
                    code: 'DESCRIPTION_PROHIBITED_HTML',
                    field: 'description',
                    message: 'Description contains prohibited HTML elements (script/iframe)',
                    severity: 'error',
                });
            }
            if (description.length < 100) {
                issues.push({
                    code: 'DESCRIPTION_TOO_SHORT',
                    field: 'description',
                    message: 'Description is shorter than recommended (min 100 chars)',
                    severity: 'warning',
                });
                if (autoFix) {
                    enhancedDescription = await this.generateDescription(product);
                    if (enhancedDescription)
                        enhanced = true;
                }
            }
        }
        return {
            hasDescription: !!description,
            enhanced,
            enhancedDescription,
            issues,
        };
    }
    async generateDescription(product) {
        try {
            const response = await this.openai.chat({
                systemPrompt: `You are an eBay listing specialist. Generate a professional, structured product description for an automotive part. Include:
1. Key Features (bullet points)
2. Compatibility / Fitment info
3. Condition notes
4. Brief shipping & returns info

Rules:
- Professional tone
- No prohibited HTML (<script>, <iframe>)
- Clean HTML formatting with <ul>, <li>, <p>, <strong>
- No false claims or prohibited terms
- Return ONLY the HTML description.`,
                userPrompt: `Product: ${product.title}
Brand: ${product.brand || 'N/A'}
MPN: ${product.mpn || 'N/A'}
Condition: ${product.conditionLabel || product.conditionId || 'N/A'}
Part Type: ${product.partType || 'N/A'}
Placement: ${product.placement || 'N/A'}
Material: ${product.material || 'N/A'}
Features: ${product.features || 'N/A'}
Current Description: ${(product.description || '').slice(0, 120)}`,
                maxTokens: 600,
                temperature: 0.3,
            });
            return response.content.trim();
        }
        catch {
            return null;
        }
    }
    validateFitment(product) {
        const issues = [];
        const fitmentData = product.fitmentData;
        const hasFitment = !!fitmentData && Array.isArray(fitmentData) && fitmentData.length > 0;
        if (!hasFitment) {
            issues.push({
                code: 'MISSING_FITMENT',
                field: 'fitmentData',
                message: 'No vehicle compatibility / fitment data provided',
                severity: 'warning',
                suggestion: 'Add Year/Make/Model compatibility for better search visibility',
            });
            return {
                hasFitment: false,
                valid: false,
                normalized: false,
                vehicleCount: 0,
                issues,
            };
        }
        let valid = true;
        let vehicleCount = 0;
        for (const entry of fitmentData) {
            vehicleCount++;
            const year = entry['Year'] || entry['year'];
            const make = entry['Make'] || entry['make'];
            const model = entry['Model'] || entry['model'];
            if (!year || !make || !model) {
                valid = false;
                issues.push({
                    code: 'INCOMPLETE_FITMENT',
                    field: 'fitmentData',
                    message: `Fitment entry missing required fields (Year/Make/Model)`,
                    severity: 'warning',
                });
                break;
            }
            const yearNum = Number(year);
            if (isNaN(yearNum) ||
                yearNum < 1900 ||
                yearNum > new Date().getFullYear() + 2) {
                issues.push({
                    code: 'INVALID_FITMENT_YEAR',
                    field: 'fitmentData',
                    message: `Invalid year in fitment: ${year}`,
                    severity: 'warning',
                });
            }
        }
        return { hasFitment: true, valid, normalized: false, vehicleCount, issues };
    }
    validateImages(product) {
        const issues = [];
        const images = product.imageUrls || [];
        const hasImages = images.length > 0;
        if (!hasImages) {
            issues.push({
                code: 'NO_IMAGES',
                field: 'imageUrls',
                message: 'At least 1 valid image is required per listing',
                severity: 'error',
                suggestion: 'Add a product image or use the image enrichment pipeline',
            });
            return { hasImages: false, imageCount: 0, valid: false, issues };
        }
        for (const url of images) {
            if (!url || typeof url !== 'string') {
                issues.push({
                    code: 'INVALID_IMAGE_URL',
                    field: 'imageUrls',
                    message: 'Image URL is empty or invalid',
                    severity: 'error',
                });
                continue;
            }
            if (/placeholder|no-image|default/i.test(url)) {
                issues.push({
                    code: 'PLACEHOLDER_IMAGE',
                    field: 'imageUrls',
                    message: 'Image appears to be a placeholder, not a real product photo',
                    severity: 'warning',
                });
            }
        }
        return {
            hasImages: true,
            imageCount: images.length,
            valid: issues.filter((i) => i.severity === 'error').length === 0,
            issues,
        };
    }
    validatePricing(product) {
        const issues = [];
        const price = product.price;
        if (price === null || price === undefined) {
            issues.push({
                code: 'MISSING_PRICE',
                field: 'price',
                message: 'Price is required',
                severity: 'error',
            });
            return { hasPrice: false, valid: false, issues };
        }
        const numericPrice = Number(price);
        if (isNaN(numericPrice) || numericPrice <= 0) {
            issues.push({
                code: 'INVALID_PRICE',
                field: 'price',
                message: `Price must be a positive number (got: ${price})`,
                severity: 'error',
            });
            return { hasPrice: true, valid: false, issues };
        }
        if (numericPrice > 50000) {
            issues.push({
                code: 'PRICE_SUSPICIOUSLY_HIGH',
                field: 'price',
                message: `Price $${numericPrice} seems unusually high for this category`,
                severity: 'warning',
            });
        }
        if (numericPrice < 0.01) {
            issues.push({
                code: 'PRICE_TOO_LOW',
                field: 'price',
                message: 'Price is below minimum threshold',
                severity: 'error',
            });
            return { hasPrice: true, valid: false, issues };
        }
        const conditionId = product.conditionId;
        if (!conditionId) {
            issues.push({
                code: 'MISSING_CONDITION',
                field: 'conditionId',
                message: 'Item condition is required',
                severity: 'error',
            });
        }
        else if (!CONDITION_MAP[conditionId]) {
            issues.push({
                code: 'INVALID_CONDITION',
                field: 'conditionId',
                message: `Condition ID "${conditionId}" is not a valid eBay condition code`,
                severity: 'warning',
                suggestion: `Valid values: ${Object.entries(CONDITION_MAP)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ')}`,
            });
        }
        const qty = product.quantity;
        if (qty === null || qty === undefined || qty < 1) {
            issues.push({
                code: 'MISSING_QUANTITY',
                field: 'quantity',
                message: 'Quantity must be at least 1',
                severity: 'error',
            });
        }
        if (!product.shippingProfile) {
            issues.push({
                code: 'MISSING_SHIPPING_PROFILE',
                field: 'shippingProfile',
                message: 'Shipping profile is recommended',
                severity: 'warning',
            });
        }
        if (!product.returnProfile) {
            issues.push({
                code: 'MISSING_RETURN_PROFILE',
                field: 'returnProfile',
                message: 'Return policy profile is recommended',
                severity: 'warning',
            });
        }
        return {
            hasPrice: true,
            valid: issues.filter((i) => i.severity === 'error').length === 0,
            issues,
        };
    }
    calculateComplianceScore(errorCount, warningCount) {
        let score = 1.0;
        score -= errorCount * 0.15;
        score -= warningCount * 0.03;
        return Math.max(0, Math.round(score * 100) / 100);
    }
    async applyAutoCorrections(product, corrections, titleResult, descResult, specificsResult) {
        try {
            const updates = {};
            if (titleResult.applied) {
                updates.title = titleResult.optimizedTitle;
            }
            if (descResult.enhanced && descResult.enhancedDescription) {
                updates.description = descResult.enhancedDescription;
            }
            for (const fill of specificsResult.autoFilled) {
                switch (fill.field) {
                    case 'Brand':
                        updates.brand = fill.value;
                        break;
                    case 'Manufacturer Part Number':
                        updates.mpn = fill.value;
                        break;
                    case 'Interchange Part Number':
                        updates.oemPartNumber = fill.value;
                        break;
                    case 'UPC':
                        updates.upc = fill.value;
                        break;
                    case 'Placement on Vehicle':
                        updates.placement = fill.value;
                        break;
                    case 'Type':
                        updates.partType = fill.value;
                        break;
                    case 'Material':
                        updates.material = fill.value;
                        break;
                }
            }
            if (Object.keys(updates).length > 0) {
                await this.productRepo.update(product.id, updates);
                this.logger.log(`Applied ${Object.keys(updates).length} auto-corrections to product ${product.id}`);
            }
        }
        catch (err) {
            this.logger.warn(`Failed to apply auto-corrections to ${product.id}: ${err}`);
        }
    }
    createErrorResult(productId, errorMsg) {
        return {
            productId,
            sku: null,
            compliant: false,
            complianceScore: 0,
            issues: [
                {
                    code: 'SYSTEM_ERROR',
                    field: '_system',
                    message: errorMsg,
                    severity: 'error',
                },
            ],
            autoCorrections: [],
            categoryValidation: {
                valid: false,
                suggestedCategoryId: null,
                suggestedCategoryName: null,
                confidence: 0,
                issues: [],
            },
            titleOptimization: {
                originalTitle: '',
                optimizedTitle: '',
                applied: false,
                lengthOk: false,
                seoScore: 0,
                issues: [],
            },
            descriptionEnhancement: {
                hasDescription: false,
                enhanced: false,
                enhancedDescription: null,
                issues: [],
            },
            fitmentValidation: {
                hasFitment: false,
                valid: false,
                normalized: false,
                vehicleCount: 0,
                issues: [],
            },
            imageCompliance: {
                hasImages: false,
                imageCount: 0,
                valid: false,
                issues: [],
            },
            pricingValidation: { hasPrice: false, valid: false, issues: [] },
            itemSpecifics: {
                totalRequired: 0,
                totalPresent: 0,
                coveragePercent: 0,
                missingRequired: [],
                autoFilled: [],
                issues: [],
            },
        };
    }
};
exports.EbayComplianceService = EbayComplianceService;
exports.EbayComplianceService = EbayComplianceService = EbayComplianceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        openai_service_js_1.OpenAiService,
        config_1.ConfigService,
        compliance_audit_service_js_1.ComplianceAuditService,
        ai_run_log_service_js_1.AiRunLogService])
], EbayComplianceService);
//# sourceMappingURL=ebay-compliance.service.js.map