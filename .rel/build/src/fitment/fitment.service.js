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
var FitmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FitmentService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fitment_make_entity_js_1 = require("./entities/fitment-make.entity.js");
const fitment_model_entity_js_1 = require("./entities/fitment-model.entity.js");
const fitment_submodel_entity_js_1 = require("./entities/fitment-submodel.entity.js");
const fitment_engine_entity_js_1 = require("./entities/fitment-engine.entity.js");
const part_fitment_entity_js_1 = require("./entities/part-fitment.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const vin_decode_service_js_1 = require("./vin-decode.service.js");
const ebay_vin_search_service_js_1 = require("./ebay-vin-search.service.js");
const ebay_listing_images_util_js_1 = require("../channels/ebay/ebay-listing-images.util.js");
let FitmentService = FitmentService_1 = class FitmentService {
    makeRepo;
    modelRepo;
    submodelRepo;
    engineRepo;
    fitmentRepo;
    listingRepo;
    vinDecodeService;
    ebayVinSearch;
    logger = new common_1.Logger(FitmentService_1.name);
    constructor(makeRepo, modelRepo, submodelRepo, engineRepo, fitmentRepo, listingRepo, vinDecodeService, ebayVinSearch) {
        this.makeRepo = makeRepo;
        this.modelRepo = modelRepo;
        this.submodelRepo = submodelRepo;
        this.engineRepo = engineRepo;
        this.fitmentRepo = fitmentRepo;
        this.listingRepo = listingRepo;
        this.vinDecodeService = vinDecodeService;
        this.ebayVinSearch = ebayVinSearch;
    }
    async getMakes(q) {
        if (q) {
            return this.makeRepo.find({
                where: { name: (0, typeorm_2.ILike)(`%${q}%`) },
                order: { name: 'ASC' },
                take: 50,
            });
        }
        return this.makeRepo.find({ order: { name: 'ASC' } });
    }
    async getModels(makeId) {
        return this.modelRepo.find({
            where: { makeId },
            order: { name: 'ASC' },
        });
    }
    async getSubmodels(modelId) {
        return this.submodelRepo.find({
            where: { modelId },
            order: { name: 'ASC' },
        });
    }
    async getEngines(q) {
        if (q) {
            return this.engineRepo.find({
                where: { code: (0, typeorm_2.ILike)(`%${q}%`) },
                order: { code: 'ASC' },
                take: 50,
            });
        }
        return this.engineRepo.find({ order: { code: 'ASC' } });
    }
    async getListingFitments(listingId) {
        return this.fitmentRepo.find({
            where: { listingId },
            relations: ['make', 'model', 'submodel', 'engine'],
            order: { yearStart: 'ASC' },
        });
    }
    async createFitment(listingId, dto) {
        if (dto.yearStart > dto.yearEnd) {
            throw new Error('yearStart must be <= yearEnd');
        }
        if (dto.yearEnd - dto.yearStart > 50) {
            throw new Error('Year range cannot exceed 50 years');
        }
        const fitment = this.fitmentRepo.create({
            listingId,
            makeId: dto.makeId,
            modelId: dto.modelId,
            submodelId: dto.submodelId ?? null,
            yearStart: dto.yearStart,
            yearEnd: dto.yearEnd,
            engineId: dto.engineId ?? null,
            source: dto.source ?? 'manual',
            confidence: dto.confidence ?? null,
            notes: dto.notes ?? null,
        });
        const saved = await this.fitmentRepo.save(fitment);
        this.logger.log(`Created fitment ${saved.id} for listing=${listingId}`);
        return saved;
    }
    async deleteFitment(fitmentId) {
        const result = await this.fitmentRepo.delete(fitmentId);
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`Fitment ${fitmentId} not found`);
        }
    }
    async verifyFitment(fitmentId, verified, userId) {
        const fitment = await this.fitmentRepo.findOneBy({ id: fitmentId });
        if (!fitment) {
            throw new common_1.NotFoundException(`Fitment ${fitmentId} not found`);
        }
        fitment.verified = verified;
        fitment.verifiedBy = userId ?? null;
        fitment.verifiedAt = verified ? new Date() : null;
        return this.fitmentRepo.save(fitment);
    }
    async searchByVehicle(dto) {
        const qb = this.fitmentRepo
            .createQueryBuilder('pf')
            .leftJoinAndSelect('pf.make', 'make')
            .leftJoinAndSelect('pf.model', 'model')
            .leftJoinAndSelect('pf.submodel', 'submodel')
            .leftJoinAndSelect('pf.engine', 'engine');
        if (dto.make) {
            qb.andWhere('make.slug = :makeSlug', {
                makeSlug: dto.make.toLowerCase(),
            });
        }
        if (dto.model) {
            qb.andWhere('model.slug = :modelSlug', {
                modelSlug: dto.model.toLowerCase(),
            });
        }
        if (dto.yearStart) {
            qb.andWhere('pf.year_end >= :yearStart', { yearStart: dto.yearStart });
        }
        if (dto.yearEnd) {
            qb.andWhere('pf.year_start <= :yearEnd', { yearEnd: dto.yearEnd });
        }
        if (dto.engine) {
            qb.andWhere('engine.code ILIKE :engineCode', {
                engineCode: `%${dto.engine}%`,
            });
        }
        qb.orderBy('pf.year_start', 'ASC')
            .take(dto.limit ?? 50)
            .skip(dto.offset ?? 0);
        const [fitments, total] = await qb.getManyAndCount();
        return { fitments, total };
    }
    async findListingsByVin(vin) {
        const decoded = await this.vinDecodeService.decode(vin);
        const year = parseInt(decoded.year, 10);
        const makeSlug = this.slugify(decoded.make);
        const modelSlug = this.slugify(decoded.model);
        const qb = this.fitmentRepo
            .createQueryBuilder('pf')
            .leftJoinAndSelect('pf.make', 'make')
            .leftJoinAndSelect('pf.model', 'model')
            .leftJoinAndSelect('pf.submodel', 'submodel')
            .leftJoinAndSelect('pf.engine', 'engine')
            .leftJoinAndSelect('pf.listing', 'listing');
        if (makeSlug) {
            qb.andWhere('make.slug = :makeSlug', { makeSlug });
        }
        if (modelSlug) {
            qb.andWhere('model.slug = :modelSlug', { modelSlug });
        }
        if (!Number.isNaN(year)) {
            qb.andWhere('pf.year_start <= :year AND pf.year_end >= :year', {
                year,
            });
        }
        const fitments = await qb.getMany();
        const listingsMap = new Map();
        for (const f of fitments) {
            const listing = f.listing;
            if (listing?.id && !listingsMap.has(listing.id)) {
                listingsMap.set(listing.id, listing);
            }
        }
        let listings = Array.from(listingsMap.values());
        let matchStrategy = 'fitment';
        if (listings.length === 0) {
            listings = await this.findListingsByVehicleText(decoded.make, decoded.model, year);
            matchStrategy = 'fallback_text';
        }
        if (listings.length === 0 && decoded.aiEnriched && decoded.aiData) {
            const aiListings = await this.findListingsByAiEnrichment(decoded);
            if (aiListings.length > 0) {
                listings = aiListings;
                matchStrategy = 'ai_enriched';
            }
        }
        if (listings.length === 0) {
            const ebayListings = await this.ebayVinSearch.searchAndPersist(vin, decoded);
            if (ebayListings.length > 0) {
                listings = ebayListings;
                matchStrategy = 'ebay_browse';
            }
        }
        const enriched = listings.map((l) => ({
            ...l,
            parsedImages: (0, ebay_listing_images_util_js_1.parseImageUrlField)(l.itemPhotoUrl),
        }));
        return {
            vin: decoded.vin,
            vehicle: decoded,
            totalFitments: fitments.length,
            totalListings: enriched.length,
            matchStrategy,
            listings: enriched,
        };
    }
    async findListingsByAiEnrichment(decoded) {
        const aiData = decoded.aiData;
        const listingsMap = new Map();
        if (aiData.knownFitment?.length) {
            for (const fitment of aiData.knownFitment.slice(0, 5)) {
                const parts = fitment.match(/(\d{4})?[-–]?(\d{4})?\s+(\w+)\s+(\w[\w\s]*)/);
                if (parts) {
                    const [, yrStart, yrEnd, make, model] = parts;
                    const results = await this.findListingsByVehicleText(make, model?.trim(), yrStart ? parseInt(yrStart, 10) : NaN);
                    for (const r of results) {
                        if (!listingsMap.has(r.id))
                            listingsMap.set(r.id, r);
                    }
                }
            }
        }
        if (listingsMap.size === 0 && aiData.commonParts?.length) {
            const searchTerms = [
                `${decoded.make} ${decoded.model}`,
                ...aiData.commonParts.slice(0, 5),
            ];
            for (const term of searchTerms) {
                const qb = this.listingRepo
                    .createQueryBuilder('r')
                    .select([
                    'r.id',
                    'r.customLabelSku',
                    'r.title',
                    'r.cBrand',
                    'r.cType',
                    'r.categoryId',
                    'r.categoryName',
                    'r.startPrice',
                    'r.quantity',
                    'r.conditionId',
                    'r.itemPhotoUrl',
                    'r.cManufacturerPartNumber',
                    'r.cOeOemPartNumber',
                    'r.location',
                    'r.format',
                    'r.sourceFileName',
                    'r.importedAt',
                    'r.extractedMake',
                    'r.extractedModel',
                ])
                    .where('r.title ILIKE :term', { term: `%${term}%` })
                    .orderBy('r.importedAt', 'DESC')
                    .limit(50);
                const results = await qb.getMany();
                for (const r of results) {
                    if (!listingsMap.has(r.id))
                        listingsMap.set(r.id, r);
                }
                if (listingsMap.size >= 100)
                    break;
            }
        }
        return Array.from(listingsMap.values());
    }
    async findListingsByVehicleText(make, model, year) {
        const normalizedMake = make?.trim();
        const normalizedModel = model?.trim();
        if (!normalizedMake || !normalizedModel) {
            return [];
        }
        const qb = this.listingRepo
            .createQueryBuilder('r')
            .select([
            'r.id',
            'r.customLabelSku',
            'r.title',
            'r.cBrand',
            'r.cType',
            'r.categoryId',
            'r.categoryName',
            'r.startPrice',
            'r.quantity',
            'r.conditionId',
            'r.itemPhotoUrl',
            'r.cManufacturerPartNumber',
            'r.cOeOemPartNumber',
            'r.location',
            'r.format',
            'r.sourceFileName',
            'r.importedAt',
            'r.extractedMake',
            'r.extractedModel',
        ])
            .where(new typeorm_2.Brackets((whereQb) => {
            whereQb
                .where('r.extractedMake ILIKE :make', { make: normalizedMake })
                .orWhere('(r.title ILIKE :makeLike AND r.title ILIKE :modelLike)', {
                makeLike: `%${normalizedMake}%`,
                modelLike: `%${normalizedModel}%`,
            })
                .orWhere('(r.description ILIKE :makeLike2 AND r.description ILIKE :modelLike2)', {
                makeLike2: `%${normalizedMake}%`,
                modelLike2: `%${normalizedModel}%`,
            });
        }))
            .orderBy('r.importedAt', 'DESC')
            .addOrderBy('r.id', 'ASC')
            .limit(300);
        if (!Number.isNaN(year)) {
            qb.andWhere(new typeorm_2.Brackets((yearQb) => {
                yearQb
                    .where('r.title ILIKE :yearStr', { yearStr: `%${year}%` })
                    .orWhere('r.description ILIKE :yearStr2', {
                    yearStr2: `%${year}%`,
                });
            }));
        }
        return qb.getMany();
    }
    slugify(text) {
        if (!text)
            return '';
        return text
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]/g, '-');
    }
};
exports.FitmentService = FitmentService;
exports.FitmentService = FitmentService = FitmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(fitment_make_entity_js_1.FitmentMake)),
    __param(1, (0, typeorm_1.InjectRepository)(fitment_model_entity_js_1.FitmentModel)),
    __param(2, (0, typeorm_1.InjectRepository)(fitment_submodel_entity_js_1.FitmentSubmodel)),
    __param(3, (0, typeorm_1.InjectRepository)(fitment_engine_entity_js_1.FitmentEngine)),
    __param(4, (0, typeorm_1.InjectRepository)(part_fitment_entity_js_1.PartFitment)),
    __param(5, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        vin_decode_service_js_1.VinDecodeService,
        ebay_vin_search_service_js_1.EbayVinSearchService])
], FitmentService);
//# sourceMappingURL=fitment.service.js.map