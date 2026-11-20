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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var SingleListingFormService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingleListingFormService = exports.PART_LOOKUP_MIN_VISION_IMAGES = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const typeorm_3 = require("typeorm");
const fs = __importStar(require("node:fs"));
const sharp_1 = __importDefault(require("sharp"));
const openai_service_js_1 = require("../../common/openai/openai.service.js");
const json_sanitizer_js_1 = require("../../common/openai/json-sanitizer.js");
const vision_enrichment_pipeline_js_1 = require("../../common/openai/pipelines/vision-enrichment.pipeline.js");
const openai_types_js_1 = require("../../common/openai/openai.types.js");
const ebay_mvl_service_js_1 = require("../../fitment/ebay-mvl.service.js");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
const image_asset_entity_js_1 = require("../../storage/entities/image-asset.entity.js");
const storage_service_js_1 = require("../../storage/storage.service.js");
const image_drive_service_js_1 = require("../../storage/image-drive.service.js");
const image_optimizer_service_js_1 = require("../image-enrichment/image-optimizer.service.js");
const ecu_identification_prompt_js_1 = require("../../common/openai/prompts/ecu-identification.prompt.js");
const automotive_oem_brands_js_1 = require("../constants/automotive-oem-brands.js");
const ebay_browse_api_service_js_1 = require("../../channels/ebay/ebay-browse-api.service.js");
const derive_part_name_from_title_js_1 = require("../../listings/utils/derive-part-name-from-title.js");
exports.PART_LOOKUP_MIN_VISION_IMAGES = 2;
const MEASURED_OEM_LOOKUP_USD = {
    'openai/gpt-4o-mini': 0.000091,
    'google/gemini-2.5-flash': 0.000414,
    'openai/gpt-4.1-mini': 0.000265,
};
const PART_LOOKUP_SYSTEM_PROMPT = `You are an automotive parts identification specialist.
Given a part number or OEM number, infer the most likely part details for an eBay Motors listing.
Return ONLY valid JSON with these keys (use empty string when unknown):
{
  "partName": "human-readable part name with position if known",
  "brand": "vehicle or parts brand (OEM manufacturer, not aftermarket unless clearly an aftermarket number)",
  "model": "primary vehicle model line if identifiable from the part number pattern",
  "category": "eBay-oriented category hint e.g. Brakes, Engine Cooling, Lighting",
  "note": "2-4 sentences: condition assumptions (used OEM), fitment hints, interchange notes, seller-facing details for listing enrichment",
  "confidence": "high|medium|low"
}
Rules:
- Never fabricate exact cross-reference numbers.
- Mercedes A-numbers, BMW numbers, Toyota/Lexus formats should inform brand/model.
- When a target vehicle make is supplied, do not infer a part from listings that identify a different make.
- Chassis codes must match year ranges (Lexus RX AL20 = 2015–2022; AL10 = 2009–2015). Never mix generation codes with incompatible years.
- Interior/trim parts: mention placement, color/finish, and verify-part-number guidance in the note.
- If uncertain, use lower confidence and leave fields empty rather than guessing wildly.
- The note field must be ready to paste into a listing form as additional seller details.
- TITLE RULE: partName is for used OEM parts — do NOT include "New" in partName. Use neutral wording (no condition word) or "Used"/"OEM Used".`;
const SINGLE_LISTING_VISION_PROMPT = `Analyze ALL provided photos of this automotive part for a single eBay Motors listing.
Use the seller hints together with what you see in the images — do not rely on text hints alone when photos contradict them.

Seller hints:
- Part number / OEM: {partNumberHint}
- {brandHint}
- Target vehicle make (when known): {vehicleMakeHint}

You MUST verify image coverage across the set:
- hasLabelShot: at least ONE image clearly shows a part number stamp, OEM label, barcode, or manufacturer tag
- hasOverallShot: at least ONE other image shows the whole part assembly in context (not only a tight label crop)

Return ONLY valid JSON:
{
  "partName": "SEO-friendly eBay title part name (specific, with placement/position if known, max ~80 chars worth of clarity)",
  "brand": "manufacturer/brand (prefer hint when visible on label)",
  "model": "vehicle model line if visible on label or strongly inferable",
  "category": "eBay Motors category e.g. Brakes, Engine Cooling, Lighting",
  "partNumber": "best visible MPN/OEM from images (empty string if not readable)",
  "note": "2-4 sentences of SEO-friendly seller notes: condition, fitment hints, interchange/cross-ref context, keywords buyers search for. Plain text, no HTML.",
  "confidence": "high|medium|low",
  "imageCoverage": {
    "hasLabelShot": true,
    "hasOverallShot": true
  },
  "visibleText": ["all readable text from labels/stamps"]
}

Rules:
- Combine OEM hint, brand hint, and visible label/overall photos for identification
- Do NOT invent part numbers — only report clearly visible numbers
- Set confidence to low if identification is uncertain
- imageCoverage must reflect what is actually in the photos
- The note must be accurate, seller-facing, and ready to paste into a listing description
- TITLE RULE: partName is for used OEM parts — do NOT include "New" in partName. Use neutral wording (no condition word) or "Used"/"OEM Used".`;
const NON_VEHICLE_PART_LOOKUP_BRANDS = new Set([
    'acdelco',
    'bosch',
    'continental',
    'delphi',
    'denso',
    'genuineoem',
    'mopar',
    'motorcraft',
    'valeo',
]);
const PART_LOOKUP_VEHICLE_MAKES = [
    ...automotive_oem_brands_js_1.AUTOMOTIVE_OEM_BRANDS.filter((make) => !NON_VEHICLE_PART_LOOKUP_BRANDS.has(make.toLowerCase().replace(/[^a-z0-9]/g, ''))),
    'Plymouth',
    'Pontiac',
    'Oldsmobile',
    'Mercury',
    'Saturn',
    'Scion',
    'Saab',
];
function normalizeVehicleMake(value) {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (normalized === 'vw')
        return 'volkswagen';
    if (normalized === 'chevy')
        return 'chevrolet';
    if (normalized === 'mercedes')
        return 'mercedes benz';
    return normalized;
}
function extractVehicleMakeEvidence(value) {
    const normalized = ` ${normalizeVehicleMake(value)} `;
    return PART_LOOKUP_VEHICLE_MAKES.map(normalizeVehicleMake).filter((make) => normalized.includes(` ${make} `));
}
let SingleListingFormService = SingleListingFormService_1 = class SingleListingFormService {
    listingRepo;
    catalogProductRepo;
    imageAssetRepo;
    openAi;
    config;
    mvl;
    visionPipeline;
    storageService;
    imageDriveService;
    imageOptimizer;
    browseApi;
    listingOptimizationQueue;
    logger = new common_1.Logger(SingleListingFormService_1.name);
    constructor(listingRepo, catalogProductRepo, imageAssetRepo, openAi, config, mvl, visionPipeline, storageService, imageDriveService, imageOptimizer, browseApi, listingOptimizationQueue) {
        this.listingRepo = listingRepo;
        this.catalogProductRepo = catalogProductRepo;
        this.imageAssetRepo = imageAssetRepo;
        this.openAi = openAi;
        this.config = config;
        this.mvl = mvl;
        this.visionPipeline = visionPipeline;
        this.storageService = storageService;
        this.imageDriveService = imageDriveService;
        this.imageOptimizer = imageOptimizer;
        this.browseApi = browseApi;
        this.listingOptimizationQueue = listingOptimizationQueue;
    }
    getLookupPricing() {
        const oemModel = this.config.get('OPENAI_MODEL_TEXT') ||
            this.config.get('OPENAI_CHAT_MODEL', 'openai/gpt-4o-mini');
        const visionModel = this.config.get('OPENAI_VISION_MODEL') ||
            'google/gemini-2.5-flash';
        const assumptions = {
            oemPromptTokens: 650,
            oemCompletionTokens: 350,
            visionPromptTokens: 2800,
            visionCompletionTokens: 650,
            visionFallbackRate: 0.1,
        };
        const oemTextOnly = MEASURED_OEM_LOOKUP_USD[oemModel] ??
            (0, openai_types_js_1.estimateCost)(oemModel, assumptions.oemPromptTokens, assumptions.oemCompletionTokens);
        const visionFallback = (0, openai_types_js_1.estimateCost)(visionModel, assumptions.visionPromptTokens, assumptions.visionCompletionTokens);
        const oemPlusVision = oemTextOnly + visionFallback;
        const allOemSuccess = oemTextOnly * 15_000;
        const fallbackCount = Math.round(15_000 * assumptions.visionFallbackRate);
        const typicalWithVisionFallback = oemTextOnly * 15_000 + visionFallback * fallbackCount;
        const worstCase = oemPlusVision * 15_000;
        const roundUsd = (n) => Math.round(n * 100) / 100;
        const roundMicro = (n) => Math.round(n * 1_000_000) / 1_000_000;
        return {
            oemModel,
            visionModel,
            recommendedStack: 'OEM text: openai/gpt-4o-mini (OPENAI_MODEL_TEXT) · Vision fallback: google/gemini-2.5-flash (OPENAI_VISION_MODEL)',
            assumptions,
            perLookupUsd: {
                oemTextOnly: roundMicro(oemTextOnly),
                visionFallback: roundMicro(visionFallback),
                oemPlusVision: roundMicro(oemPlusVision),
            },
            bulk15000PartsUsd: {
                allOemSuccess: roundUsd(allOemSuccess),
                typicalWithVisionFallback: roundUsd(typicalWithVisionFallback),
                worstCase: roundUsd(worstCase),
            },
        };
    }
    async createIntakePart(dto) {
        const partNumber = this.sanitizePartNumber(dto.partNumber);
        const brand = dto.brand?.trim();
        if (!partNumber) {
            throw new common_1.BadRequestException('partNumber is required');
        }
        if (!brand) {
            throw new common_1.BadRequestException('brand is required');
        }
        const rawImageUrls = (dto.imageUrls ?? [])
            .map((u) => u.trim())
            .filter(Boolean);
        const generatedSku = !dto.sku?.trim();
        let sku = dto.sku?.trim() || (await this.allocateSku());
        const imageUrls = rawImageUrls.length > 0
            ? await this.storageService.mirrorRemoteImageUrls(rawImageUrls, `warehouse-intake/${sku}`)
            : rawImageUrls;
        const qty = dto.quantity ?? 1;
        const priceNum = dto.price;
        const priceStr = priceNum.toFixed(2);
        const placeholderTitle = this.stripTitleSpecialChars(`${brand} ${partNumber}`).slice(0, 80);
        const title = dto.title?.trim() || placeholderTitle;
        let listing = null;
        let sourceRowNumber = 0;
        for (let attempt = 1; attempt <= 3; attempt++) {
            sourceRowNumber = await this.allocateIntakeSourceRow();
            try {
                listing = await this.listingRepo.save(this.listingRepo.create({
                    customLabelSku: sku,
                    cBrand: brand,
                    cType: dto.partType,
                    cOeOemPartNumber: partNumber,
                    cManufacturerPartNumber: partNumber,
                    itemPhotoUrl: imageUrls.length > 0 ? imageUrls.join('|') : null,
                    title,
                    description: dto.description?.trim() || null,
                    categoryName: dto.categoryName?.trim() || null,
                    conditionId: dto.conditionId,
                    extractedMake: dto.vehicleMake?.trim() || null,
                    startPrice: priceStr,
                    startPriceNum: priceNum,
                    quantity: String(qty),
                    quantityNum: qty,
                    status: 'draft',
                    sourceFileName: 'warehouse-intake',
                    sourceFilePath: 'warehouse-intake',
                    origin: listing_record_entity_js_1.ListingOrigin.ADD_PART,
                    sheetName: 'intake',
                    sourceRowNumber,
                    marketplace: 'US',
                    teamId: dto.teamId || null,
                    location: dto.location?.trim() || null,
                    weight: dto.weight ?? null,
                }));
                break;
            }
            catch (err) {
                if (!this.isUniqueViolation(err) || attempt === 3) {
                    if (this.isUniqueViolation(err)) {
                        throw new common_1.ConflictException('This part could not be saved because its generated inventory identifiers collided. Please try again.');
                    }
                    throw err;
                }
                if (generatedSku && this.isSkuUniqueViolation(err)) {
                    sku = await this.allocateSku();
                }
            }
        }
        if (!listing) {
            throw new common_1.ConflictException('This part could not be saved because its generated inventory identifiers collided. Please try again.');
        }
        let catalogProduct = null;
        try {
            catalogProduct = await this.catalogProductRepo.save(this.catalogProductRepo.create({
                sku,
                title,
                description: dto.description?.trim() || null,
                brand,
                brandNormalized: brand.toLowerCase().trim(),
                mpn: partNumber,
                mpnNormalized: partNumber.toLowerCase().replace(/[\s\-]/g, ''),
                oemPartNumber: partNumber,
                partType: dto.partType,
                categoryId: null,
                categoryName: dto.categoryName?.trim() || null,
                conditionId: dto.conditionId,
                price: priceNum,
                quantity: qty,
                imageUrls,
                sourceFile: 'warehouse-intake',
                sourceRow: sourceRowNumber,
                teamId: dto.teamId || null,
                location: dto.location?.trim() || null,
            }));
        }
        catch (err) {
            this.logger.warn(`Failed to create catalog product for SKU ${sku}: ${err}`);
        }
        if (dto.uploadedAssetIds?.length) {
            const assets = await this.imageAssetRepo.find({
                where: { id: (0, typeorm_2.In)(dto.uploadedAssetIds) },
            });
            for (const asset of assets) {
                if (this.storageService.isTempKey(asset.s3Key)) {
                    try {
                        const newKey = await this.storageService.confirmUpload(asset.s3Key, listing.id, asset.id);
                        asset.s3Key = newKey;
                        asset.cdnUrl = this.storageService.getCdnUrl(newKey);
                    }
                    catch (err) {
                        this.logger.warn(`Failed to move temp asset ${asset.id} to originals/: ${err}`);
                    }
                }
                asset.listingId = listing.id;
            }
            await this.imageAssetRepo.save(assets);
        }
        if (!listing.itemPhotoUrl?.trim()) {
            try {
                const driveImages = await this.imageDriveService.findByPartNumber(partNumber);
                if (driveImages.length > 0) {
                    const urls = driveImages.map((img) => img.cdnUrl).slice(0, 24);
                    listing.itemPhotoUrl = urls.join('|');
                    await this.listingRepo.save(listing);
                    this.logger.log(`Auto-attached ${urls.length} image(s) from Image Drive for part ${partNumber}`);
                    if (catalogProduct) {
                        catalogProduct.imageUrls = urls;
                        await this.catalogProductRepo.save(catalogProduct);
                    }
                }
            }
            catch (err) {
                this.logger.warn(`Image Drive lookup failed for ${partNumber}: ${err instanceof Error ? err.message : err}`);
            }
        }
        const enqueueOptimization = async () => {
            const productId = catalogProduct?.id;
            if (!productId)
                return;
            try {
                await this.listingOptimizationQueue.add('optimize-product', { productId, marketplace: 'US' }, {
                    jobId: `intake-optimization-${sku}`,
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 30_000 },
                });
            }
            catch (err) {
                this.logger.warn(`Failed to enqueue listing optimization for SKU ${sku}: ${err}`);
            }
        };
        const savedImageCount = (listing.itemPhotoUrl ?? '')
            .split('|')
            .map((url) => url.trim())
            .filter(Boolean).length;
        if (listing.title === placeholderTitle &&
            savedImageCount >= exports.PART_LOOKUP_MIN_VISION_IMAGES) {
            void this.autoEnrichListing(listing, dto).then((identified) => identified ? enqueueOptimization() : undefined);
        }
        else if (listing.title !== placeholderTitle) {
            await enqueueOptimization();
        }
        return { listing };
    }
    async autoEnrichListing(listing, dto) {
        try {
            const partNumber = this.sanitizePartNumber(dto.partNumber);
            if (!partNumber)
                return false;
            const imageUrls = (listing.itemPhotoUrl ?? '')
                .split('|')
                .map((url) => url.trim())
                .filter(Boolean);
            if (imageUrls.length < exports.PART_LOOKUP_MIN_VISION_IMAGES)
                return false;
            const finalized = await this.lookupPart({
                partNumber,
                brand: dto.brand,
                vehicleMake: dto.vehicleMake,
                partType: dto.partType,
                imageUrls,
            });
            const placeholderTitle = this.stripTitleSpecialChars(`${dto.brand} ${partNumber}`).slice(0, 80);
            let titleChanged = false;
            if (listing.title === placeholderTitle && finalized.partName?.trim()) {
                listing.title = this.buildSeoTitle(finalized.brand ?? dto.brand, finalized.partName, partNumber);
                titleChanged = true;
            }
            if (!dto.brand?.trim() && finalized.brand?.trim()) {
                listing.cBrand = finalized.brand.trim();
            }
            if (!listing.extractedModel && finalized.model?.trim()) {
                listing.extractedModel = finalized.model.trim();
            }
            if (!listing.categoryName && finalized.category?.trim()) {
                listing.categoryName = finalized.category.trim();
            }
            const existingCType = (listing.cType ?? '').trim().toLowerCase();
            const fillerCTypes = new Set([
                'oem',
                'aftermarket',
                'salvage',
                'used',
                'new',
                'general',
                'unknown',
                'other',
            ]);
            if (finalized.partName?.trim() &&
                (finalized.source === 'vision' ||
                    !listing.cType?.trim() ||
                    fillerCTypes.has(existingCType))) {
                listing.cType = this.stripTitleSpecialChars(finalized.partName).slice(0, 80);
            }
            if (finalized.note?.trim()) {
                const userNotes = dto.description?.trim();
                listing.description =
                    [userNotes, finalized.note.trim()].filter(Boolean).join('\n\n') ||
                        null;
            }
            if (finalized.partNumber?.trim()) {
                const cleanedPn = this.sanitizePartNumber(finalized.partNumber);
                listing.cOeOemPartNumber = cleanedPn;
                listing.cManufacturerPartNumber = cleanedPn;
            }
            await this.listingRepo.save(listing);
            if (listing.customLabelSku) {
                try {
                    const product = await this.catalogProductRepo.findOneBy({
                        sku: listing.customLabelSku,
                    });
                    if (product) {
                        if (titleChanged && listing.title)
                            product.title = listing.title;
                        if (listing.cBrand)
                            product.brand = listing.cBrand;
                        if (listing.cType)
                            product.partType = listing.cType;
                        if (listing.categoryName)
                            product.categoryName = listing.categoryName;
                        if (listing.description)
                            product.description = listing.description;
                        await this.catalogProductRepo.save(product);
                    }
                }
                catch (err) {
                    this.logger.warn(`Auto-enrich: failed to update catalog product ${listing.customLabelSku}: ${err}`);
                }
            }
            this.logger.log(`Auto-enriched ${listing.customLabelSku}: "${listing.title}" (${finalized.confidence})`);
            return true;
        }
        catch (err) {
            this.logger.warn(`Auto-enrichment failed for ${listing.customLabelSku ?? dto.partNumber}: ${err}`);
            return false;
        }
    }
    buildSeoTitle(make, partName, oemNumber) {
        const cleanedOem = this.sanitizePartNumber(oemNumber);
        const parts = [
            make?.trim(),
            partName?.trim(),
            cleanedOem,
            'OEM Used',
        ].filter(Boolean);
        let title = parts.join(' ');
        if (title.length > 80) {
            const withoutSuffix = [make?.trim(), partName?.trim(), cleanedOem]
                .filter(Boolean)
                .join(' ');
            title =
                withoutSuffix.length <= 80
                    ? withoutSuffix
                    : withoutSuffix.slice(0, 77) + '...';
        }
        return this.stripTitleSpecialChars(title || `${make ?? ''} ${cleanedOem}`.trim()).slice(0, 80);
    }
    async lookupAndApplyToListing(listingId) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing || listing.deletedAt) {
            throw new common_1.NotFoundException(`Listing ${listingId} not found`);
        }
        const partNumber = this.sanitizePartNumber(listing.cOeOemPartNumber || listing.cManufacturerPartNumber);
        if (!partNumber) {
            throw new common_1.BadRequestException('Listing has no OEM/part number');
        }
        const imageUrls = (listing.itemPhotoUrl ?? '')
            .split('|')
            .map((u) => u.trim())
            .filter(Boolean);
        if (listing.origin === listing_record_entity_js_1.ListingOrigin.ADD_PART &&
            imageUrls.length < exports.PART_LOOKUP_MIN_VISION_IMAGES) {
            throw new common_1.BadRequestException('Upload at least two clear part photos before identifying an Add Part listing.');
        }
        const lookup = await this.lookupPart({
            partNumber,
            brand: listing.cBrand?.trim() || undefined,
            vehicleMake: listing.extractedMake?.trim() || undefined,
            imageUrls,
        });
        if (lookup.partName?.trim()) {
            listing.title = this.stripTitleSpecialChars(lookup.partName).slice(0, 80);
            const existingType = (listing.cType ?? '').trim().toLowerCase();
            const fillerTypes = new Set([
                'oem',
                'aftermarket',
                'salvage',
                'used',
                'new',
                'general',
                'unknown',
                'other',
            ]);
            if (lookup.source === 'vision' ||
                !listing.cType?.trim() ||
                fillerTypes.has(existingType)) {
                listing.cType = this.stripTitleSpecialChars(lookup.partName).slice(0, 80);
            }
        }
        if (lookup.brand?.trim()) {
            listing.cBrand = lookup.brand.trim();
        }
        if (lookup.make?.trim()) {
            listing.extractedMake = lookup.make.trim();
        }
        else if (lookup.brand?.trim() && !listing.extractedMake?.trim()) {
            listing.extractedMake = lookup.brand.trim();
        }
        if (lookup.model?.trim()) {
            listing.extractedModel = lookup.model.trim();
        }
        if (lookup.category?.trim()) {
            listing.categoryName = lookup.category.trim();
        }
        if (lookup.note?.trim()) {
            listing.description = lookup.note.trim();
        }
        if (lookup.partNumber?.trim()) {
            const cleanedPn = this.sanitizePartNumber(lookup.partNumber);
            listing.cOeOemPartNumber = cleanedPn;
            listing.cManufacturerPartNumber = cleanedPn;
        }
        const saved = await this.listingRepo.save(listing);
        await this.syncLookupFieldsToCatalogProduct(saved);
        if (saved.customLabelSku &&
            lookup.year &&
            (lookup.make || lookup.brand) &&
            lookup.model) {
            await this.seedCatalogFitmentFromBrowse(saved.customLabelSku, {
                year: lookup.year,
                make: (lookup.make || lookup.brand),
                model: lookup.model,
            });
        }
        return { listing: saved, lookup };
    }
    async syncLookupFieldsToCatalogProduct(listing) {
        const sku = listing.customLabelSku?.trim();
        if (!sku)
            return;
        try {
            const product = await this.catalogProductRepo.findOne({
                where: { sku },
            });
            if (!product)
                return;
            if (listing.title?.trim()) {
                product.title = listing.title.trim();
                product.titleNormalized = listing.title
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            }
            if (listing.description?.trim())
                product.description = listing.description.trim();
            if (listing.cBrand?.trim()) {
                product.brand = listing.cBrand.trim();
                product.brandNormalized = listing.cBrand.toLowerCase().trim();
            }
            if (listing.categoryName?.trim())
                product.categoryName = listing.categoryName.trim();
            if (listing.cManufacturerPartNumber?.trim()) {
                const partNumber = this.sanitizePartNumber(listing.cManufacturerPartNumber);
                product.mpn = partNumber;
                product.mpnNormalized = partNumber
                    .toLowerCase()
                    .replace(/[\s\-]/g, '');
                product.oemPartNumber = partNumber;
            }
            await this.catalogProductRepo.save(product);
        }
        catch (err) {
            this.logger.warn(`Failed to sync photo-identified fields to CatalogProduct SKU ${sku}: ${err instanceof Error ? err.message : err}`);
        }
    }
    async seedCatalogFitmentFromBrowse(sku, vehicle) {
        try {
            const product = await this.catalogProductRepo.findOne({ where: { sku } });
            if (!product)
                return;
            const existing = Array.isArray(product.fitmentData)
                ? product.fitmentData
                : [];
            const hasYear = existing.some((r) => {
                const y = String(r.Year ?? r.year ?? '');
                return /^(19|20)\d{2}/.test(y);
            });
            if (hasYear)
                return;
            const seed = {
                Year: vehicle.year,
                Make: vehicle.make,
                Model: vehicle.model,
                Source: 'ebay_browse',
            };
            await this.catalogProductRepo.update(product.id, {
                fitmentData: [seed, ...existing],
            });
            this.logger.log(`Seeded Browse fitment for SKU ${sku}: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
        }
        catch (err) {
            this.logger.warn(`Failed to seed Browse fitment for SKU ${sku}: ${err instanceof Error ? err.message : err}`);
        }
    }
    async listBrands(query) {
        const catalogRows = await this.listingRepo
            .createQueryBuilder('r')
            .select('DISTINCT r."cBrand"', 'brand')
            .where(`r."cBrand" IS NOT NULL AND TRIM(r."cBrand") != ''`)
            .andWhere(`r."deletedAt" IS NULL`)
            .orderBy('r."cBrand"', 'ASC')
            .getRawMany();
        const catalogBrands = catalogRows
            .map((row) => row.brand?.trim())
            .filter((b) => Boolean(b));
        const merged = new Set([
            ...automotive_oem_brands_js_1.AUTOMOTIVE_OEM_BRANDS,
            ...catalogBrands,
        ]);
        let brands = [...merged].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        const q = query?.trim();
        if (q) {
            const lower = q.toLowerCase();
            brands = brands.filter((b) => b.toLowerCase().includes(lower));
        }
        return { brands };
    }
    async lookupPart(dto) {
        const partNumber = this.sanitizePartNumber(dto.partNumber);
        if (!partNumber) {
            throw new common_1.BadRequestException('partNumber is required');
        }
        const imageUrls = (dto.imageUrls ?? [])
            .map((u) => u.trim())
            .filter(Boolean);
        let visionAttempt;
        if (imageUrls.length >= exports.PART_LOOKUP_MIN_VISION_IMAGES) {
            try {
                visionAttempt = await this.runVisionLookup(partNumber, imageUrls, dto.brand, dto.partType, dto.vehicleMake);
            }
            catch (err) {
                this.logger.warn(`Photo part lookup failed for ${partNumber}: ${err instanceof Error ? err.message : err}`);
            }
        }
        if (visionAttempt &&
            this.isVisionLookupUsable(visionAttempt.result, partNumber)) {
            return {
                ...(await this.finalizeLookupFields(visionAttempt.result, partNumber, true)),
                source: 'vision',
                aiModel: visionAttempt.visionModel,
                visionModel: visionAttempt.visionModel,
                estimatedCostUsd: visionAttempt.costUsd,
                fallbackUsed: true,
            };
        }
        if (imageUrls.length >= exports.PART_LOOKUP_MIN_VISION_IMAGES) {
            throw new common_1.BadRequestException('The photos did not confirm this part number. Check the label and overall photos, then review the part manually before retrying.');
        }
        const browseAttempt = await this.runBrowseLookup(partNumber, dto.brand, dto.vehicleMake);
        if (browseAttempt && this.isOemLookupUsable(browseAttempt.result)) {
            return {
                ...(await this.finalizeLookupFields(browseAttempt.result, partNumber, true)),
                source: 'ebay_browse',
                aiModel: 'ebay-browse-api',
                estimatedCostUsd: 0,
                fallbackUsed: false,
            };
        }
        this.assertAiConfigured();
        const oemModel = this.config.get('OPENAI_MODEL_TEXT') ||
            this.config.get('OPENAI_CHAT_MODEL', 'openai/gpt-4o-mini');
        const oemAttempt = await this.runOemTextLookup(partNumber, dto, oemModel);
        if (!this.isOemLookupUsable(oemAttempt.result)) {
            throw new common_1.BadRequestException(`Could not identify part ${partNumber}: no matching eBay listings found and the AI text lookup was inconclusive. Add photos (label close-up + overall shot) or verify the part number, then try again.`);
        }
        const finalized = await this.finalizeLookupFields(oemAttempt.result, partNumber);
        return {
            ...finalized,
            source: 'oem_text',
            aiModel: oemModel,
            estimatedCostUsd: oemAttempt.costUsd,
            fallbackUsed: true,
        };
    }
    assertAiConfigured() {
        const apiKey = this.config.get('OPENAI_API_KEY', '');
        if (!apiKey) {
            throw new common_1.ServiceUnavailableException('AI lookup is unavailable — OPENAI_API_KEY is not configured.');
        }
    }
    isOemLookupUsable(result) {
        if (result.confidence === 'low')
            return false;
        const partName = result.partName?.trim();
        const brand = result.brand?.trim();
        const category = result.category?.trim();
        const note = result.note?.trim();
        if (!partName)
            return false;
        if (!brand && !category && !note)
            return false;
        if (result.confidence === 'medium' && !brand && !category)
            return false;
        return true;
    }
    isVisionLookupUsable(result, expectedPartNumber) {
        if (!result.partName?.trim() || result.confidence === 'low')
            return false;
        const returnedPartNumber = result.partNumber?.trim();
        if (!returnedPartNumber)
            return true;
        const normalizePartNumber = (value) => this.sanitizePartNumber(value)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
        return (normalizePartNumber(returnedPartNumber) ===
            normalizePartNumber(expectedPartNumber));
    }
    browseItemMatchesVehicleMake(item, vehicleMakeHint) {
        if (!vehicleMakeHint?.trim())
            return true;
        const expectedMake = normalizeVehicleMake(vehicleMakeHint);
        const itemText = normalizeVehicleMake(`${item.title} ${item.brand ?? ''}`);
        if (` ${itemText} `.includes(` ${expectedMake} `))
            return true;
        const evidence = new Set();
        for (const hint of item.fitmentHints ?? []) {
            if (hint.make && (hint.year || hint.model)) {
                evidence.add(normalizeVehicleMake(hint.make));
            }
        }
        for (const make of extractVehicleMakeEvidence(`${item.title} ${item.brand ?? ''}`)) {
            evidence.add(make);
        }
        return evidence.size === 0 || evidence.has(expectedMake);
    }
    async runBrowseLookup(partNumber, brandHint, vehicleMakeHint) {
        try {
            let lookup = await this.browseApi.searchByMpn(brandHint ?? '', partNumber, { limit: 10 });
            if ((!lookup.found || lookup.items.length === 0) && brandHint?.trim()) {
                lookup = await this.browseApi.searchByMpn('', partNumber, {
                    limit: 10,
                });
            }
            if (!lookup.found || lookup.items.length === 0)
                return null;
            const normalize = (v) => (v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const target = normalize(partNumber);
            const detailed = lookup.items.filter((i) => i.title && (Object.keys(i.aspects).length > 0 || i.brand));
            const exactMpn = detailed.filter((i) => normalize(i.mpn) === target ||
                Object.values(i.aspects).some((vals) => vals.some((v) => normalize(v) === target)));
            if (exactMpn.length === 0)
                return null;
            const pool = exactMpn.filter((item) => this.browseItemMatchesVehicleMake(item, vehicleMakeHint));
            if (pool.length === 0) {
                this.logger.warn(`Browse part lookup rejected ${partNumber}: eBay results conflict with vehicle make "${vehicleMakeHint}"`);
                return null;
            }
            const best = pool.find((i) => i.epid && i.categoryId) ??
                pool.find((i) => i.categoryId) ??
                pool[0];
            if (!best)
                return null;
            const partName = this.str(best.aspects['Type']?.[0]) ??
                this.derivePartNameFromTitle(best.title, partNumber, brandHint ?? best.brand ?? undefined);
            if (!partName)
                return null;
            const brand = this.str(best.brand) ??
                this.str(best.aspects['Brand']?.[0]) ??
                this.str(brandHint);
            const bestHint = (best.fitmentHints ?? []).find((h) => h.year && h.make && h.model) ??
                (best.fitmentHints ?? []).find((h) => h.make && h.model) ??
                (best.fitmentHints ?? [])[0];
            const model = this.str(bestHint?.model);
            const make = this.str(bestHint?.make) ?? this.str(brand);
            const yearRaw = this.str(bestHint?.year);
            const yearMatch = yearRaw?.match(/(19|20)\d{2}/);
            const year = yearMatch ? yearMatch[0] : undefined;
            const category = this.str(best.categoryName);
            const fitmentSummary = (best.fitmentHints ?? [])
                .slice(0, 4)
                .map((h) => [h.year, h.make, h.model].filter(Boolean).join(' '))
                .filter(Boolean)
                .join('; ');
            const noteParts = [
                `Identified from live eBay listings matching OEM/MPN ${partNumber}.`,
                best.epid ? `eBay catalog EPID ${best.epid}.` : '',
                fitmentSummary ? `Reported fitment: ${fitmentSummary}.` : '',
                'Used OEM part — verify the part number against your vehicle before purchase.',
            ].filter(Boolean);
            this.logger.log(`Browse part lookup identified ${partNumber}: "${partName}" ` +
                `(category="${category ?? ''}", year=${year ?? ''}, make=${make ?? ''}, ` +
                `model=${model ?? ''}, exactMpnMatch=${exactMpn.length > 0})`);
            return {
                result: {
                    partName,
                    brand,
                    make,
                    model,
                    year,
                    category,
                    note: noteParts.join(' '),
                    partNumber: best.mpn ? this.sanitizePartNumber(best.mpn) : partNumber,
                    confidence: exactMpn.length > 0 ? 'high' : 'medium',
                },
            };
        }
        catch (err) {
            this.logger.warn(`Browse part lookup failed for ${partNumber}: ${err instanceof Error ? err.message : err}`);
            return null;
        }
    }
    derivePartNameFromTitle(title, partNumber, brand) {
        return (0, derive_part_name_from_title_js_1.derivePartNameFromTitle)(title, partNumber, brand);
    }
    async runOemTextLookup(partNumber, dto, chatModel) {
        const contextLines = [`Part number / OEM: ${partNumber}`];
        if (dto.brand?.trim())
            contextLines.push(`Known brand hint: ${dto.brand.trim()}`);
        if (dto.vehicleMake?.trim())
            contextLines.push(`Target vehicle make: ${dto.vehicleMake.trim()}`);
        if (dto.vin?.trim())
            contextLines.push(`Donor VIN (if relevant): ${dto.vin.trim()}`);
        const response = await this.openAi.chat({
            model: chatModel,
            systemPrompt: PART_LOOKUP_SYSTEM_PROMPT,
            userPrompt: contextLines.join('\n'),
            jsonMode: true,
            maxTokens: 800,
            temperature: 0.2,
            costLane: 'single-listing-part-lookup',
        });
        const parsed = (0, json_sanitizer_js_1.sanitizeJson)(typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content ?? response.rawContent));
        return {
            result: {
                partName: this.str(parsed.partName),
                brand: this.str(parsed.brand),
                model: this.str(parsed.model),
                category: this.str(parsed.category),
                note: this.str(parsed.note),
                confidence: this.normalizeConfidence(parsed.confidence),
            },
            costUsd: response.estimatedCostUsd,
        };
    }
    async resizeImagesForVision(imageUrls) {
        const optimized = await Promise.all(imageUrls.map(async (url) => {
            if (url.startsWith('data:')) {
                const match = url.match(/^data:image\/[^;]+;base64,(.+)$/s);
                if (!match?.[1])
                    return null;
                try {
                    const buffer = Buffer.from(match[1], 'base64');
                    const resized = await (0, sharp_1.default)(buffer)
                        .rotate()
                        .resize({
                        width: 1600,
                        height: 1600,
                        fit: 'inside',
                        withoutEnlargement: true,
                    })
                        .jpeg({ quality: 80, mozjpeg: true })
                        .toBuffer();
                    return `data:image/jpeg;base64,${resized.toString('base64')}`;
                }
                catch {
                    return null;
                }
            }
            return this.imageOptimizer
                .downloadAndOptimize(url, {
                targetFormat: 'jpg',
                maxWidth: 1600,
                quality: 80,
            })
                .catch(() => null);
        }));
        const dataUrls = [];
        for (const img of optimized) {
            if (!img)
                continue;
            if (typeof img === 'string') {
                dataUrls.push(img);
                continue;
            }
            try {
                const buffer = fs.readFileSync(img.localPath);
                const mime = img.format === 'webp' ? 'image/webp' : 'image/jpeg';
                dataUrls.push(`data:${mime};base64,${buffer.toString('base64')}`);
            }
            catch (err) {
                this.logger.debug(`Could not read optimized image for vision retry: ${err instanceof Error ? err.message : err}`);
            }
        }
        return dataUrls;
    }
    async prepareVisionImageInputs(imageUrls) {
        return Promise.all(imageUrls.map(async (url) => {
            const key = this.storageService.keyFromUrl(url);
            if (!key)
                return url;
            try {
                let buffer = await this.storageService.getObjectBuffer(key);
                let mime = this.visionMimeType(key);
                const metadata = await (0, sharp_1.default)(buffer).metadata().catch(() => null);
                if (buffer.length > 8 * 1024 * 1024 ||
                    (metadata?.width ?? 0) > 2000 ||
                    (metadata?.height ?? 0) > 2000) {
                    try {
                        const resized = await (0, sharp_1.default)(buffer)
                            .rotate()
                            .resize({
                            width: 1600,
                            height: 1600,
                            fit: 'inside',
                            withoutEnlargement: true,
                        })
                            .jpeg({ quality: 82, mozjpeg: true })
                            .toBuffer();
                        if (resized.length < buffer.length) {
                            buffer = resized;
                            mime = 'image/jpeg';
                        }
                    }
                    catch {
                    }
                }
                return `data:${mime};base64,${buffer.toString('base64')}`;
            }
            catch (err) {
                this.logger.warn(`Could not read an app-managed listing photo for vision: ${err instanceof Error ? err.message : err}`);
                throw err;
            }
        }));
    }
    visionMimeType(key) {
        const extension = key.split('.').pop()?.toLowerCase();
        const mimeByExtension = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            webp: 'image/webp',
            gif: 'image/gif',
            heic: 'image/heic',
            heif: 'image/heif',
            avif: 'image/avif',
        };
        return (extension && mimeByExtension[extension]) || 'image/jpeg';
    }
    async runVisionLookup(partNumberHint, imageUrls, brandHint, partType, vehicleMakeHint) {
        const brandLine = brandHint?.trim()
            ? `Brand / OEM manufacturer hint: ${brandHint.trim()}`
            : 'Brand hint: not provided — infer from labels when visible';
        const useEcuPrompt = (0, ecu_identification_prompt_js_1.isEcuPartType)(partType);
        let prompt;
        if (useEcuPrompt) {
            prompt = ecu_identification_prompt_js_1.ECU_IDENTIFICATION_PROMPT;
            this.logger.log(`Using ECU identification prompt for partType="${partType}"`);
        }
        else {
            prompt = SINGLE_LISTING_VISION_PROMPT.replace('{partNumberHint}', partNumberHint)
                .replace('{brandHint}', brandLine)
                .replace('{vehicleMakeHint}', vehicleMakeHint?.trim() || 'not provided');
        }
        const visionContext = {
            partNumber: partNumberHint,
            donorMake: vehicleMakeHint?.trim() || brandHint,
            partType: useEcuPrompt ? (partType ?? 'ecu') : 'single_listing_form',
        };
        const visionImageUrls = await this.prepareVisionImageInputs(imageUrls);
        let visionResult;
        try {
            visionResult = await this.visionPipeline.analyze(visionImageUrls, visionContext, prompt);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (!/cannot exceed/i.test(message))
                throw err;
            this.logger.warn(`Vision call failed on oversized image(s), resizing and retrying once: ${message}`);
            const resizedUrls = await this.resizeImagesForVision(visionImageUrls);
            if (resizedUrls.length === 0)
                throw err;
            visionResult = await this.visionPipeline.analyze(resizedUrls, visionContext, prompt);
        }
        const parsed = visionResult.raw;
        if (useEcuPrompt && visionResult.ecuIdentifiers) {
            const ecu = visionResult.ecuIdentifiers;
            const visibleText = ecu.visibleText ?? [];
            if (!this.visibleTextContainsPartNumber(visibleText, partNumberHint)) {
                throw new common_1.BadRequestException('Photo label text does not confirm the supplied part number. Check the label and review manually before retrying.');
            }
            const bestPartNumber = ecu.mpn || ecu.oemNumber || ecu.hardwareNumber || partNumberHint;
            let note = '';
            if (ecu.hardwareNumber)
                note += `HW: ${ecu.hardwareNumber}. `;
            if (ecu.softwareNumber)
                note += `SW: ${ecu.softwareNumber}. `;
            if (ecu.otherNumbers?.length)
                note += `Other: ${ecu.otherNumbers.join(', ')}. `;
            if (visibleText.length > 0) {
                note += `Visible text: ${visibleText.slice(0, 8).join('; ')}`;
            }
            return {
                result: {
                    partName: ecu.partType
                        ? `${ecu.brand ?? ''} ${ecu.partType} ${bestPartNumber}`.trim()
                        : undefined,
                    brand: ecu.brand ?? undefined,
                    model: ecu.vehicleModel ?? undefined,
                    category: ecu.partType ?? 'Engine Control Units (ECUs)',
                    note: note.trim() || undefined,
                    partNumber: bestPartNumber,
                    confidence: this.normalizeConfidence(ecu.confidence?.overall),
                },
                costUsd: visionResult.estimatedCostUsd,
                visionModel: visionResult.model,
            };
        }
        const coverage = parsed.imageCoverage;
        const hasLabelShot = coverage?.hasLabelShot === true;
        const hasOverallShot = coverage?.hasOverallShot === true;
        const coverageIncomplete = !hasLabelShot || !hasOverallShot;
        if (coverageIncomplete &&
            !this.str(parsed.partName) &&
            !this.str(parsed.title)) {
            throw new common_1.BadRequestException('Photos must include both a label/part-number close-up and an overall part shot. Add the missing photo type and try again.');
        }
        if (coverageIncomplete) {
            this.logger.warn(`Vision lookup: incomplete photo coverage (label=${hasLabelShot}, overall=${hasOverallShot}) — using result at reduced confidence`);
        }
        const visibleText = Array.isArray(parsed.visibleText)
            ? parsed.visibleText.map(String).filter(Boolean)
            : [];
        if (!this.visibleTextContainsPartNumber(visibleText, partNumberHint)) {
            throw new common_1.BadRequestException('Photo label text does not confirm the supplied part number. Check the label and review manually before retrying.');
        }
        let note = this.str(parsed.note);
        if (visibleText.length > 0) {
            const ocrSnippet = visibleText.slice(0, 8).join('; ');
            note = note
                ? `${note} Visible text: ${ocrSnippet}`
                : `Visible text: ${ocrSnippet}`;
        }
        const fitment = parsed.fitment;
        const confidenceRaw = parsed.confidence;
        const confidenceLevel = typeof confidenceRaw === 'object' && confidenceRaw !== null
            ? (confidenceRaw.overall ?? confidenceRaw)
            : confidenceRaw;
        return {
            result: {
                partName: this.str(parsed.partName) ?? this.str(parsed.title),
                brand: this.str(parsed.brand),
                model: this.str(parsed.model) ?? this.str(fitment?.model),
                category: this.str(parsed.category) ?? this.str(parsed.partType),
                note,
                partNumber: this.str(this.sanitizePartNumber(this.str(parsed.partNumber) ??
                    this.str(parsed.mpn) ??
                    this.str(parsed.oemNumber))),
                confidence: coverageIncomplete &&
                    this.normalizeConfidence(confidenceLevel) === 'high'
                    ? 'medium'
                    : this.normalizeConfidence(confidenceLevel),
            },
            costUsd: visionResult.estimatedCostUsd,
            visionModel: visionResult.model,
        };
    }
    async finalizeLookupFields(partial, fallbackPartNumber, replacePartNumber = false) {
        let brand = partial.brand;
        let model = partial.model;
        let mvlMatched = false;
        if (brand) {
            const canonical = await this.mvl.resolveCanonicalMakeModel(ebay_mvl_service_js_1.EbayMvlService.MOTORS_PARTS_CATEGORY, brand, model);
            if (canonical.make)
                brand = canonical.make;
            if (canonical.model)
                model = canonical.model;
            mvlMatched = canonical.mvlMatched;
        }
        return {
            partName: partial.partName,
            brand,
            model,
            category: partial.category,
            note: partial.note,
            partNumber: replacePartNumber && partial.partNumber
                ? partial.partNumber
                : fallbackPartNumber,
            confidence: partial.confidence ?? 'medium',
            mvlMatched,
        };
    }
    visibleTextContainsPartNumber(visibleText, partNumber) {
        const expected = this.sanitizePartNumber(partNumber)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
        if (!expected)
            return false;
        return visibleText.some((text) => {
            const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
            for (let start = 0; start < tokens.length; start++) {
                let joined = '';
                for (let end = start; end < tokens.length; end++) {
                    joined += tokens[end];
                    if (joined === expected)
                        return true;
                    if (joined.length >= expected.length)
                        break;
                }
            }
            return false;
        });
    }
    async allocateSku() {
        const rows = await this.listingRepo.query(`SELECT nextval('sku_seq') AS nextval`);
        const nextNum = Number(rows[0]?.nextval);
        return this.formatSku(nextNum);
    }
    async allocateIntakeSourceRow() {
        const rows = await this.listingRepo.query(`SELECT nextval('warehouse_intake_row_seq') AS nextval`);
        return Number(rows[0]?.nextval);
    }
    isUniqueViolation(err) {
        return (err instanceof typeorm_3.QueryFailedError &&
            err
                .driverError?.code === '23505');
    }
    isSkuUniqueViolation(err) {
        if (!this.isUniqueViolation(err))
            return false;
        const driverError = err.driverError;
        return (driverError?.constraint === 'idx_listing_sku_marketplace_unique_active' ||
            driverError?.constraint === 'idx_listing_sku_unique_active');
    }
    formatSku(num) {
        return `${automotive_oem_brands_js_1.SKU_PREFIX}-${String(num).padStart(5, '0')}`;
    }
    str(value) {
        if (value == null)
            return undefined;
        const s = String(value).trim();
        return s || undefined;
    }
    sanitizePartNumber(value) {
        return (value ?? '').trim().replace(/\s+/g, '');
    }
    stripTitleSpecialChars(value) {
        return (value ?? '')
            .replace(/[^A-Za-z0-9\s\-/&.,+]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    normalizeConfidence(value) {
        const v = String(value ?? '').toLowerCase();
        if (v === 'high' || v === 'medium' || v === 'low')
            return v;
        return 'medium';
    }
};
exports.SingleListingFormService = SingleListingFormService;
exports.SingleListingFormService = SingleListingFormService = SingleListingFormService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(1, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(2, (0, typeorm_1.InjectRepository)(image_asset_entity_js_1.ImageAsset)),
    __param(11, (0, bullmq_1.InjectQueue)('listing-optimization')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        openai_service_js_1.OpenAiService,
        config_1.ConfigService,
        ebay_mvl_service_js_1.EbayMvlService,
        vision_enrichment_pipeline_js_1.VisionEnrichmentPipeline,
        storage_service_js_1.StorageService,
        image_drive_service_js_1.ImageDriveService,
        image_optimizer_service_js_1.ImageOptimizerService,
        ebay_browse_api_service_js_1.EbayBrowseApiService, Function])
], SingleListingFormService);
//# sourceMappingURL=single-listing-form.service.js.map