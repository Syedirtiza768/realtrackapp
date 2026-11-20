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
var EnterpriseListingIntelligenceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseListingIntelligenceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const pipeline_job_entity_js_1 = require("./entities/pipeline-job.entity.js");
const automotive_oem_brands_js_1 = require("./constants/automotive-oem-brands.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const ebay_category_mapping_entity_js_1 = require("../motors-intelligence/entities/ebay-category-mapping.entity.js");
const listing_generation_pipeline_js_1 = require("../common/openai/pipelines/listing-generation.pipeline.js");
const title_position_part_name_pipeline_js_1 = require("../common/openai/pipelines/title-position-part-name.pipeline.js");
const ebay_taxonomy_api_service_js_1 = require("../channels/ebay/ebay-taxonomy-api.service.js");
const ebay_german_listing_util_js_1 = require("../channels/ebay/ebay-german-listing.util.js");
const ebay_english_listing_util_js_1 = require("../channels/ebay/ebay-english-listing.util.js");
const ebay_listing_text_util_js_1 = require("../channels/ebay/ebay-listing-text.util.js");
const platform_generation_util_js_1 = require("../fitment/platform-generation.util.js");
const mvl_donor_scope_util_js_1 = require("../fitment/mvl-donor-scope.util.js");
const derive_part_name_from_title_js_1 = require("../listings/utils/derive-part-name-from-title.js");
const exact_oem_year_range_util_js_1 = require("../listing-optimization/exact-oem-year-range.util.js");
function resolveSellerCountryFromLocation(location) {
    const loc = (location ?? '').toUpperCase();
    if (loc.includes('DE') || loc.includes('GERMANY'))
        return 'DE';
    if (loc.includes('AU') || loc.includes('AUSTRALIA'))
        return 'AU';
    if (loc.includes('AE') ||
        loc.includes('DUBAI') ||
        loc.includes('UAE') ||
        loc.includes('UNITED ARAB')) {
        return 'AE';
    }
    return 'AE';
}
function scalarText(value) {
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value).trim();
    }
    return '';
}
let EnterpriseListingIntelligenceService = class EnterpriseListingIntelligenceService {
    static { EnterpriseListingIntelligenceService_1 = this; }
    pipelineRepo;
    productRepo;
    categoryMappingRepo;
    listingPipeline;
    titlePositionPartName;
    taxonomy;
    logger = new common_1.Logger(EnterpriseListingIntelligenceService_1.name);
    static MOTORS_TREE_ID = '100';
    static KEYWORD_MOTORS_IDS = new Set(ebay_german_listing_util_js_1.CATEGORY_KEYWORD_ROWS.map((r) => r.id));
    static UNTRUSTED_GENERIC_PART_IDENTITIES = new Set([
        'automotive',
        'misc',
        'miscellaneous',
        'not specified',
        'oem part',
        'other',
        'part',
        'parts',
        'unknown',
    ]);
    static WRONG_VERTICAL_MOTORS_IDS = new Set([
        '6000',
        '6024',
        '6126',
        '262124',
        '262320',
    ]);
    fallbackLeaf = null;
    categorySuggestionCache = new Map();
    categorySuggestionInFlight = new Map();
    constructor(pipelineRepo, productRepo, categoryMappingRepo, listingPipeline, titlePositionPartName, taxonomy) {
        this.pipelineRepo = pipelineRepo;
        this.productRepo = productRepo;
        this.categoryMappingRepo = categoryMappingRepo;
        this.listingPipeline = listingPipeline;
        this.titlePositionPartName = titlePositionPartName;
        this.taxonomy = taxonomy;
    }
    async generateForPipelineJob(jobId, rawOptions) {
        const limit = Math.min(Math.max(rawOptions?.limit ?? 250, 1), 2000);
        const options = {
            marketplace: rawOptions?.marketplace ?? 'US',
            limit,
            aiBudgetListings: Math.min(Math.max(rawOptions?.aiBudgetListings ?? limit, 0), 2000),
            listingQualityProfile: rawOptions?.listingQualityProfile ?? 'max_seo_comprehensive',
        };
        const job = await this.pipelineRepo.findOneBy({ id: jobId });
        if (!job) {
            throw new common_1.NotFoundException(`Pipeline job ${jobId} not found`);
        }
        const products = await this.productRepo.find({
            where: { pipelineJobId: jobId },
            order: { sourceRow: 'ASC' },
            take: options.limit,
        });
        for (const product of products) {
            const sourceDonor = this.parseDonorVehicleFromFilename(job.originalFilename, product.brand);
            if (!sourceDonor)
                continue;
            if (!product.donorYear?.trim())
                product.donorYear = sourceDonor.year;
            if (!product.donorMake?.trim())
                product.donorMake = sourceDonor.make;
            if (!product.donorModel?.trim())
                product.donorModel = sourceDonor.model;
        }
        const aiProducts = products.slice(0, options.aiBudgetListings);
        let aiResults = [];
        if (aiProducts.length > 0) {
            try {
                aiResults = await this.listingPipeline.generateBatch(aiProducts.map((product) => ({
                    productData: {
                        brand: product.brand,
                        mpn: product.mpn,
                        part_type: product.partType,
                        placement: product.placement,
                        material: product.material,
                        features: product.features,
                        fitment: this.normalizeCompatibility(product.fitmentData).filter((row) => row.source === 'source_data'),
                    },
                    categoryName: product.categoryName ?? 'eBay Motors Parts & Accessories',
                    condition: product.conditionLabel ?? product.conditionId ?? 'Used',
                    options: {
                        temperature: this.getTemperatureForProfile(options.listingQualityProfile),
                        marketplace: options.marketplace,
                        sellerCountry: resolveSellerCountryFromLocation(product.location),
                    },
                })));
            }
            catch (error) {
                this.logger.warn(`AI listing generation failed for pipeline job ${jobId}; using deterministic fitment-based title fallbacks: ${String(error)}`);
            }
        }
        const aiByProductId = new Map();
        for (let i = 0; i < aiProducts.length; i++) {
            const ai = aiResults[i];
            if (ai)
                aiByProductId.set(aiProducts[i].id, ai);
        }
        const titleSlotsByProductId = await this.resolveTitleSlots(products, options.marketplace);
        const listings = [];
        for (const product of products) {
            const listing = await this.buildEnterpriseListing(product, options.marketplace, aiByProductId.get(product.id) ?? null, titleSlotsByProductId.get(product.id) ?? null);
            listings.push(listing);
        }
        const aiGeneratedCount = aiByProductId.size;
        const blockedCount = listings.filter((l) => l.validationStatus === 'block').length;
        const reviewCount = listings.filter((l) => l.validationStatus === 'review').length;
        const passCount = listings.filter((l) => l.validationStatus === 'pass').length;
        const averageUploadReadiness = listings.length
            ? Math.round((listings.reduce((sum, l) => sum + l.uploadReadinessScore, 0) /
                listings.length) *
                100) / 100
            : 0;
        return {
            jobId,
            marketplace: options.marketplace,
            totalProducts: products.length,
            aiGeneratedCount,
            blockedCount,
            reviewCount,
            passCount,
            averageUploadReadiness,
            listings,
        };
    }
    async generateForProduct(productId, rawOptions) {
        const product = await this.productRepo.findOneBy({ id: productId });
        if (!product) {
            throw new common_1.NotFoundException(`Product ${productId} not found`);
        }
        const options = {
            marketplace: rawOptions?.marketplace ?? 'US',
            limit: 1,
            aiBudgetListings: 1,
            listingQualityProfile: rawOptions?.listingQualityProfile ?? 'max_seo_comprehensive',
        };
        const aiResults = await this.listingPipeline.generateBatch([
            this.buildAiListingItem(product, options),
        ]);
        const titleSlotsByProductId = await this.resolveTitleSlots([product], options.marketplace);
        return this.buildEnterpriseListing(product, options.marketplace, aiResults[0] ?? null, titleSlotsByProductId.get(product.id) ?? null);
    }
    async generateForProductsBatch(productIds, rawOptions) {
        if (productIds.length === 0)
            return new Map();
        const products = await this.productRepo.find({
            where: { id: (0, typeorm_2.In)(productIds) },
        });
        const byId = new Map(products.map((p) => [p.id, p]));
        const ordered = productIds
            .map((id) => byId.get(id))
            .filter((p) => !!p);
        const options = {
            marketplace: rawOptions?.marketplace ?? 'US',
            limit: 1,
            aiBudgetListings: 1,
            listingQualityProfile: rawOptions?.listingQualityProfile ?? 'max_seo_comprehensive',
        };
        let aiResults = [];
        try {
            aiResults = await this.listingPipeline.generateBatch(ordered.map((product) => this.buildAiListingItem(product, options)));
        }
        catch (error) {
            this.logger.warn(`AI listing generation failed for product batch; using deterministic fitment-based title fallbacks: ${String(error)}`);
        }
        const titleSlotsByProductId = await this.resolveTitleSlots(ordered, options.marketplace);
        const results = new Map();
        for (let i = 0; i < ordered.length; i++) {
            const listing = await this.buildEnterpriseListing(ordered[i], options.marketplace, aiResults[i] ?? null, titleSlotsByProductId.get(ordered[i].id) ?? null);
            results.set(ordered[i].id, listing);
        }
        return results;
    }
    parseDonorVehicleFromFilename(filename, expectedBrand) {
        if (!filename || !expectedBrand?.trim())
            return null;
        const stem = filename
            .split(/[\\/]/)
            .pop()
            ?.replace(/\.[^.]+$/, '')
            .trim();
        if (!stem)
            return null;
        const match = stem.match(/^((?:19|20)\d{2})\s+(.+?)\s+([A-HJ-NPR-Z0-9]{17})$/i);
        if (!match)
            return null;
        const year = Number(match[1]);
        if (year < 1900 || year > new Date().getFullYear() + 2)
            return null;
        const normalizeVehicleMakeAlias = (value) => value
            .replace(/^Infinity(?=\s|$)/i, 'Infiniti')
            .replace(/^Bently(?=\s|$)/i, 'Bentley');
        const vehicleLabel = normalizeVehicleMakeAlias(match[2].trim());
        const normalizedBrand = normalizeVehicleMakeAlias(expectedBrand)
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
        const make = [...automotive_oem_brands_js_1.AUTOMOTIVE_OEM_BRANDS]
            .filter((candidate) => !EnterpriseListingIntelligenceService_1.NON_VEHICLE_BRANDS.has(candidate.toLowerCase()))
            .sort((a, b) => b.length - a.length)
            .find((candidate) => {
            const normalizedMake = candidate.toLowerCase();
            return ((vehicleLabel.toLowerCase() === normalizedMake ||
                vehicleLabel.toLowerCase().startsWith(`${normalizedMake} `)) &&
                (normalizedBrand === normalizedMake ||
                    normalizedBrand.startsWith(`${normalizedMake} `)));
        });
        if (!make)
            return null;
        const modelFromFilename = vehicleLabel.slice(make.length).trim();
        const modelFromBrandCandidate = expectedBrand
            .trim()
            .slice(make.length)
            .trim();
        const modelFromBrand = (0, platform_generation_util_js_1.resolvePlatformModelFromTitle)(make, `${make} ${modelFromBrandCandidate}`);
        const model = modelFromFilename || modelFromBrand || '';
        return { year: String(year), make, model };
    }
    async resolveTitleSlots(products, marketplace) {
        if (marketplace !== 'US' && marketplace !== 'AU') {
            return new Map();
        }
        if (products.length === 0)
            return new Map();
        return this.titlePositionPartName.resolveBatch(products.map((product) => {
            const donorYear = product.donorVinDecoded?.['year']
                ? String(product.donorVinDecoded['year'])
                : (product.donorYear ?? undefined);
            const donorModel = product.donorVinDecoded?.['model']
                ? String(product.donorVinDecoded['model'])
                : (product.donorModel ?? undefined);
            const rawDesc = this.hasUntrustedPartType(product)
                ? product.title
                : (product.description ?? product.title);
            return {
                id: product.id,
                rawDesc,
                partNumber: product.oemPartNumber ?? product.mpn,
                make: (product.donorVinDecoded?.['make']
                    ? String(product.donorVinDecoded['make'])
                    : product.donorMake) ?? product.brand,
                model: donorModel,
                year: donorYear,
                categoryName: product.categoryName,
                fallbackPosition: product.placement,
                fallbackPartName: this.resolveDescriptivePartType(product),
            };
        }));
    }
    buildAiListingItem(product, options) {
        return {
            productData: {
                brand: product.brand,
                mpn: product.mpn,
                part_type: this.resolveDescriptivePartType(product),
                placement: product.placement,
                material: product.material,
                features: product.features,
                fitment: this.normalizeCompatibility(product.fitmentData).filter((row) => row.source === 'source_data'),
            },
            categoryName: product.categoryName ?? 'eBay Motors Parts & Accessories',
            condition: product.conditionLabel ?? product.conditionId ?? 'Used',
            options: {
                temperature: this.getTemperatureForProfile(options.listingQualityProfile),
                marketplace: options.marketplace,
                sellerCountry: resolveSellerCountryFromLocation(product.location),
            },
        };
    }
    static NON_DESCRIPTIVE_PART_TYPES = new Set([
        'oem',
        'aftermarket',
        'salvage',
        'used',
        'new',
        'refurbished',
        'general',
        'unknown',
        'other',
    ]);
    hasUntrustedPartType(product) {
        const raw = product.partType?.trim().toLowerCase();
        return (!raw ||
            EnterpriseListingIntelligenceService_1.NON_DESCRIPTIVE_PART_TYPES.has(raw));
    }
    resolveDescriptivePartType(product) {
        const raw = product.partType?.trim();
        if (raw && !this.hasUntrustedPartType(product)) {
            return raw;
        }
        const derived = (0, derive_part_name_from_title_js_1.derivePartNameFromTitle)(product.title, product.oemPartNumber ?? product.mpn, product.brand);
        return derived ?? raw ?? null;
    }
    async buildEnterpriseListing(product, marketplace, aiListing, titleSlots = null) {
        const baseSpecifics = this.extractBaseSpecifics(product);
        const category = await this.resolvePublishableCategory(product);
        let categoryId = category.categoryId;
        let categoryName = category.categoryName;
        const requiredSpecificNames = await this.getRequiredAspectsSafe(categoryId);
        let mergedSpecifics = { ...baseSpecifics };
        let specificsEvaluation = this.evaluateSpecifics(mergedSpecifics, requiredSpecificNames);
        const compatibility = this.normalizeCompatibility(product.fitmentData);
        const compatibilityValidRows = compatibility.filter((row) => row.source === 'source_data');
        const reviewTitleRows = this.normalizeReviewTitleEvidence([
            ...(Array.isArray(product.fitmentRows) ? product.fitmentRows : []),
            ...(Array.isArray(product.fitmentData) ? product.fitmentData : []),
        ], product.mpn?.trim() || product.oemPartNumber);
        const compatibilityRejected = compatibility.length - compatibilityValidRows.length;
        const fitmentConfidence = compatibilityValidRows.length > 0
            ? Math.round((compatibilityValidRows.reduce((sum, row) => sum + row.confidence, 0) /
                compatibilityValidRows.length) *
                100) / 100
            : 0;
        let optimizedTitle = this.buildFallbackTitle(product, marketplace);
        let subtitle = null;
        let seoDescription = this.buildFallbackDescription(product, marketplace, compatibilityValidRows);
        let shortDescription = this.buildShortDescription(product, marketplace);
        let aiTitleConfidence = 0.6;
        let aiDescriptionConfidence = 0.55;
        if (aiListing) {
            try {
                if (marketplace !== 'US' && marketplace !== 'AU') {
                    optimizedTitle = this.cleanTitle(aiListing.title, marketplace);
                    aiTitleConfidence = 0.85;
                }
                subtitle =
                    typeof aiListing.subtitle === 'string'
                        ? aiListing.subtitle.slice(0, 55)
                        : null;
                seoDescription = this.cleanDescription(aiListing.description, product, marketplace);
                shortDescription = this.buildShortDescriptionFromAi(aiListing.bulletPoints, product, marketplace);
                mergedSpecifics = this.mergeAiSpecifics(baseSpecifics, aiListing.itemSpecifics);
                specificsEvaluation = this.evaluateSpecifics(mergedSpecifics, requiredSpecificNames);
                aiDescriptionConfidence = 0.82;
            }
            catch (error) {
                this.logger.warn(`AI generation failed for product ${product.id}: ${String(error)}`);
            }
        }
        if (marketplace === 'DE') {
            const germanInput = this.toGermanListingInput(product, compatibilityValidRows, reviewTitleRows);
            const categoryHint = (0, ebay_german_listing_util_js_1.resolveMotorsCategoryFromPart)(product.partType, product.placement);
            if (categoryHint &&
                categoryId &&
                categoryHint.categoryId !== categoryId) {
                const exteriorIds = new Set(['33697', '174105', '179850']);
                const interiorIds = new Set(['33696', '262191', '262189']);
                if (interiorIds.has(categoryHint.categoryId) &&
                    exteriorIds.has(categoryId)) {
                    categoryId = categoryHint.categoryId;
                    categoryName = categoryHint.categoryName;
                }
            }
            const deterministicGermanTitle = (0, ebay_german_listing_util_js_1.buildGermanListingTitle)(germanInput);
            const hasExpectedYearRange = !germanInput.yearRange ||
                optimizedTitle.trim().startsWith(`${germanInput.yearRange} `);
            if (!(0, ebay_german_listing_util_js_1.isLikelyGermanText)(optimizedTitle) || !hasExpectedYearRange) {
                optimizedTitle = deterministicGermanTitle;
                aiTitleConfidence = Math.max(aiTitleConfidence, 0.88);
            }
            if (!subtitle) {
                subtitle = (0, ebay_german_listing_util_js_1.buildGermanListingSubtitle)(germanInput);
            }
            const plainDescLen = seoDescription.replace(/<[^>]+>/g, '').trim().length;
            if (plainDescLen < 120 || !(0, ebay_german_listing_util_js_1.isLikelyGermanText)(seoDescription)) {
                seoDescription = (0, ebay_german_listing_util_js_1.buildGermanListingDescription)(germanInput);
                aiDescriptionConfidence = Math.max(aiDescriptionConfidence, 0.86);
            }
            mergedSpecifics = {
                ...mergedSpecifics,
                ...(0, ebay_german_listing_util_js_1.buildGermanItemSpecifics)(germanInput),
            };
            specificsEvaluation = this.evaluateSpecifics(mergedSpecifics, requiredSpecificNames);
            shortDescription = this.buildShortDescriptionFromAi([optimizedTitle.split(' ').slice(0, 8).join(' ')], product, marketplace);
        }
        else if (marketplace === 'US' || marketplace === 'AU') {
            const englishInput = this.toEnglishListingInput(product, compatibilityValidRows, reviewTitleRows);
            if (titleSlots?.position) {
                englishInput.placement = titleSlots.position;
            }
            if (titleSlots?.partName) {
                englishInput.partType = titleSlots.partName;
            }
            const categoryHint = (0, ebay_english_listing_util_js_1.resolveMotorsCategoryFromPart)(englishInput.partType, englishInput.placement);
            if (categoryHint &&
                categoryId &&
                categoryHint.categoryId !== categoryId) {
                const exteriorIds = new Set(['33697', '174105', '179850']);
                const interiorIds = new Set(['33696', '262191', '262189']);
                if (interiorIds.has(categoryHint.categoryId) &&
                    exteriorIds.has(categoryId)) {
                    categoryId = categoryHint.categoryId;
                    categoryName = categoryHint.categoryName;
                }
            }
            const structuredTitle = (0, ebay_listing_text_util_js_1.buildStructuredEbayTitle)({
                yearRange: englishInput.yearRange,
                make: englishInput.brand,
                model: englishInput.model,
                generation: englishInput.generation,
                position: englishInput.placement,
                partName: englishInput.partType,
                oemPartNumber: englishInput.oemPartNumber ?? englishInput.mpn,
            });
            if (structuredTitle) {
                optimizedTitle = structuredTitle;
                aiTitleConfidence =
                    titleSlots?.source === 'gemini'
                        ? 0.92
                        : Math.max(aiTitleConfidence, 0.88);
            }
            else if ((0, ebay_english_listing_util_js_1.shouldRebuildEnglishTitle)(optimizedTitle, englishInput) ||
                optimizedTitle.length < 24) {
                optimizedTitle = (0, ebay_english_listing_util_js_1.buildEnglishListingTitle)(englishInput);
                aiTitleConfidence = Math.max(aiTitleConfidence, 0.88);
            }
            if (marketplace === 'AU') {
                optimizedTitle = (0, ebay_english_listing_util_js_1.applyAustralianSpelling)(optimizedTitle);
            }
            const plainDescLen = seoDescription.replace(/<[^>]+>/g, '').trim().length;
            if (plainDescLen < 120) {
                seoDescription = (0, ebay_english_listing_util_js_1.buildEnglishListingDescription)(englishInput, marketplace);
                aiDescriptionConfidence = Math.max(aiDescriptionConfidence, 0.86);
            }
            else if (marketplace === 'AU') {
                seoDescription = (0, ebay_english_listing_util_js_1.applyAustralianSpelling)(seoDescription);
            }
            mergedSpecifics = {
                ...mergedSpecifics,
                ...(0, ebay_english_listing_util_js_1.buildEnglishItemSpecifics)(englishInput),
            };
            specificsEvaluation = this.evaluateSpecifics(mergedSpecifics, requiredSpecificNames);
        }
        optimizedTitle = this.sanitizeOptimizedTitle(optimizedTitle, product, marketplace);
        const imageAnalysis = this.evaluateImages(product.imageUrls);
        const complianceWarnings = this.buildComplianceWarnings({
            title: optimizedTitle,
            expectedYearRange: this.toEnglishListingInput(product, compatibilityValidRows, reviewTitleRows).yearRange,
            categoryId,
            requiredSpecifics: specificsEvaluation.requiredTotal,
            requiredSpecificsPresent: specificsEvaluation.requiredPresent,
            compatibilityValidRows: compatibilityValidRows.length,
            imageCount: imageAnalysis.count,
            imageQuality: imageAnalysis.qualityScore,
            hasPrice: product.price != null && Number(product.price) > 0,
            marketplace,
            product,
            description: seoDescription,
            itemSpecifics: mergedSpecifics,
        });
        const errors = complianceWarnings.filter((i) => i.severity === 'error').length;
        const warnings = complianceWarnings.filter((i) => i.severity === 'warning').length;
        const missingDataReport = this.buildMissingDataReport(product, specificsEvaluation.details, compatibilityValidRows.length);
        const confidenceScores = {
            title: aiTitleConfidence,
            specifics: specificsEvaluation.coverage,
            fitment: fitmentConfidence,
            description: aiDescriptionConfidence,
            category: category.confidence,
            overall: this.round(aiTitleConfidence * 0.2 +
                specificsEvaluation.coverage * 0.25 +
                fitmentConfidence * 0.25 +
                aiDescriptionConfidence * 0.15 +
                category.confidence * 0.15),
        };
        const uploadReadinessScore = this.round(Math.max(0, confidenceScores.overall - errors * 0.25 - warnings * 0.05));
        const validationStatus = errors > 0 ? 'block' : uploadReadinessScore < 0.75 ? 'review' : 'pass';
        return {
            productId: product.id,
            sku: product.sku,
            optimizedTitle,
            subtitle,
            categoryId,
            categoryName,
            itemSpecifics: mergedSpecifics,
            specificsScore: {
                coverage: specificsEvaluation.coverage,
                requiredPresent: specificsEvaluation.requiredPresent,
                requiredTotal: specificsEvaluation.requiredTotal,
                details: specificsEvaluation.details,
            },
            compatibility,
            compatibilitySummary: {
                validRows: compatibilityValidRows.length,
                rejectedRows: compatibilityRejected,
                confidence: fitmentConfidence,
            },
            seoDescription,
            shortDescription,
            imageAnalysis,
            confidenceScores,
            complianceWarnings,
            validationStatus,
            missingDataReport,
            uploadReadinessScore,
            finalUploadPayload: this.buildFinalPayload({
                product,
                marketplace,
                categoryId,
                optimizedTitle,
                subtitle,
                seoDescription,
                itemSpecifics: mergedSpecifics,
                compatibility: compatibilityValidRows,
            }),
        };
    }
    mergeAiSpecifics(baseSpecifics, aiSpecifics) {
        const merged = { ...baseSpecifics };
        if (!aiSpecifics || typeof aiSpecifics !== 'object') {
            return merged;
        }
        for (const [rawKey, rawValue] of Object.entries(aiSpecifics)) {
            const key = String(rawKey ?? '').trim();
            const value = String(rawValue ?? '').trim();
            if (!key || !value)
                continue;
            if (value.length > 120)
                continue;
            if (!merged[key]) {
                merged[key] = value;
            }
        }
        return merged;
    }
    async resolvePublishableCategory(product) {
        const keywordMatch = (0, ebay_german_listing_util_js_1.resolveMotorsCategoryFromPart)(product.partType, product.placement);
        const hasUntrustedGenericIdentity = this.isUntrustedGenericPartIdentity(product.partType);
        const candidate = product.categoryId?.trim();
        if (candidate) {
            const isValid = await this.isMotorsCategory(candidate);
            if (isValid) {
                if (hasUntrustedGenericIdentity &&
                    !keywordMatch &&
                    candidate !== '9886') {
                    this.logger.warn(`Category ${candidate} (${product.categoryName ?? '?'}) for SKU ${product.sku ?? '?'} came from generic part identity ${product.partType ?? '?'} — using safe fallback`);
                    const fallback = await this.getFallbackLeafCategory();
                    return {
                        categoryId: fallback.categoryId,
                        categoryName: fallback.categoryName,
                        confidence: 0.4,
                    };
                }
                if (keywordMatch && keywordMatch.categoryId !== candidate) {
                    const keywordIsValid = await this.isMotorsCategory(keywordMatch.categoryId);
                    if (keywordIsValid) {
                        this.logger.warn(`Category ${candidate} (${product.categoryName ?? '?'}) for SKU ${product.sku ?? '?'} conflicts with deterministic part keyword ${product.partType ?? '?'} -> ${keywordMatch.categoryId} (${keywordMatch.categoryName}) — using keyword category`);
                        return { ...keywordMatch, confidence: 0.9 };
                    }
                }
                return {
                    categoryId: candidate,
                    categoryName: product.categoryName,
                    confidence: 0.95,
                };
            }
            this.logger.warn(`Category ${candidate} (${product.categoryName ?? '?'}) for SKU ${product.sku ?? '?'} is not a known Motors category — will re-resolve`);
        }
        if (keywordMatch) {
            const keywordIsValid = await this.isMotorsCategory(keywordMatch.categoryId);
            if (keywordIsValid) {
                return { ...keywordMatch, confidence: 0.85 };
            }
            this.logger.warn(`Keyword category ${keywordMatch.categoryId} (${keywordMatch.categoryName}) for SKU ${product.sku ?? '?'} is not currently publishable — will re-resolve`);
        }
        if (hasUntrustedGenericIdentity) {
            const fallback = await this.getFallbackLeafCategory();
            return {
                categoryId: fallback.categoryId,
                categoryName: fallback.categoryName,
                confidence: 0.35,
            };
        }
        const cachedByType = await this.lookupCachedCategoryByPartType(product.partType);
        if (cachedByType) {
            return { ...cachedByType, confidence: 0.8 };
        }
        const queries = [
            [product.brand, product.partType, product.title]
                .filter(Boolean)
                .join(' '),
            product.partType ? `automotive ${product.partType}` : null,
            product.partType ?? null,
        ].filter(Boolean);
        for (const query of queries) {
            const match = await this.findMotorsLeafFromSuggestions(query);
            if (match) {
                await this.cacheCategoryForPartType(product.partType, match.categoryId, match.categoryName);
                return { ...match, confidence: 0.75 };
            }
        }
        const fallback = await this.getFallbackLeafCategory();
        return {
            categoryId: fallback.categoryId,
            categoryName: fallback.categoryName,
            confidence: 0.3,
        };
    }
    async findMotorsLeafFromSuggestions(query) {
        const cacheKey = query.trim().toLowerCase();
        if (this.categorySuggestionCache.has(cacheKey)) {
            return this.categorySuggestionCache.get(cacheKey);
        }
        const inFlight = this.categorySuggestionInFlight.get(cacheKey);
        if (inFlight)
            return inFlight;
        const request = (async () => {
            let result = null;
            try {
                const suggestions = await this.taxonomy.getCategorySuggestions(query, EnterpriseListingIntelligenceService_1.MOTORS_TREE_ID);
                for (const s of suggestions) {
                    const catId = s.category?.categoryId;
                    if (!catId)
                        continue;
                    const underMotors = s.categoryTreeNodeAncestors?.some((a) => a.categoryId === '6000');
                    if (underMotors) {
                        result = {
                            categoryId: catId,
                            categoryName: s.category.categoryName,
                        };
                        break;
                    }
                }
                this.categorySuggestionCache.set(cacheKey, result);
            }
            catch {
            }
            finally {
                this.categorySuggestionInFlight.delete(cacheKey);
            }
            return result;
        })();
        this.categorySuggestionInFlight.set(cacheKey, request);
        return request;
    }
    isUntrustedGenericPartIdentity(partType) {
        const normalized = (partType ?? '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
        return EnterpriseListingIntelligenceService_1.UNTRUSTED_GENERIC_PART_IDENTITIES.has(normalized);
    }
    async getFallbackLeafCategory() {
        if (this.fallbackLeaf)
            return this.fallbackLeaf;
        this.fallbackLeaf = {
            categoryId: '9886',
            categoryName: 'Other Car & Truck Parts & Accessories',
        };
        return this.fallbackLeaf;
    }
    async isMotorsCategory(categoryId) {
        try {
            if (EnterpriseListingIntelligenceService_1.WRONG_VERTICAL_MOTORS_IDS.has(categoryId)) {
                return false;
            }
            let recognizedAsMotors = false;
            if (EnterpriseListingIntelligenceService_1.KEYWORD_MOTORS_IDS.has(categoryId)) {
                recognizedAsMotors = true;
            }
            else {
                const mapping = await this.categoryMappingRepo.findOne({
                    where: { ebayCategoryId: categoryId },
                });
                if (mapping) {
                    if (!mapping.isMotorsCategory)
                        return false;
                    recognizedAsMotors = true;
                }
            }
            if (!recognizedAsMotors)
                return false;
            if (EnterpriseListingIntelligenceService_1.KEYWORD_MOTORS_IDS.has(categoryId) ||
                categoryId === '9886') {
                return true;
            }
            return await this.isCurrentlyLeafCategory(categoryId);
        }
        catch {
            return false;
        }
    }
    normalizePartTypeKey(partType) {
        return (partType ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    }
    async lookupCachedCategoryByPartType(partType) {
        const norm = this.normalizePartTypeKey(partType);
        if (!norm)
            return null;
        try {
            const row = await this.categoryMappingRepo
                .createQueryBuilder('m')
                .where('m.active = true')
                .andWhere('m."isMotorsCategory" = true')
                .andWhere('(LOWER(m."productType") = :norm OR :norm = ANY(m.keywords))', {
                norm,
            })
                .getOne();
            return row
                ? { categoryId: row.ebayCategoryId, categoryName: row.ebayCategoryName }
                : null;
        }
        catch {
            return null;
        }
    }
    async cacheCategoryForPartType(partType, categoryId, categoryName) {
        const norm = this.normalizePartTypeKey(partType);
        if (!norm || !categoryId)
            return;
        try {
            const existing = await this.categoryMappingRepo.findOne({
                where: { ebayCategoryId: categoryId },
            });
            if (existing) {
                const kws = existing.keywords ?? [];
                if (!kws.includes(norm)) {
                    kws.push(norm);
                    await this.categoryMappingRepo.update({ ebayCategoryId: categoryId }, { keywords: kws, lastSyncedAt: new Date() });
                }
            }
            else {
                await this.categoryMappingRepo.save(this.categoryMappingRepo.create({
                    ebayCategoryId: categoryId,
                    ebayCategoryName: categoryName ?? '',
                    isMotorsCategory: true,
                    active: true,
                    productType: norm,
                    keywords: [norm],
                    lastSyncedAt: new Date(),
                }));
            }
        }
        catch (err) {
            this.logger.warn(`Failed to cache category ${categoryId} for part type "${norm}": ${err instanceof Error ? err.message : err}`);
        }
    }
    leafCategoryCache = new Map();
    async isCurrentlyLeafCategory(categoryId) {
        if (this.leafCategoryCache.has(categoryId)) {
            return this.leafCategoryCache.get(categoryId);
        }
        try {
            const subtree = await this.taxonomy.getCategorySubtree(categoryId, EnterpriseListingIntelligenceService_1.MOTORS_TREE_ID);
            const isLeaf = Boolean(subtree.categorySubtreeNode?.leafCategoryTreeNode);
            this.leafCategoryCache.set(categoryId, isLeaf);
            return isLeaf;
        }
        catch {
            return true;
        }
    }
    async getRequiredAspectsSafe(categoryId) {
        if (!categoryId)
            return ['Brand', 'Manufacturer Part Number'];
        try {
            const aspects = await this.taxonomy.getItemAspectsForCategory(categoryId);
            const required = aspects
                .filter((aspect) => aspect.aspectConstraint?.aspectRequired)
                .map((aspect) => aspect.localizedAspectName)
                .filter(Boolean);
            if (required.length > 0)
                return required;
        }
        catch {
        }
        return ['Brand', 'Manufacturer Part Number'];
    }
    extractBaseSpecifics(product) {
        const entries = [
            ['Brand', product.brand],
            ['Manufacturer Part Number', product.mpn],
            ['Interchange Part Number', product.oemPartNumber],
            ['OE/OEM Part Number', product.oemPartNumber],
            ['Type', product.partType],
            ['Placement on Vehicle', product.placement],
            ['Material', product.material],
            ['Features', product.features],
            ['Country/Region of Manufacture', product.countryOfOrigin],
            ['UPC', product.upc],
            ['EAN', product.ean],
            ['Condition', product.conditionLabel ?? product.conditionId],
        ];
        const specifics = {};
        for (const [key, value] of entries) {
            if (value && String(value).trim())
                specifics[key] = String(value).trim();
        }
        return specifics;
    }
    evaluateSpecifics(itemSpecifics, requiredFields) {
        const requiredSet = new Set(requiredFields);
        const knownFields = new Set([
            ...requiredFields,
            'Interchange Part Number',
            'OE/OEM Part Number',
            'Type',
            'Placement on Vehicle',
            'Material',
            'Features',
            'Country/Region of Manufacture',
            'UPC',
            'EAN',
            'Condition',
        ]);
        const details = [];
        let requiredPresent = 0;
        for (const field of knownFields) {
            const value = itemSpecifics[field];
            const present = Boolean(value && value.trim());
            const required = requiredSet.has(field);
            if (required && present)
                requiredPresent++;
            details.push({
                field,
                required,
                present,
                inferred: false,
                confidence: present ? 0.95 : 0,
                source: present ? 'source_data' : 'missing',
            });
        }
        const requiredTotal = requiredFields.length || 1;
        const coverage = this.round(requiredPresent / requiredTotal);
        return { coverage, requiredPresent, requiredTotal, details };
    }
    normalizeCompatibility(fitmentData) {
        if (!Array.isArray(fitmentData) || fitmentData.length === 0)
            return [];
        const rows = [];
        for (const raw of fitmentData) {
            const make = scalarText(raw['Make'] ?? raw['make']);
            const model = scalarText(raw['Model'] ?? raw['model']);
            const year = scalarText(raw['Year'] ?? raw['year']);
            const trim = scalarText(raw['Trim'] ?? raw['trim']) || undefined;
            const engine = scalarText(raw['Engine'] ?? raw['engine']) || undefined;
            const drivetrain = scalarText(raw['Drivetrain'] ?? raw['drivetrain']) || undefined;
            const bodyStyle = scalarText(raw['Body Style'] ?? raw['bodyStyle']) || undefined;
            const storedStatuses = [
                scalarText(raw['validationStatus']).toLowerCase(),
                scalarText(raw['MvlStatus'] ?? raw['mvlStatus']).toLowerCase(),
            ];
            const storedStatus = storedStatuses.includes('rejected')
                ? 'rejected'
                : storedStatuses.includes('needs_review')
                    ? 'needs_review'
                    : storedStatuses.includes('valid')
                        ? 'valid'
                        : '';
            const yearNum = Number(year);
            const yearValid = Number.isFinite(yearNum) &&
                yearNum >= 1900 &&
                yearNum <= new Date().getFullYear() + 2;
            if (!make || !model || !year || !yearValid) {
                rows.push({
                    make,
                    model,
                    year,
                    trim,
                    engine,
                    drivetrain,
                    bodyStyle,
                    confidence: 0,
                    source: 'rejected',
                    rejectedReason: 'Missing or invalid Year/Make/Model',
                });
                continue;
            }
            if (storedStatus === 'needs_review' || storedStatus === 'rejected') {
                rows.push({
                    make,
                    model,
                    year,
                    trim,
                    engine,
                    drivetrain,
                    bodyStyle,
                    confidence: 0,
                    source: 'rejected',
                    rejectedReason: `Fitment row remains ${storedStatus}`,
                });
                continue;
            }
            rows.push({
                make,
                model,
                year,
                trim,
                engine,
                drivetrain,
                bodyStyle,
                confidence: this.round(trim || engine ? 0.92 : 0.82),
                source: 'source_data',
            });
        }
        return rows;
    }
    normalizeReviewTitleEvidence(fitmentRows, expectedMpn) {
        if (!Array.isArray(fitmentRows))
            return [];
        const expectedMpnKey = (expectedMpn ?? '')
            .replace(/[^a-z0-9]/gi, '')
            .toUpperCase();
        const rows = [];
        for (const raw of fitmentRows) {
            const evidenceSource = scalarText(raw['source']).toLowerCase();
            const notes = scalarText(raw['notes'] ?? raw['Notes']);
            const citedMpn = notes.match(/^\s*Exact MPN\s+([^\s]+)\s+matched\b/i)?.[1];
            const notesMpnKey = notes.replace(/[^a-z0-9]/gi, '').toUpperCase();
            const validationStatus = scalarText(raw['validationStatus']).toLowerCase();
            const mvlStatus = scalarText(raw['mvlStatus'] ?? raw['MvlStatus']).toLowerCase();
            const notesMatchExpectedMpn = evidenceSource === 'oem_catalog_lookup'
                ? citedMpn?.replace(/[^a-z0-9]/gi, '').toUpperCase() ===
                    expectedMpnKey
                : notesMpnKey.includes(expectedMpnKey);
            const hasExplicitOemRange = evidenceSource === 'oem_catalog_lookup' &&
                notes.split(/\r?\n/).some((line) => /^\s*[-*•]\s*((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\s+\S+/i.test(line));
            const isMvlCheckedReview = validationStatus === 'needs_review' && mvlStatus === 'valid';
            const isExactOemTitleReview = evidenceSource === 'oem_catalog_lookup' &&
                notesMatchExpectedMpn &&
                hasExplicitOemRange &&
                ['needs_review', 'rejected'].includes(validationStatus);
            if ((evidenceSource !== 'ebay_mpn_lookup' &&
                evidenceSource !== 'oem_catalog_lookup') ||
                (!isMvlCheckedReview && !isExactOemTitleReview) ||
                !expectedMpnKey ||
                !notesMatchExpectedMpn) {
                continue;
            }
            const make = scalarText(raw['make'] ?? raw['Make']);
            const model = scalarText(raw['model'] ?? raw['Model']);
            const year = scalarText(raw['year'] ?? raw['Year']);
            const yearNum = Number(year);
            if (!make ||
                !model ||
                !Number.isInteger(yearNum) ||
                yearNum < 1900 ||
                yearNum > new Date().getFullYear() + 2) {
                continue;
            }
            rows.push({
                make,
                model,
                year,
                trim: scalarText(raw['trim'] ?? raw['Trim']) || undefined,
                notes: notes || undefined,
                confidence: 0.6,
                source: 'rejected',
                evidenceSource,
                ...(mvlStatus === 'valid' ||
                    mvlStatus === 'needs_review' ||
                    mvlStatus === 'rejected'
                    ? { mvlStatus }
                    : {}),
            });
        }
        return rows;
    }
    evaluateImages(imageUrls) {
        const findings = [];
        const recommendations = [];
        const count = Array.isArray(imageUrls)
            ? imageUrls.filter(Boolean).length
            : 0;
        if (count === 0)
            findings.push('No product images detected');
        if (count > 0 && count < 3)
            findings.push('Low image count for high-conversion Motors listing');
        if (count > 0 && count < 6) {
            findings.push('Interior/trim parts typically need 6–12 photos (front, back, clips, label, wear)');
        }
        if (imageUrls.some((url) => /watermark|placeholder|default|logo-only/i.test(url))) {
            findings.push('Potential watermark/placeholder style image detected');
        }
        if (count < 6)
            recommendations.push('Add 6-12 images: front, side, rear, labels, connectors, defects');
        recommendations.push('Prioritize first image with clear part angle on clean background');
        recommendations.push('Add close-up of OEM/MPN label to improve buyer trust and returns reduction');
        let qualityScore = 0.85;
        if (count === 0)
            qualityScore = 0;
        else if (count < 3)
            qualityScore = 0.55;
        else if (count < 6)
            qualityScore = 0.75;
        if (findings.some((f) => f.includes('watermark')))
            qualityScore -= 0.1;
        qualityScore = this.round(Math.max(0, qualityScore));
        const readinessScore = this.round(Math.max(0, qualityScore - (count === 0 ? 0.4 : 0)));
        return { count, qualityScore, readinessScore, findings, recommendations };
    }
    buildComplianceWarnings(input) {
        const issues = [];
        if (!input.title || input.title.length > 80) {
            issues.push({
                code: 'TITLE_INVALID',
                severity: 'error',
                field: 'title',
                message: 'Title missing or exceeds 80 characters',
            });
        }
        const expectedYearRange = (0, platform_generation_util_js_1.parseYearRange)(input.expectedYearRange);
        const titleYearMatch = input.title
            .trim()
            .match(/^((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?(?:\s|$)/);
        if (!expectedYearRange) {
            issues.push({
                code: 'TITLE_YEAR_RANGE_MISSING',
                severity: 'error',
                field: 'title',
                message: 'A contiguous, part-number-matched year range validated for the target marketplace is required for an eBay Motors title',
            });
        }
        else if (!titleYearMatch) {
            issues.push({
                code: 'TITLE_YEAR_RANGE_MISSING',
                severity: 'error',
                field: 'title',
                message: `Title must begin with the required year range ${input.expectedYearRange}`,
            });
        }
        else {
            const titleStart = Number(titleYearMatch[1]);
            const titleEnd = Number(titleYearMatch[2] ?? titleYearMatch[1]);
            if (titleEnd < titleStart ||
                titleStart !== expectedYearRange.min ||
                titleEnd !== expectedYearRange.max) {
                issues.push({
                    code: 'TITLE_YEAR_RANGE_MISMATCH',
                    severity: 'error',
                    field: 'title',
                    message: `Title year range must match the required range ${input.expectedYearRange}`,
                });
            }
        }
        if (!input.categoryId) {
            issues.push({
                code: 'CATEGORY_MISSING',
                severity: 'error',
                field: 'categoryId',
                message: 'Category is missing',
            });
        }
        if (input.requiredSpecificsPresent < input.requiredSpecifics) {
            issues.push({
                code: 'REQUIRED_SPECIFICS_MISSING',
                severity: 'error',
                field: 'itemSpecifics',
                message: `Required specifics incomplete (${input.requiredSpecificsPresent}/${input.requiredSpecifics})`,
            });
        }
        if (input.compatibilityValidRows === 0) {
            issues.push({
                code: 'FITMENT_MISSING',
                severity: 'warning',
                field: 'compatibility',
                message: 'No validated fitment rows; listing should be routed to review',
            });
        }
        if (input.imageCount === 0) {
            issues.push({
                code: 'IMAGE_MISSING',
                severity: 'error',
                field: 'images',
                message: 'At least one product image is required',
            });
        }
        else if (input.imageQuality < 0.65) {
            issues.push({
                code: 'IMAGE_QUALITY_LOW',
                severity: 'warning',
                field: 'images',
                message: 'Image quality/readiness below recommended threshold',
            });
        }
        if (!input.hasPrice) {
            issues.push({
                code: 'PRICE_MISSING',
                severity: 'error',
                field: 'price',
                message: 'Positive price is required for upload',
            });
        }
        if (input.marketplace === 'DE' &&
            input.product &&
            input.description &&
            input.itemSpecifics) {
            const deValidation = (0, ebay_german_listing_util_js_1.validateGermanListing)({
                title: input.title,
                description: input.description,
                itemSpecifics: input.itemSpecifics,
                categoryId: input.categoryId,
                categoryName: input.product.categoryName,
                partType: input.product.partType,
                placement: input.product.placement,
                mpn: input.product.mpn,
                oemPartNumber: input.product.oemPartNumber,
            });
            for (const issue of deValidation.issues) {
                issues.push({
                    code: issue.code,
                    severity: issue.severity,
                    field: issue.field,
                    message: issue.message,
                });
            }
        }
        if ((input.marketplace === 'US' || input.marketplace === 'AU') &&
            input.product &&
            input.description &&
            input.itemSpecifics) {
            const enValidation = (0, ebay_english_listing_util_js_1.validateEnglishListing)({
                title: input.title,
                description: input.description,
                itemSpecifics: input.itemSpecifics,
                categoryId: input.categoryId,
                categoryName: input.product.categoryName,
                partType: input.product.partType,
                placement: input.product.placement,
                mpn: input.product.mpn,
                oemPartNumber: input.product.oemPartNumber,
            });
            for (const issue of enValidation.issues) {
                issues.push({
                    code: issue.code,
                    severity: issue.severity,
                    field: issue.field,
                    message: issue.message,
                });
            }
        }
        return issues;
    }
    toEnglishListingInput(product, fitmentRows, reviewTitleRows = []) {
        const german = this.toGermanListingInput(product, fitmentRows, reviewTitleRows);
        return {
            brand: german.brand,
            model: german.model,
            partType: german.partType,
            placement: german.placement,
            mpn: german.mpn,
            oemPartNumber: german.oemPartNumber,
            condition: german.condition,
            material: german.material,
            donorVehicle: german.donorVehicle,
            yearRange: german.yearRange,
            generation: german.generation,
            fitmentRows: german.fitmentRows,
            fitmentConfirmed: german.fitmentConfirmed,
            sellerCountry: german.sellerCountry,
            categoryId: product.categoryId,
            categoryName: product.categoryName,
        };
    }
    static NON_VEHICLE_BRANDS = new Set([
        'acdelco',
        'bosch',
        'continental',
        'delphi',
        'denso',
        'genuine oem',
        'genuine',
        'mopar',
        'motorcraft',
        'valeo',
        'unbranded',
        'oem',
        'aftermarket',
        'n/a',
        'na',
        'unknown',
        'none',
        'generic',
    ]);
    resolveVehicleMake(product, fitmentRows) {
        const raw = product.brand?.trim();
        if (raw &&
            !EnterpriseListingIntelligenceService_1.NON_VEHICLE_BRANDS.has(raw.toLowerCase())) {
            return raw;
        }
        return fitmentRows[0]?.make || null;
    }
    toGermanListingInput(product, fitmentRows, reviewTitleRows = []) {
        const decoded = product.donorVinDecoded;
        const decodedYear = scalarText(decoded?.['year']);
        const donorYear = decodedYear || (product.donorYear?.trim() ?? '');
        const titleIdentityRows = fitmentRows.length > 0 ? fitmentRows : reviewTitleRows;
        const resolvedMake = titleIdentityRows[0]?.make ||
            product.donorMake?.trim() ||
            this.resolveVehicleMake(product, fitmentRows);
        const decodedMake = scalarText(decoded?.['make']);
        const decodedModel = scalarText(decoded?.['model']);
        const donorMake = decodedMake || product.donorMake?.trim() || resolvedMake || '';
        const titleModelHint = (0, platform_generation_util_js_1.resolvePlatformModelFromTitle)(donorMake || resolvedMake, product.title);
        const donorModel = decodedModel ||
            product.donorModel?.trim() ||
            titleModelHint ||
            titleIdentityRows[0]?.model ||
            '';
        const titleModel = donorModel ||
            titleIdentityRows[0]?.model ||
            decodedModel;
        const donorVehicle = [donorYear, donorMake, donorModel].filter(Boolean).join(' ').trim() ||
            undefined;
        const titleRangeRows = this.selectTitleRangeRows(fitmentRows, reviewTitleRows, titleIdentityRows[0], titleModel, product.mpn?.trim() || product.oemPartNumber);
        const years = titleRangeRows
            .map((r) => Number(r.year))
            .filter((y) => Number.isFinite(y));
        const yearRangeFromFitment = years.length >= 1
            ? (0, platform_generation_util_js_1.formatYearRange)(Math.min(...years), Math.max(...years))
            : undefined;
        const titleAnchorYear = titleRangeRows[0]?.year;
        const platform = titleAnchorYear
            ? (0, platform_generation_util_js_1.resolvePlatformGeneration)(resolvedMake, titleModel || product.brand, titleAnchorYear)
            : null;
        const aligned = (0, platform_generation_util_js_1.alignGenerationAndYearRange)({
            generation: platform?.code,
            yearRange: yearRangeFromFitment,
            make: donorMake || resolvedMake,
            model: titleModel || fitmentRows[0]?.model,
            anchorYear: titleAnchorYear,
            fitmentYears: yearRangeFromFitment
                ? titleRangeRows.map((r) => r.year)
                : [],
        });
        return {
            brand: resolvedMake,
            model: titleModel || fitmentRows[0]?.model || undefined,
            partType: this.resolveDescriptivePartType(product) ?? undefined,
            placement: product.placement,
            mpn: product.mpn,
            oemPartNumber: product.oemPartNumber ?? product.mpn,
            condition: product.conditionLabel ?? product.conditionId,
            material: product.material,
            donorVehicle,
            yearRange: aligned.yearRange,
            generation: aligned.generation || undefined,
            fitmentRows: fitmentRows.map((r) => ({
                year: r.year,
                make: r.make,
                model: r.model,
                trim: r.trim,
            })),
            fitmentConfirmed: fitmentRows.length > 0 &&
                product.fitmentConfidence != null &&
                Number(product.fitmentConfidence) >= 0.85,
            sellerCountry: resolveSellerCountryFromLocation(product.location),
            categoryId: product.categoryId,
            categoryName: product.categoryName,
        };
    }
    selectTitleRangeRows(validRows, reviewTitleRows, primary, titleModel, expectedMpn) {
        if (!primary)
            return [];
        const titleModelTokens = this.vehicleModelTokens(titleModel ?? '');
        if (titleModelTokens.length === 0)
            return [];
        const requestedTokens = new Set(titleModelTokens);
        const makeKey = primary.make.trim().toLowerCase();
        const titleCandidates = [...validRows, ...reviewTitleRows].filter((row) => {
            if (row.make.trim().toLowerCase() !== makeKey)
                return false;
            const rowTokens = this.vehicleModelTokens(`${row.model} ${row.trim ?? ''}`);
            return titleModelTokens.every((token) => rowTokens.includes(token));
        });
        if (titleCandidates.length === 0)
            return [];
        const closestCandidate = [...titleCandidates].sort((a, b) => {
            const extraTokens = (row) => this.vehicleModelTokens(`${row.model} ${row.trim ?? ''}`).filter((token) => !requestedTokens.has(token)).length;
            return extraTokens(a) - extraTokens(b);
        })[0];
        const modelKey = closestCandidate.model.trim().toLowerCase();
        const modelTokens = new Set(this.vehicleModelTokens(closestCandidate.model));
        const requestedVariantTokens = titleModelTokens.filter((token) => !modelTokens.has(token));
        const closestTrimKey = (closestCandidate.trim ?? '').trim().toLowerCase();
        const yearsByYear = new Map();
        for (const row of titleCandidates) {
            if (row.model.trim().toLowerCase() !== modelKey)
                continue;
            const rowTrimTokens = this.vehicleModelTokens(row.trim ?? '');
            if (requestedVariantTokens.length > 0
                ? !requestedVariantTokens.every((token) => rowTrimTokens.includes(token))
                : (row.trim ?? '').trim().toLowerCase() !== closestTrimKey)
                continue;
            const year = Number(row.year);
            if (Number.isInteger(year))
                yearsByYear.set(year, row);
        }
        const years = [...yearsByYear.keys()].sort((a, b) => a - b);
        if (years.length <= 1) {
            return years.length === 1
                ? [yearsByYear.get(years[0])]
                : this.selectExplicitOemYearRange(titleCandidates.filter((row) => row.model.trim().toLowerCase() === modelKey), closestCandidate, expectedMpn);
        }
        const span = years[years.length - 1] - years[0];
        if (span > mvl_donor_scope_util_js_1.MAX_FITMENT_YEAR_SPAN ||
            years.length !== span + 1 ||
            years.some((year, index) => index > 0 && year !== years[index - 1] + 1)) {
            return this.selectExplicitOemYearRange(titleCandidates.filter((row) => row.model.trim().toLowerCase() === modelKey), closestCandidate, expectedMpn);
        }
        return years.map((year) => yearsByYear.get(year));
    }
    selectExplicitOemYearRange(rows, target, expectedMpn) {
        const range = (0, exact_oem_year_range_util_js_1.findCitedExactOemYearRange)(rows.map((row) => ({
            make: row.make,
            model: row.model,
            trim: row.trim,
            notes: row.notes,
            evidenceSource: row.evidenceSource,
            mvlStatus: row.mvlStatus,
        })), expectedMpn, { make: target.make, model: target.model, trim: target.trim }, mvl_donor_scope_util_js_1.MAX_FITMENT_YEAR_SPAN, new Date().getFullYear() + 2);
        if (!range)
            return [];
        return Array.from({ length: range.endYear - range.startYear + 1 }, (_, index) => ({
            make: range.make,
            model: target.model,
            year: String(range.startYear + index),
            ...(target.trim ? { trim: target.trim } : {}),
            confidence: 0.6,
            source: 'rejected',
            evidenceSource: 'oem_catalog_lookup',
            mvlStatus: 'valid',
        }));
    }
    vehicleModelTokens(value) {
        return value
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((token) => (token.length > 1 || /^[a-z]$/.test(token)) &&
            !/^(?:19|20)\d{2}$/.test(token) &&
            !/^mk\d+$/.test(token));
    }
    buildMissingDataReport(product, specifics, compatibilityRows) {
        const missing = specifics
            .filter((s) => s.required && !s.present)
            .map((s) => `Missing required specific: ${s.field}`);
        if (!product.description || product.description.trim().length < 60) {
            missing.push('Description is too short for production listing quality');
        }
        if (compatibilityRows === 0)
            missing.push('No validated compatibility rows');
        if (!product.imageUrls?.length)
            missing.push('No images provided');
        return missing;
    }
    cleanTitle(title, marketplace) {
        const normalized = title.replace(/\s+/g, ' ').trim();
        const local = this.localizeText(normalized, marketplace);
        return local.slice(0, 80);
    }
    sanitizeOptimizedTitle(title, product, marketplace) {
        let result = title;
        const pn = (product.oemPartNumber ?? product.mpn ?? '')?.trim();
        if (pn && pn.length >= 5) {
            const escaped = pn
                .split('')
                .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const pattern = new RegExp(escaped.join('\\s*'), 'i');
            const match = result.match(pattern);
            if (match && match[0].length <= pn.length + 12) {
                result = result.replace(pattern, pn);
            }
        }
        if (marketplace !== 'DE') {
            result = result
                .replace(/[^A-Za-z0-9\s\-/&.,+]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }
        return result;
    }
    cleanDescription(description, product, marketplace) {
        if (!description || description.trim().length < 250) {
            return this.buildFallbackDescription(product, marketplace, []);
        }
        return this.localizeText(this.ensureEnterpriseDescriptionQuality(description), marketplace);
    }
    ensureEnterpriseDescriptionQuality(description) {
        const normalized = description.trim();
        const requiredSections = [
            'Overview',
            'Features',
            'Specifications',
            'Fitment',
            'Condition Notes',
        ];
        const missing = requiredSections.filter((section) => !new RegExp(`<h3>\\s*${section}\\s*</h3>`, 'i').test(normalized));
        if (missing.length === 0) {
            return normalized;
        }
        return `${normalized}
<h3>Condition Notes</h3>
<p>Please review product photos, part numbers, and fitment details before purchase to confirm compatibility.</p>`;
    }
    buildFallbackTitle(product, marketplace) {
        if (marketplace === 'DE') {
            return (0, ebay_german_listing_util_js_1.buildGermanListingTitle)(this.toGermanListingInput(product, []));
        }
        if (marketplace === 'US' || marketplace === 'AU') {
            const title = (0, ebay_english_listing_util_js_1.buildEnglishListingTitle)(this.toEnglishListingInput(product, []));
            return marketplace === 'AU' ? (0, ebay_english_listing_util_js_1.applyAustralianSpelling)(title) : title;
        }
        const parts = [
            product.brand,
            product.partType,
            product.mpn,
            product.placement ? `for ${product.placement}` : null,
        ]
            .filter((v) => Boolean(v && v.trim()))
            .join(' ');
        return this.cleanTitle(parts || product.title || 'Automotive Part', marketplace);
    }
    buildFallbackDescription(product, marketplace, compatibility) {
        if (marketplace === 'DE') {
            return (0, ebay_german_listing_util_js_1.buildGermanListingDescription)(this.toGermanListingInput(product, compatibility));
        }
        if (marketplace === 'US' || marketplace === 'AU') {
            return (0, ebay_english_listing_util_js_1.buildEnglishListingDescription)(this.toEnglishListingInput(product, compatibility), marketplace);
        }
        const compatibilityText = compatibility.length
            ? compatibility
                .slice(0, 10)
                .map((c) => `${c.year} ${c.make} ${c.model}${c.trim ? ` ${c.trim}` : ''}`)
                .join(', ')
            : 'Please verify fitment before purchase.';
        const body = `<h3>Product Overview</h3>
<p>${product.title}</p>
<h3>Technical Specifications</h3>
<ul>
  <li>Brand: ${product.brand ?? 'Not specified'}</li>
  <li>MPN: ${product.mpn ?? 'Not specified'}</li>
  <li>Type: ${product.partType ?? 'Not specified'}</li>
  <li>Condition: ${product.conditionLabel ?? product.conditionId ?? 'Not specified'}</li>
</ul>
<h3>Compatibility Summary</h3>
<p>${compatibilityText}</p>
<h3>Important Notices</h3>
<p>Please match part numbers and vehicle details prior to ordering.</p>`;
        return this.localizeText(body, marketplace);
    }
    buildShortDescription(product, marketplace) {
        const short = `${product.brand ?? 'Auto Part'} ${product.partType ?? ''} ${product.mpn ?? ''}`.trim();
        return this.localizeText(short.slice(0, 160), marketplace);
    }
    buildShortDescriptionFromAi(bulletPoints, product, marketplace) {
        if (!Array.isArray(bulletPoints) || bulletPoints.length === 0) {
            return this.buildShortDescription(product, marketplace);
        }
        return this.localizeText(bulletPoints.slice(0, 3).join(' | ').slice(0, 220), marketplace);
    }
    localizeText(text, marketplace) {
        if (marketplace === 'DE') {
            if ((0, ebay_german_listing_util_js_1.isLikelyGermanText)(text))
                return text;
            return text;
        }
        if (marketplace === 'AU') {
            return text
                .replace(/\bmiles\b/gi, 'kilometres')
                .replace(/\binches\b/gi, 'mm')
                .replace(/\bshipping\b/gi, 'shipping (AU)');
        }
        return text;
    }
    buildFinalPayload(input) {
        return {
            marketplace: input.marketplace,
            sku: input.product.sku,
            title: input.optimizedTitle,
            subtitle: input.subtitle,
            categoryId: input.categoryId,
            conditionId: input.product.conditionId,
            description: input.seoDescription,
            price: input.product.price,
            quantity: input.product.quantity,
            imageUrls: input.product.imageUrls,
            itemSpecifics: input.itemSpecifics,
            compatibility: input.compatibility.map((row) => ({
                Make: row.make,
                Model: row.model,
                Year: row.year,
                Trim: row.trim,
                Engine: row.engine,
                Drivetrain: row.drivetrain,
                BodyStyle: row.bodyStyle,
            })),
            shippingProfileName: input.product.shippingProfile,
            returnProfileName: input.product.returnProfile,
            paymentProfileName: input.product.paymentProfile,
        };
    }
    round(value) {
        return Math.round(value * 100) / 100;
    }
    getTemperatureForProfile(profile) {
        if (profile === 'creative_exploration')
            return 0.65;
        if (profile === 'balanced')
            return 0.4;
        return 0.25;
    }
    getContentRequirements(profile) {
        if (profile === 'creative_exploration') {
            return [
                'Use varied phrasing while staying factual.',
                'Introduce stronger merchandising language where claims are verifiable.',
            ];
        }
        if (profile === 'balanced') {
            return [
                'Blend SEO keyword coverage with concise readability.',
                'Keep technical specifics clear and structured.',
            ];
        }
        return [
            'Prioritize SEO completeness, technical accuracy, and buyer confidence.',
            'Produce comprehensive, conversion-focused listing copy with explicit fitment caveats.',
        ];
    }
};
exports.EnterpriseListingIntelligenceService = EnterpriseListingIntelligenceService;
exports.EnterpriseListingIntelligenceService = EnterpriseListingIntelligenceService = EnterpriseListingIntelligenceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(pipeline_job_entity_js_1.PipelineJob)),
    __param(1, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(2, (0, typeorm_1.InjectRepository)(ebay_category_mapping_entity_js_1.EbayCategoryMapping)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        listing_generation_pipeline_js_1.ListingGenerationPipeline,
        title_position_part_name_pipeline_js_1.TitlePositionPartNamePipeline,
        ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService])
], EnterpriseListingIntelligenceService);
//# sourceMappingURL=enterprise-listing-intelligence.service.js.map