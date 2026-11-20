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
var FashionImageAnalysisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FashionImageAnalysisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const storage_service_js_1 = require("../storage/storage.service.js");
const image_processor_service_js_1 = require("../storage/image-processor.service.js");
const openai_service_js_1 = require("../common/openai/openai.service.js");
const ai_run_log_service_js_1 = require("../common/openai/ai-run-log.service.js");
const model_router_js_1 = require("../common/openai/model-router.js");
const json_sanitizer_js_1 = require("../common/openai/json-sanitizer.js");
const ebay_taxonomy_api_service_js_1 = require("../channels/ebay/ebay-taxonomy-api.service.js");
const ebay_listing_text_util_js_1 = require("../channels/ebay/ebay-listing-text.util.js");
const fashion_storage_keys_util_js_1 = require("./fashion-storage-keys.util.js");
const fashion_config_js_1 = require("./fashion.config.js");
const MAX_PHOTOS = 24;
const MAX_VISION_IMAGES = 12;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
]);
const PROMPT_VERSION = 'fashion-image-identification-v2';
const DEFAULT_FASHION_AI_MODEL = 'google/gemini-3.1-flash-lite';
const DEFAULT_FASHION_AI_FALLBACK_MODEL = 'google/gemma-4-31b-it';
const VISION_SYSTEM_PROMPT = `You identify photographed fashion inventory for an e-commerce listing draft. Analyze every submitted image together as one garment or accessory, including readable brand, size, and care labels.

Return JSON only:
{"itemType":string|null,"productType":string|null,"categoryFamily":"clothing"|"footwear"|"accessories"|null,"categorySearchQuery":string|null,"brand":string|null,"department":string|null,"size":string|null,"sizeSystem":string|null,"sizeType":string|null,"color":string|null,"secondaryColor":string|null,"pattern":string|null,"style":string|null,"material":string|null,"composition":string|null,"fabricType":string|null,"sleeveLength":string|null,"neckline":string|null,"closure":string|null,"length":string|null,"fit":string|null,"chestMeasurement":string|null,"waistMeasurement":string|null,"hipMeasurement":string|null,"lengthMeasurement":string|null,"inseamMeasurement":string|null,"measurementsUnit":string|null,"measurements":string|null,"wear":string|null,"stains":string|null,"holes":string|null,"pilling":string|null,"fading":string|null,"repairs":string|null,"missingComponents":string|null,"otherDefects":string|null,"conditionDetails":string|null,"conditionLabel":"NEW"|"USED"|"UNKNOWN"|null,"shoeSize":string|null,"shoeSizeSystem":string|null,"width":string|null,"footwearType":string|null,"accessoryType":string|null,"accessoryDimensions":string|null,"accessoryMaterial":string|null,"countryOfManufacture":string|null,"features":string[],"season":string|null,"occasion":string|null,"theme":string|null,"vintage":"Yes"|"No"|null,"garmentCare":string|null,"title":string|null,"description":string|null,"visibleText":string[],"warnings":string[],"conflicts":string[],"multipleDifferentItems":boolean,"reviewPhotoSet":boolean}

Rules:
- Treat output as editable suggestions, not facts.
- Do not invent brand, size, composition, measurements, authenticity, or condition.
- Prefer readable label text over a visual guess.
- Leave unavailable information null.
- If evidence conflicts, list it in conflicts and leave the field null.
- Do not infer exact physical measurements from ordinary photos.
- Do not convert between sizing systems. Preserve the original label value exactly as printed (for example "LG" stays "LG", Lacoste "4" stays "4").
- Fill every field the photos or labels support; a field left null is typed by hand later. Leave a field null only when nothing visible supports it.
- material is the fiber (for example Wool, Merino Wool, Cotton, Cashmere) and only from a label; knit or woven construction belongs in fabricType.
- sizeType is one of "Regular", "Petite", "Plus", "Big & Tall", "Tall", "Maternity"; use "Regular" for standard adult sizes unless the label says otherwise.
- countryOfManufacture only from a "Made in" label, as the country name (for example "China").
- garmentCare only from readable care symbols or text (for example "Machine Washable", "Dry Clean Only", "Hand Wash Only"). "Care on reverse" is not a care instruction; leave garmentCare null.
- features lists visible features such as "Pockets", "Logo", "Buttons", "Hooded", "Lined".
- season ("Fall", "Winter", "Spring", "Summer") and occasion ("Casual", "Business", "Formal", "Activewear", "Outdoor") may be inferred from the garment type and fabric weight.
- vintage is "Yes" only when labels or construction clearly indicate an older garment; otherwise "No".
- conditionLabel is "NEW" only when original retail tags are attached; a garment without retail tags is "USED".
- department is one of "Men", "Women", "Unisex Adults", "Boys", "Girls", "Unisex Kids", "Baby", or null when no label or cut makes it clear.
- title is an eBay title of at most 80 characters: brand, department, item type, key material, color, size. No marketing words.
- Do not identify a person or infer sensitive personal characteristics from photos that contain models.
- If photos appear to contain multiple different items, set multipleDifferentItems and reviewPhotoSet to true. Do not split them into multiple records.
- This is not automotive or industrial identification. Never return vehicle make, model, year, VIN, engine, fitment, OEM part numbers, voltage, or industrial specifications.`;
let FashionImageAnalysisService = FashionImageAnalysisService_1 = class FashionImageAnalysisService {
    config;
    userOrgs;
    storage;
    imageProcessor;
    openai;
    aiRunLogs;
    modelRouter;
    taxonomy;
    logger = new common_1.Logger(FashionImageAnalysisService_1.name);
    constructor(config, userOrgs, storage, imageProcessor, openai, aiRunLogs, modelRouter, taxonomy) {
        this.config = config;
        this.userOrgs = userOrgs;
        this.storage = storage;
        this.imageProcessor = imageProcessor;
        this.openai = openai;
        this.aiRunLogs = aiRunLogs;
        this.modelRouter = modelRouter;
        this.taxonomy = taxonomy;
    }
    async uploadPhotos(user, files, organizationId, sku) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        if (!files?.length)
            throw new common_1.BadRequestException('Choose at least one JPEG, PNG, or WebP photo of the garment.');
        if (files.length > MAX_PHOTOS)
            throw new common_1.BadRequestException(`Upload at most ${MAX_PHOTOS} photos for one Fashion item.`);
        const uploaded = [];
        const errors = [];
        for (const file of files) {
            const filename = file.originalname || 'photo';
            try {
                if (!ACCEPTED_TYPES.has((file.mimetype || '').toLowerCase()))
                    throw new Error('Unsupported file type. Use JPEG, PNG, or WebP photos.');
                if (!file.buffer || file.size > MAX_FILE_BYTES)
                    throw new Error('Each photo must be present and no larger than 20 MB.');
                const canonical = await this.imageProcessor.convertBufferToWebp(file.buffer);
                const stem = (0, fashion_storage_keys_util_js_1.fashionSkuStem)(sku);
                const keyPrefix = 'fashion/intake/' + org.organizationId + '/';
                const keySuffix = Date.now() + '-' + (0, node_crypto_1.randomUUID)().split('-')[0] + '.webp';
                const s3Key = this.storage.buildDurableKey(stem
                    ? keyPrefix + stem + '-' + keySuffix
                    : keyPrefix + (0, node_crypto_1.randomUUID)() + '.webp');
                await this.storage.putObject(s3Key, canonical.buffer, 'image/webp');
                void this.storage.queueVariantGeneration(s3Key);
                uploaded.push({
                    url: this.storage.getCdnUrl(s3Key),
                    s3Key,
                    filename,
                });
            }
            catch (error) {
                errors.push(`${filename}: ${error instanceof Error ? error.message : 'upload failed'}`);
            }
        }
        if (!uploaded.length)
            throw new common_1.BadRequestException(errors.join(' ') || 'No Fashion photos could be stored.');
        return { uploaded, errors };
    }
    async analyze(user, dto, organizationId) {
        await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        return this.analyzeImages(dto);
    }
    async analyzeImages(dto) {
        const imageUrls = uniqueUrls(dto.imageUrls);
        if (!imageUrls.length)
            throw new common_1.BadRequestException('Add at least one photo of the same garment before analysis.');
        if (imageUrls.length > MAX_PHOTOS)
            throw new common_1.BadRequestException(`A Fashion item can include at most ${MAX_PHOTOS} photos.`);
        const currentAttributes = asAttributes(dto.currentAttributes);
        const confirmedKeys = dto.confirmedKeys ?? [];
        const visionUrls = await this.visionUrls(imageUrls);
        const route = this.modelRouter.selectVisionRoute({
            sku: dto.sku || 'fashion-draft',
            partName: 'fashion garment',
            partType: 'fashion_garment',
            marketplace: dto.marketplaceId || 'US',
        }, 'default');
        try {
            const candidate = await this.identify(dto, imageUrls.length, visionUrls, route);
            const suggested = suggestedAttributes(candidate);
            const family = (0, fashion_config_js_1.normalizeFashionCategoryFamily)(suggested.categoryFamily || currentAttributes.categoryFamily);
            suggested.categoryFamily = family;
            const merged = (0, fashion_config_js_1.mergeFashionSuggestions)({
                current: currentAttributes,
                suggested,
                confirmedKeys,
            });
            const warnings = [
                ...stringArray(candidate.warnings),
                ...stringArray(candidate.conflicts),
            ];
            const multipleItems = Boolean(candidate.multipleDifferentItems);
            if (multipleItems)
                warnings.push('These photos may show more than one Fashion item. Review the photo set. The system will not split them into multiple records.');
            if (!stringValue(candidate.brand))
                warnings.push('Brand was not confirmed from a readable label.');
            if (!stringValue(candidate.size) && !stringValue(candidate.shoeSize))
                warnings.push('A printed size was not confirmed from the labels.');
            const category = await this.suggestCategory(stringValue(candidate.categorySearchQuery) ||
                [
                    stringValue(candidate.department),
                    stringValue(candidate.itemType),
                    stringValue(candidate.productType),
                ]
                    .filter(Boolean)
                    .join(' '), dto.marketplaceId);
            const aiTitle = stringValue(candidate.title);
            const listing = (0, fashion_config_js_1.buildFashionListingContent)({
                brand: dto.currentBrand || stringValue(candidate.brand),
                title: dto.titleConfirmed
                    ? dto.currentTitle
                    : aiTitle && (0, ebay_listing_text_util_js_1.truncateEbayTitle)(aiTitle),
                attributes: merged.attributes,
            });
            const attributes = (0, fashion_config_js_1.applyFashionAnalysisMeta)(merged.attributes, {
                suggestedKeys: merged.suggestedKeys,
                confirmedKeys,
                conflicts: merged.conflicts,
                warnings,
                multipleItems,
                analysisStatus: 'suggested',
            });
            const validated = (0, fashion_config_js_1.validateFashionAttributes)(attributes);
            return {
                status: 'suggested',
                attributes: validated.attributes,
                suggestedKeys: merged.suggestedKeys,
                conflicts: merged.conflicts,
                warnings: [...new Set([...warnings, ...validated.warnings])],
                validationErrors: validated.errors,
                multipleItems,
                reviewPhotoSet: multipleItems,
                category,
                brand: dto.currentBrand?.trim() || stringValue(candidate.brand),
                conditionLabel: stringValue(candidate.conditionLabel),
                title: dto.titleConfirmed
                    ? dto.currentTitle?.trim() || listing.title
                    : listing.title,
                description: dto.descriptionConfirmed
                    ? dto.currentDescription || listing.description
                    : listing.description,
                suggestedSku: dto.sku?.trim() || (0, fashion_config_js_1.suggestFashionSku)(stringValue(candidate.itemType)),
                visibleText: stringArray(candidate.visibleText),
            };
        }
        catch (error) {
            this.logger.warn(`Fashion image analysis failed: ${error instanceof Error ? error.message : String(error)}`);
            const listing = (0, fashion_config_js_1.buildFashionListingContent)({
                brand: dto.currentBrand,
                title: dto.currentTitle,
                attributes: currentAttributes,
            });
            const attributes = (0, fashion_config_js_1.applyFashionAnalysisMeta)(currentAttributes, {
                suggestedKeys: [],
                confirmedKeys,
                conflicts: [],
                warnings: [
                    error instanceof Error
                        ? error.message
                        : 'Image analysis is unavailable. Photos are kept. Continue manually.',
                ],
                multipleItems: false,
                analysisStatus: 'failed',
            });
            return {
                status: 'failed',
                attributes,
                suggestedKeys: [],
                conflicts: [],
                warnings: [
                    'Identification did not complete. Photos and entered values are preserved. You can retry analysis or continue manually.',
                ],
                validationErrors: [],
                multipleItems: false,
                reviewPhotoSet: false,
                category: { categoryId: null, categoryName: null, query: null },
                brand: dto.currentBrand?.trim() || null,
                conditionLabel: null,
                title: dto.currentTitle?.trim() || listing.title,
                description: dto.currentDescription || listing.description,
                suggestedSku: dto.sku?.trim() || (0, fashion_config_js_1.suggestFashionSku)(),
                visibleText: [],
            };
        }
    }
    generateListing(dto) {
        const validated = (0, fashion_config_js_1.validateFashionAttributes)(dto.verticalAttributes ?? {});
        const content = (0, fashion_config_js_1.buildFashionListingContent)({
            brand: dto.brand,
            title: dto.titleConfirmed ? dto.title : undefined,
            attributes: validated.attributes,
            conditionLabel: dto.conditionLabel,
        });
        return {
            title: dto.titleConfirmed ? dto.title?.trim() || content.title : content.title,
            description: dto.descriptionConfirmed
                ? dto.description || content.description
                : content.description,
            attributes: validated.attributes,
            errors: validated.errors,
            warnings: validated.warnings,
        };
    }
    fashionModels() {
        const primary = this.config.get('FASHION_AI_MODEL')?.trim() ||
            DEFAULT_FASHION_AI_MODEL;
        const configuredFallback = this.config
            .get('FASHION_AI_FALLBACK_MODEL')
            ?.trim();
        const fallback = configuredFallback === undefined || configuredFallback === ''
            ? DEFAULT_FASHION_AI_FALLBACK_MODEL
            : configuredFallback.toLowerCase() === 'none'
                ? null
                : configuredFallback;
        return [...new Set([primary, fallback].filter((m) => !!m))];
    }
    async identify(dto, imageCount, visionUrls, route) {
        const failures = [];
        for (const model of this.fashionModels()) {
            try {
                this.modelRouter.assertAllowed(model);
                const response = await this.openai.chat({
                    model,
                    costLane: route.lane,
                    imageUrls: visionUrls,
                    systemPrompt: VISION_SYSTEM_PROMPT,
                    userPrompt: JSON.stringify({
                        imageCount,
                        instruction: 'These photos belong to one Fashion item unless they clearly show unrelated garments. Read labels when they are visible. Do not invent missing details.',
                    }),
                    jsonMode: true,
                    temperature: 0.1,
                    maxTokens: 2500,
                });
                await this.logRun(dto, route, response);
                if (response.finishReason === 'length')
                    throw new Error('the reply was cut off before the JSON finished');
                const candidate = asRecord(response.content);
                if (!Object.keys(candidate).length)
                    throw new Error('the reply did not contain a JSON analysis');
                return candidate;
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                failures.push(`${model}: ${message}`);
                this.logger.warn(`Fashion image analysis with ${model} failed: ${message}`);
            }
        }
        throw new Error(`Image analysis is unavailable (${failures.join('; ')}). Photos are kept. Continue manually.`);
    }
    async logRun(dto, route, response) {
        try {
            await this.aiRunLogs.logRun({
                sku: dto.sku,
                partType: 'fashion_garment',
                marketplace: dto.marketplaceId || 'US',
                lane: route.lane,
                model: response.model,
                promptVersion: PROMPT_VERSION,
                routingPolicyVersion: route.policyVersion,
                inputTokens: response.usage.promptTokens,
                outputTokens: response.usage.completionTokens,
                costUsd: response.estimatedCostUsd,
                latencyMs: response.latencyMs,
            });
        }
        catch (error) {
            this.logger.warn(`Unable to write Fashion image AI audit log: ${error instanceof Error ? error.message : error}`);
        }
    }
    async visionUrls(imageUrls) {
        const selected = imageUrls.slice(0, MAX_VISION_IMAGES);
        return Promise.all(selected.map(async (url) => {
            const key = this.storage.keyFromUrl(url) || keyFromServeUrl(url);
            if (!key)
                return url;
            try {
                return await this.storage.generateDownloadUrl(key);
            }
            catch {
                return url;
            }
        }));
    }
    async suggestCategory(query, marketplaceId) {
        const q = query?.trim() || '';
        if (!q)
            return { categoryId: null, categoryName: null, query: null };
        try {
            const treeId = marketplaceId
                ? await this.taxonomy.getDefaultCategoryTreeId(marketplaceId)
                : undefined;
            const suggestions = await this.taxonomy.getCategorySuggestions(q, treeId);
            const first = suggestions[0]?.category;
            return {
                categoryId: first?.categoryId ?? null,
                categoryName: first?.categoryName ?? null,
                query: q,
            };
        }
        catch (error) {
            this.logger.warn(`Fashion category suggestion failed: ${error instanceof Error ? error.message : String(error)}`);
            return { categoryId: null, categoryName: null, query: q };
        }
    }
};
exports.FashionImageAnalysisService = FashionImageAnalysisService;
exports.FashionImageAnalysisService = FashionImageAnalysisService = FashionImageAnalysisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        user_organization_service_js_1.UserOrganizationService,
        storage_service_js_1.StorageService,
        image_processor_service_js_1.ImageProcessorService,
        openai_service_js_1.OpenAiService,
        ai_run_log_service_js_1.AiRunLogService,
        model_router_js_1.ModelRouter,
        ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService])
], FashionImageAnalysisService);
function uniqueUrls(values) {
    return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}
function asRecord(value) {
    if (typeof value === 'string') {
        try {
            return asRecord((0, json_sanitizer_js_1.sanitizeJson)(value));
        }
        catch {
            return {};
        }
    }
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}
function asAttributes(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}
function stringValue(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function stringArray(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === 'string' && Boolean(item.trim()))
        : [];
}
function suggestedAttributes(candidate) {
    const nested = asAttributes(candidate.verticalAttributes);
    const keys = [
        'itemType',
        'productType',
        'categoryFamily',
        'brand',
        'department',
        'size',
        'sizeSystem',
        'sizeType',
        'color',
        'secondaryColor',
        'pattern',
        'style',
        'material',
        'composition',
        'fabricType',
        'sleeveLength',
        'neckline',
        'closure',
        'length',
        'fit',
        'chestMeasurement',
        'waistMeasurement',
        'hipMeasurement',
        'lengthMeasurement',
        'inseamMeasurement',
        'measurementsUnit',
        'measurements',
        'wear',
        'stains',
        'holes',
        'pilling',
        'fading',
        'repairs',
        'missingComponents',
        'otherDefects',
        'conditionDetails',
        'shoeSize',
        'shoeSizeSystem',
        'width',
        'footwearType',
        'accessoryType',
        'accessoryDimensions',
        'accessoryMaterial',
        'countryOfManufacture',
        'season',
        'occasion',
        'theme',
        'vintage',
        'garmentCare',
    ];
    const attributes = { ...nested };
    for (const key of keys) {
        const value = stringValue(candidate[key]);
        if (value)
            attributes[key] = value;
    }
    const features = stringArray(candidate.features);
    if (features.length)
        attributes.features = features.join(', ');
    else if (stringValue(candidate.features))
        attributes.features = stringValue(candidate.features);
    const department = (0, fashion_config_js_1.normalizeFashionDepartment)(attributes.department);
    if (department)
        attributes.department = department;
    return attributes;
}
function keyFromServeUrl(url) {
    try {
        const parsed = new URL(url, 'http://localhost');
        const marker = '/api/storage/serve/';
        const index = parsed.pathname.indexOf(marker);
        if (index < 0)
            return null;
        return decodeURIComponent(parsed.pathname.slice(index + marker.length));
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=fashion-image-analysis.service.js.map