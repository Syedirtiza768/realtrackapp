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
var AiEnhancementService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiEnhancementService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ai_enhancement_entity_js_1 = require("./entities/ai-enhancement.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const enrichment_pipeline_js_1 = require("../common/openai/pipelines/enrichment.pipeline.js");
const listing_generation_pipeline_js_1 = require("../common/openai/pipelines/listing-generation.pipeline.js");
const openai_service_js_1 = require("../common/openai/openai.service.js");
const ai_run_log_service_js_1 = require("../common/openai/ai-run-log.service.js");
let AiEnhancementService = AiEnhancementService_1 = class AiEnhancementService {
    enhancementRepo;
    listingRepo;
    enrichmentPipeline;
    listingGenPipeline;
    openAiService;
    aiRunLogService;
    logger = new common_1.Logger(AiEnhancementService_1.name);
    constructor(enhancementRepo, listingRepo, enrichmentPipeline, listingGenPipeline, openAiService, aiRunLogService) {
        this.enhancementRepo = enhancementRepo;
        this.listingRepo = listingRepo;
        this.enrichmentPipeline = enrichmentPipeline;
        this.listingGenPipeline = listingGenPipeline;
        this.openAiService = openAiService;
        this.aiRunLogService = aiRunLogService;
    }
    async getEnhancements(filters) {
        const qb = this.enhancementRepo.createQueryBuilder('e');
        if (filters.listingId)
            qb.andWhere('e.listing_id = :listingId', {
                listingId: filters.listingId,
            });
        if (filters.enhancementType)
            qb.andWhere('e.enhancement_type = :type', {
                type: filters.enhancementType,
            });
        if (filters.status)
            qb.andWhere('e.status = :status', { status: filters.status });
        const [items, total] = await qb
            .orderBy('e.created_at', 'DESC')
            .take(filters.limit ?? 50)
            .skip(filters.offset ?? 0)
            .getManyAndCount();
        return { items, total };
    }
    async getEnhancement(id) {
        const enh = await this.enhancementRepo.findOneBy({ id });
        if (!enh)
            throw new common_1.NotFoundException(`Enhancement ${id} not found`);
        return enh;
    }
    async getListingEnhancements(listingId) {
        return this.enhancementRepo.find({
            where: { listingId },
            order: { enhancementType: 'ASC', enhancementVersion: 'DESC' },
        });
    }
    async requestEnhancement(data) {
        const listing = await this.listingRepo.findOneBy({ id: data.listingId });
        if (!listing)
            throw new common_1.NotFoundException(`Listing ${data.listingId} not found`);
        const latestVersion = await this.enhancementRepo
            .createQueryBuilder('e')
            .select('MAX(e.enhancement_version)', 'maxVer')
            .where('e.listing_id = :listingId AND e.enhancement_type = :type', {
            listingId: data.listingId,
            type: data.enhancementType,
        })
            .getRawOne();
        const nextVersion = (latestVersion?.maxVer ?? 0) + 1;
        const inputData = data.inputData ?? this.buildInputData(listing, data.enhancementType);
        const enhancement = this.enhancementRepo.create({
            listingId: data.listingId,
            enhancementType: data.enhancementType,
            status: 'requested',
            inputData,
            originalValue: this.getOriginalValue(listing, data.enhancementType),
            enhancementVersion: nextVersion,
        });
        const saved = await this.enhancementRepo.save(enhancement);
        this.logger.log(`Requested ${data.enhancementType} v${nextVersion} for listing ${data.listingId}`);
        return this.processEnhancement(saved.id);
    }
    async bulkRequestEnhancements(listingIds, enhancementType) {
        const results = [];
        for (const listingId of listingIds) {
            try {
                const enh = await this.requestEnhancement({
                    listingId,
                    enhancementType,
                });
                results.push({ listingId, enhancementId: enh.id, status: 'generated' });
            }
            catch (error) {
                results.push({ listingId, status: 'error', error: error.message });
            }
        }
        return { results };
    }
    async processEnhancement(enhancementId) {
        const enh = await this.getEnhancement(enhancementId);
        enh.status = 'processing';
        await this.enhancementRepo.save(enh);
        const startMs = Date.now();
        try {
            const result = await this.generateEnhancement(enh);
            enh.status = 'generated';
            enh.enhancedValue = result.enhancedValue;
            enh.enhancedData = result.enhancedData ?? null;
            enh.diff = result.diff ?? null;
            enh.confidenceScore = result.confidenceScore;
            enh.provider = result.provider ?? 'openai';
            enh.model = result.model ?? 'openai/gpt-4.1-mini';
            enh.tokensUsed = result.tokensUsed;
            enh.latencyMs = Date.now() - startMs;
            enh.costUsd = result.costUsd ?? 0;
            return this.enhancementRepo.save(enh);
        }
        catch (error) {
            enh.status = 'rejected';
            enh.rejectionReason = `Processing failed: ${error.message}`;
            enh.latencyMs = Date.now() - startMs;
            await this.enhancementRepo.save(enh);
            throw error;
        }
    }
    async approveEnhancement(enhancementId, approvedBy) {
        const enh = await this.getEnhancement(enhancementId);
        if (enh.status !== 'generated') {
            throw new common_1.BadRequestException(`Cannot approve enhancement in "${enh.status}" status`);
        }
        enh.status = 'approved';
        enh.approvedBy = approvedBy ?? null;
        enh.approvedAt = new Date();
        const saved = await this.enhancementRepo.save(enh);
        await this.aiRunLogService.backfillApproval(enhancementId, true);
        this.logger.log(`Approved enhancement ${enhancementId}`);
        return saved;
    }
    async applyEnhancement(enhancementId) {
        const enh = await this.getEnhancement(enhancementId);
        if (enh.status !== 'approved') {
            throw new common_1.BadRequestException(`Cannot apply enhancement in "${enh.status}" status — must be approved first`);
        }
        const listing = await this.listingRepo.findOneBy({ id: enh.listingId });
        if (!listing)
            throw new common_1.NotFoundException(`Listing ${enh.listingId} not found`);
        this.applyToListing(listing, enh);
        const savedListing = await this.listingRepo.save(listing);
        enh.appliedAt = new Date();
        const savedEnh = await this.enhancementRepo.save(enh);
        this.logger.log(`Applied ${enh.enhancementType} v${enh.enhancementVersion} to listing ${enh.listingId}`);
        return { enhancement: savedEnh, listing: savedListing };
    }
    async rejectEnhancement(enhancementId, reason) {
        const enh = await this.getEnhancement(enhancementId);
        if (enh.status !== 'generated') {
            throw new common_1.BadRequestException(`Cannot reject enhancement in "${enh.status}" status`);
        }
        enh.status = 'rejected';
        enh.rejectionReason = reason;
        const saved = await this.enhancementRepo.save(enh);
        await this.aiRunLogService.backfillApproval(enhancementId, false, reason);
        return saved;
    }
    async getStats() {
        const [totalCount, byType, byStatus, avgConfidence] = await Promise.all([
            this.enhancementRepo.count(),
            this.enhancementRepo
                .createQueryBuilder('e')
                .select('e.enhancement_type', 'type')
                .addSelect('COUNT(*)', 'count')
                .groupBy('e.enhancement_type')
                .getRawMany(),
            this.enhancementRepo
                .createQueryBuilder('e')
                .select('e.status', 'status')
                .addSelect('COUNT(*)', 'count')
                .groupBy('e.status')
                .getRawMany(),
            this.enhancementRepo
                .createQueryBuilder('e')
                .select('AVG(e.confidence_score)', 'avg')
                .where('e.confidence_score IS NOT NULL')
                .getRawOne(),
        ]);
        return {
            totalCount,
            byType,
            byStatus,
            avgConfidence: Number(avgConfidence?.avg ?? 0),
        };
    }
    async generateEnhancement(enh) {
        const input = enh.inputData;
        const original = enh.originalValue ?? '';
        switch (enh.enhancementType) {
            case 'title_optimization':
            case 'description_generation':
                return this.generateListingContent(enh.enhancementType, original, input);
            case 'item_specifics':
                return this.generateItemSpecificsAI(input, enh.id);
            case 'fitment_detection':
                return this.generateFitmentDetectionAI(input, enh.id);
            case 'image_enhancement':
                return this.generateImageEnhancement(input);
            default:
                throw new common_1.BadRequestException(`Unknown enhancement type: ${enh.enhancementType}`);
        }
    }
    async generateListingContent(type, original, input) {
        try {
            const result = await this.listingGenPipeline.generate(input, String(input['category'] ?? 'Auto Parts'), String(input['condition'] ?? 'Used'));
            const enhancedValue = type === 'title_optimization' ? result.title : result.description;
            const changes = type === 'title_optimization'
                ? [
                    'AI-optimized for eBay search ranking',
                    'Keyword prominence improved',
                    'Limited to 80 chars',
                ]
                : [
                    'Generated structured HTML description',
                    'Added product specs & compatibility',
                    'SEO-optimized content',
                ];
            return {
                enhancedValue,
                enhancedData: {
                    title: result.title,
                    subtitle: result.subtitle,
                    description: result.description,
                    bulletPoints: result.bulletPoints,
                    searchTerms: result.searchTerms,
                    pricePositioning: result.pricePositioning,
                },
                diff: {
                    original: original?.slice(0, 200) ?? '(empty)',
                    enhanced: enhancedValue.slice(0, 200),
                    changes,
                },
                confidenceScore: 0.88,
                tokensUsed: result.rawResponse?.usage?.totalTokens ?? 0,
                provider: 'openai',
                model: result.rawResponse?.model ?? 'openai/gpt-4.1-mini',
                costUsd: result.rawResponse?.estimatedCostUsd ?? 0,
            };
        }
        catch (err) {
            this.logger.warn(`OpenAI listing generation failed, using fallback: ${err.message}`);
            return this.fallbackListingContent(type, original, input);
        }
    }
    async generateItemSpecificsAI(input, enhancementId) {
        try {
            const result = await this.enrichmentPipeline.enrich(input, {
                enhancementId,
                productId: this.str(input.productId ?? input.catalogProductId),
                importId: this.str(input.importId),
                marketplace: this.str(input.marketplace) ?? 'US',
            });
            const specifics = {
                Brand: result.brand ?? String(input['brand'] ?? 'Unbranded'),
                'Manufacturer Part Number': result.mpn ?? String(input['mpn'] ?? 'Does Not Apply'),
                Type: result.partType ?? String(input['partType'] ?? 'Replacement Part'),
                ...result.itemSpecifics,
            };
            if (result.oemNumber)
                specifics['OE/OEM Part Number'] = result.oemNumber;
            return {
                enhancedValue: JSON.stringify(specifics),
                enhancedData: {
                    specifics,
                    fieldCount: Object.keys(specifics).length,
                    searchKeywords: result.searchKeywords,
                },
                diff: {
                    added: Object.keys(specifics),
                    fieldCount: Object.keys(specifics).length,
                },
                confidenceScore: result.confidence?.overall ?? 0.85,
                tokensUsed: result.rawResponse?.usage?.totalTokens ?? 0,
                provider: 'openai',
                model: result.model ?? result.rawResponse?.model ?? 'openai/gpt-4.1-mini',
                costUsd: result.rawResponse?.estimatedCostUsd ?? 0,
            };
        }
        catch (err) {
            this.logger.warn(`OpenAI enrichment failed, using fallback: ${err.message}`);
            return this.fallbackItemSpecifics(input);
        }
    }
    async generateFitmentDetectionAI(input, enhancementId) {
        try {
            const result = await this.enrichmentPipeline.enrich({
                ...input,
                extractFitment: true,
            }, {
                enhancementId,
                productId: this.str(input.productId ?? input.catalogProductId),
                importId: this.str(input.importId),
                marketplace: this.str(input.marketplace) ?? 'US',
            });
            const fitments = result.itemSpecifics?.fitments
                ? JSON.parse(String(result.itemSpecifics.fitments))
                : [];
            return {
                enhancedValue: JSON.stringify(fitments),
                enhancedData: { fitments, suggestedCategory: result.suggestedCategory },
                diff: { fitmentCount: fitments.length, detectedFromAI: true },
                confidenceScore: result.confidence?.overall ?? 0.75,
                tokensUsed: result.rawResponse?.usage?.totalTokens ?? 0,
                provider: 'openai',
                model: result.model ?? result.rawResponse?.model ?? 'openai/gpt-4.1-mini',
                costUsd: result.rawResponse?.estimatedCostUsd ?? 0,
            };
        }
        catch (err) {
            this.logger.warn(`OpenAI fitment detection failed, using fallback: ${err.message}`);
            return this.fallbackFitmentDetection(input);
        }
    }
    fallbackListingContent(type, original, input) {
        const brand = String(input['brand'] ?? '');
        const mpn = String(input['mpn'] ?? '');
        const partType = String(input['partType'] ?? 'Auto Part');
        if (type === 'title_optimization') {
            const pieces = [brand, mpn, partType, 'OEM Direct Fit'].filter(Boolean);
            const enhanced = pieces.join(' ').slice(0, 80).trim();
            return {
                enhancedValue: enhanced,
                diff: {
                    original,
                    enhanced,
                    changes: ['Fallback: keyword concatenation'],
                },
                confidenceScore: 0.5,
                tokensUsed: 0,
                provider: 'fallback',
                model: 'rule-based',
                costUsd: 0,
            };
        }
        const title = String(input['title'] ?? 'Auto Part');
        const enhanced = `<h3>${title}</h3><p><strong>Brand:</strong> ${brand} | <strong>MPN:</strong> ${mpn}</p><p>OEM-quality direct replacement part. Please verify fitment before purchasing.</p>`;
        return {
            enhancedValue: enhanced,
            diff: {
                original: original?.slice(0, 200) ?? '(empty)',
                enhanced: enhanced.slice(0, 200),
                changes: ['Fallback: template-based'],
            },
            confidenceScore: 0.5,
            tokensUsed: 0,
            provider: 'fallback',
            model: 'rule-based',
            costUsd: 0,
        };
    }
    fallbackItemSpecifics(input) {
        const specifics = {
            Brand: String(input['brand'] ?? 'Unbranded'),
            'Manufacturer Part Number': String(input['mpn'] ?? 'Does Not Apply'),
            Type: String(input['partType'] ?? 'Replacement Part'),
            'Fitment Type': 'Direct Replacement',
            Warranty: 'No Warranty',
        };
        if (input['oemNumber'])
            specifics['OE/OEM Part Number'] = String(input['oemNumber']);
        return {
            enhancedValue: JSON.stringify(specifics),
            enhancedData: { specifics, fieldCount: Object.keys(specifics).length },
            diff: {
                added: Object.keys(specifics),
                fieldCount: Object.keys(specifics).length,
            },
            confidenceScore: 0.5,
            tokensUsed: 0,
            provider: 'fallback',
            model: 'rule-based',
            costUsd: 0,
        };
    }
    fallbackFitmentDetection(input) {
        const title = String(input['title'] ?? '');
        const yearPattern = /\b(19|20)\d{2}\b/g;
        const years = Array.from(title.matchAll(yearPattern)).map((m) => m[0]);
        const makes = [
            'Ford',
            'Chevrolet',
            'Toyota',
            'Honda',
            'BMW',
            'Mercedes-Benz',
            'Dodge',
            'Audi',
            'Volkswagen',
            'Jaguar',
            'Land Rover',
        ];
        const detectedMake = makes.find((m) => title.toLowerCase().includes(m.toLowerCase())) ??
            'Universal';
        const fitments = years.length > 0
            ? years.map((y) => ({ year: y, make: detectedMake, model: 'Various' }))
            : [];
        return {
            enhancedValue: JSON.stringify(fitments),
            enhancedData: { fitments, fitmentCount: fitments.length, detectedMake },
            diff: { fitmentCount: fitments.length },
            confidenceScore: years.length > 0 ? 0.6 : 0.3,
            tokensUsed: 0,
            provider: 'fallback',
            model: 'rule-based',
            costUsd: 0,
        };
    }
    generateImageEnhancement(input) {
        const imageCount = Number(input['imageCount'] ?? 1);
        return {
            enhancedValue: `${imageCount} image(s) queued for enhancement`,
            enhancedData: {
                processedImages: imageCount,
                enhancements: [
                    'Background removal',
                    'Auto-crop',
                    'Brightness optimization',
                    'Resize to 1600x1600',
                ],
            },
            diff: { imageCount, enhancementsApplied: 4 },
            confidenceScore: 0.9,
            tokensUsed: 0,
            provider: 'local',
            model: 'image-processor',
            costUsd: 0,
        };
    }
    buildInputData(listing, type) {
        return {
            title: listing.title,
            brand: listing.cBrand ?? null,
            mpn: listing.cManufacturerPartNumber ?? null,
            oemNumber: listing.cOeOemPartNumber ?? null,
            partType: listing.cType ?? null,
            condition: listing.conditionId ?? null,
            features: listing.cFeatures ?? null,
            price: listing.startPrice ?? null,
            imageCount: listing.pictureUrl ? 1 : 0,
        };
    }
    getOriginalValue(listing, type) {
        switch (type) {
            case 'title_optimization':
                return listing.title ?? null;
            case 'description_generation':
                return listing.description ?? null;
            case 'item_specifics':
                return JSON.stringify({
                    brand: listing.cBrand,
                    mpn: listing.cManufacturerPartNumber,
                    condition: listing.conditionId,
                });
            case 'fitment_detection':
                return listing.title ?? null;
            case 'image_enhancement':
                return listing.pictureUrl ?? null;
            default:
                return null;
        }
    }
    applyToListing(listing, enh) {
        switch (enh.enhancementType) {
            case 'title_optimization':
                if (enh.enhancedValue)
                    listing.title = enh.enhancedValue;
                break;
            case 'description_generation':
                if (enh.enhancedValue)
                    listing.description = enh.enhancedValue;
                break;
            case 'item_specifics':
                if (enh.enhancedData?.specifics) {
                    const specs = enh.enhancedData.specifics;
                    if (specs['Brand'])
                        listing.cBrand = specs['Brand'];
                    if (specs['Manufacturer Part Number']) {
                        listing.cManufacturerPartNumber =
                            specs['Manufacturer Part Number'];
                    }
                }
                break;
        }
    }
    str(val) {
        return typeof val === 'string' && val.trim().length > 0
            ? val.trim()
            : undefined;
    }
};
exports.AiEnhancementService = AiEnhancementService;
exports.AiEnhancementService = AiEnhancementService = AiEnhancementService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ai_enhancement_entity_js_1.AiEnhancement)),
    __param(1, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        enrichment_pipeline_js_1.EnrichmentPipeline,
        listing_generation_pipeline_js_1.ListingGenerationPipeline,
        openai_service_js_1.OpenAiService,
        ai_run_log_service_js_1.AiRunLogService])
], AiEnhancementService);
//# sourceMappingURL=ai-enhancement.service.js.map