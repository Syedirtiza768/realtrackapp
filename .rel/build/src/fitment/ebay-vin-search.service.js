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
var EbayVinSearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayVinSearchService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const ebay_browse_api_service_js_1 = require("../channels/ebay/ebay-browse-api.service.js");
const SOURCE_FILE = 'ebay_browse_api';
const CACHE_TTL_DAYS = 7;
let EbayVinSearchService = EbayVinSearchService_1 = class EbayVinSearchService {
    browseApi;
    listingRepo;
    logger = new common_1.Logger(EbayVinSearchService_1.name);
    constructor(browseApi, listingRepo) {
        this.browseApi = browseApi;
        this.listingRepo = listingRepo;
    }
    async searchAndPersist(vin, decoded) {
        const sheetName = `VIN:${vin}`;
        const cached = await this.listingRepo.find({
            where: {
                sourceFileName: SOURCE_FILE,
                sheetName,
                importedAt: (0, typeorm_2.MoreThan)(this.daysAgo(CACHE_TTL_DAYS)),
            },
            order: { importedAt: 'DESC' },
            take: 100,
        });
        if (cached.length > 0) {
            this.logger.log(`Found ${cached.length} cached eBay listings for VIN ${vin} (within ${CACHE_TTL_DAYS}d TTL)`);
            return cached;
        }
        const query = this.buildSearchQuery(decoded);
        if (!query) {
            this.logger.warn(`Cannot build eBay search query for VIN ${vin} — missing make/model`);
            return [];
        }
        this.logger.log(`Searching eBay Browse API for VIN ${vin}: "${query}"`);
        try {
            const result = await this.browseApi.search({
                q: query,
                categoryIds: '6000',
                filter: 'conditionIds:{1000|3000|4000|5000|6000}',
                limit: 50,
            });
            const items = result.itemSummaries ?? [];
            if (items.length === 0) {
                this.logger.log(`No eBay results found for VIN ${vin}`);
                return [];
            }
            this.logger.log(`Found ${items.length} eBay listings for VIN ${vin}, persisting...`);
            const records = items.map((item, idx) => ({
                sourceFileName: SOURCE_FILE,
                sourceFilePath: `ebay://item/${item.itemId}`,
                origin: listing_record_entity_js_1.ListingOrigin.PIPELINE_IMPORT,
                sheetName,
                sourceRowNumber: idx + 1,
                action: 'Add',
                customLabelSku: `EBAY-${item.itemId}`,
                title: item.title,
                categoryId: item.categories?.[0]?.categoryId ?? null,
                categoryName: item.categories?.[0]?.categoryName ?? null,
                startPrice: item.price?.value ?? null,
                startPriceNum: item.price?.value ? parseFloat(item.price.value) : null,
                quantity: '1',
                quantityNum: 1,
                conditionId: item.conditionId ?? null,
                itemPhotoUrl: item.image?.imageUrl ?? null,
                format: 'FIXED_PRICE',
                extractedMake: decoded.make ?? null,
                extractedModel: decoded.model ?? null,
                status: 'draft',
            }));
            const saved = await this.upsertListings(records);
            this.logger.log(`Persisted ${saved.length} eBay listings for VIN ${vin}`);
            return saved;
        }
        catch (err) {
            this.logger.error(`eBay Browse API search failed for VIN ${vin}: ${err.message}`, err.stack);
            return [];
        }
    }
    buildSearchQuery(decoded) {
        const parts = [];
        if (decoded.year)
            parts.push(String(decoded.year));
        if (decoded.make)
            parts.push(decoded.make);
        if (decoded.model)
            parts.push(decoded.model);
        if (decoded.trim)
            parts.push(decoded.trim);
        parts.push('parts');
        return parts.length >= 3 ? parts.join(' ') : null;
    }
    async upsertListings(records) {
        const saved = [];
        for (const record of records) {
            try {
                const existing = await this.listingRepo.findOne({
                    where: {
                        sourceFileName: record.sourceFileName,
                        sheetName: record.sheetName,
                        sourceRowNumber: record.sourceRowNumber,
                    },
                });
                if (existing) {
                    Object.assign(existing, {
                        title: record.title,
                        startPrice: record.startPrice,
                        startPriceNum: record.startPriceNum,
                        conditionId: record.conditionId,
                        itemPhotoUrl: record.itemPhotoUrl,
                        categoryId: record.categoryId,
                        categoryName: record.categoryName,
                    });
                    saved.push(await this.listingRepo.save(existing));
                }
                else {
                    saved.push(await this.listingRepo.save(this.listingRepo.create(record)));
                }
            }
            catch (err) {
                this.logger.warn(`Failed to upsert listing ${record.customLabelSku}: ${err.message}`);
            }
        }
        return saved;
    }
    daysAgo(days) {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d;
    }
};
exports.EbayVinSearchService = EbayVinSearchService;
exports.EbayVinSearchService = EbayVinSearchService = EbayVinSearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __metadata("design:paramtypes", [ebay_browse_api_service_js_1.EbayBrowseApiService,
        typeorm_2.Repository])
], EbayVinSearchService);
//# sourceMappingURL=ebay-vin-search.service.js.map