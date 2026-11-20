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
var CategoryLookupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryLookupService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_taxonomy_api_service_js_1 = require("../../channels/ebay/ebay-taxonomy-api.service.js");
const catalog_product_entity_js_1 = require("../entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
let CategoryLookupService = class CategoryLookupService {
    static { CategoryLookupService_1 = this; }
    taxonomy;
    productRepo;
    listingRepo;
    logger = new common_1.Logger(CategoryLookupService_1.name);
    treeIdCache = new Map();
    static KNOWN_TREE_IDS = {
        EBAY_US: '0',
        EBAY_AU: '15',
        EBAY_DE: '77',
        EBAY_GB: '3',
    };
    constructor(taxonomy, productRepo, listingRepo) {
        this.taxonomy = taxonomy;
        this.productRepo = productRepo;
        this.listingRepo = listingRepo;
    }
    async lookupCategory(title, brand, partType, mpn, marketplace) {
        const treeId = await this.resolveTreeId(marketplace);
        const query = this.buildQuery(title, brand, partType, mpn);
        if (!query) {
            return { categoryId: null, categoryName: null, confidence: 'none' };
        }
        try {
            const suggestions = await this.taxonomy.getCategorySuggestions(query, treeId);
            const first = suggestions?.[0];
            if (first?.category?.categoryId) {
                const isExact = first.relevancy === 'RELEVANT' || first.relevancy?.includes('HIGH');
                return {
                    categoryId: first.category.categoryId,
                    categoryName: first.category.categoryName ?? null,
                    confidence: isExact ? 'high' : 'medium',
                };
            }
            return { categoryId: null, categoryName: null, confidence: 'none' };
        }
        catch (err) {
            this.logger.warn(`eBay category lookup failed for query "${query}": ${err.message}`);
            return { categoryId: null, categoryName: null, confidence: 'none' };
        }
    }
    async lookupAndUpdateProduct(product) {
        if (product.categoryId)
            return false;
        let result;
        if (product.categoryName) {
            result = await this.lookupByCategoryName(product.categoryName);
            if (!result.categoryId) {
                result = await this.lookupCategory(product.title, product.brand, product.partType, product.mpn);
            }
        }
        else {
            result = await this.lookupCategory(product.title, product.brand, product.partType, product.mpn);
        }
        if (!result.categoryId)
            return false;
        await this.productRepo.update(product.id, {
            categoryId: result.categoryId,
            categoryName: result.categoryName,
        });
        if (product.sku) {
            await this.listingRepo.update({ customLabelSku: product.sku, categoryId: (0, typeorm_2.IsNull)() }, {
                categoryId: result.categoryId,
                categoryName: result.categoryName,
            });
        }
        this.logger.log(`Updated product ${product.id} (${product.sku ?? 'no-sku'}) → category ${result.categoryId} (${result.categoryName})`);
        return true;
    }
    async backfillMissingCategories(batchSize = 10, concurrency = 2) {
        const total = await this.productRepo.count({
            where: { categoryId: (0, typeorm_2.IsNull)() },
        });
        this.logger.log(`Backfill starting: ${total} products with missing categoryId`);
        let scanned = 0;
        let updated = 0;
        let failed = 0;
        for (let offset = 0; offset < total; offset += batchSize) {
            const batch = await this.productRepo.find({
                where: { categoryId: (0, typeorm_2.IsNull)() },
                take: batchSize,
                skip: offset,
                order: { createdAt: 'DESC' },
            });
            const results = await Promise.allSettled(batch.map((product) => this.lookupAndUpdateProduct(product)));
            for (const result of results) {
                scanned++;
                if (result.status === 'fulfilled' && result.value) {
                    updated++;
                }
                else {
                    failed++;
                }
            }
            this.logger.log(`Backfill progress: ${scanned}/${total} scanned, ${updated} updated, ${failed} failed`);
        }
        this.logger.log(`Backfill complete: ${scanned} scanned, ${updated} updated, ${failed} failed`);
        return { scanned, updated, failed };
    }
    async backfillListingRecords(batchSize = 10, concurrency = 2) {
        const total = await this.listingRepo.count({
            where: { categoryId: (0, typeorm_2.IsNull)() },
        });
        if (total === 0) {
            this.logger.log('ListingRecord backfill: no records with missing categoryId');
            return { scanned: 0, updated: 0, failed: 0 };
        }
        this.logger.log(`ListingRecord backfill starting: ${total} records with missing categoryId`);
        let scanned = 0;
        let updated = 0;
        let failed = 0;
        for (let offset = 0; offset < total; offset += batchSize) {
            const batch = await this.listingRepo.find({
                where: { categoryId: (0, typeorm_2.IsNull)() },
                take: batchSize,
                skip: offset,
                order: { importedAt: 'DESC' },
            });
            const results = await Promise.allSettled(batch.map((rec) => this.lookupAndUpdateListingRecord(rec)));
            for (const result of results) {
                scanned++;
                if (result.status === 'fulfilled' && result.value) {
                    updated++;
                }
                else {
                    failed++;
                }
            }
        }
        this.logger.log(`ListingRecord backfill complete: ${scanned} scanned, ${updated} updated, ${failed} failed`);
        return { scanned, updated, failed };
    }
    async lookupAndUpdateListingRecord(rec) {
        if (rec.categoryName && !rec.categoryId) {
            const nameResult = await this.lookupByCategoryName(rec.categoryName, rec.marketplace);
            if (nameResult.categoryId) {
                await this.listingRepo.update(rec.id, {
                    categoryId: nameResult.categoryId,
                    categoryName: nameResult.categoryName,
                });
                return true;
            }
        }
        const result = await this.lookupCategory(rec.title, rec.cBrand, null, null, rec.marketplace);
        if (!result.categoryId)
            return false;
        await this.listingRepo.update(rec.id, {
            categoryId: result.categoryId,
            categoryName: result.categoryName,
        });
        return true;
    }
    async lookupByCategoryName(categoryName, marketplace) {
        const treeId = await this.resolveTreeId(marketplace);
        try {
            const suggestions = await this.taxonomy.getCategorySuggestions(categoryName, treeId);
            const exact = suggestions.find((s) => s.category.categoryName.toLowerCase() === categoryName.toLowerCase());
            if (exact?.category?.categoryId) {
                return {
                    categoryId: exact.category.categoryId,
                    categoryName: exact.category.categoryName,
                    confidence: 'high',
                };
            }
            const first = suggestions[0];
            if (first?.category?.categoryId) {
                return {
                    categoryId: first.category.categoryId,
                    categoryName: first.category.categoryName,
                    confidence: 'medium',
                };
            }
        }
        catch {
        }
        return { categoryId: null, categoryName: null, confidence: 'none' };
    }
    buildQuery(title, brand, partType, mpn) {
        const shortParts = [brand, partType].filter((s) => s && s.trim());
        if (shortParts.length >= 2) {
            return shortParts.join(' ').trim();
        }
        if (title) {
            const cleaned = title
                .replace(new RegExp(`\\b${brand ?? ''}\\b`, 'gi'), '')
                .replace(/\b(New|OEM|Genuine|Left|Right|Front|Rear|Driver|Passenger|Upper|Lower|Inner|Outer|Gray|Black|White|Assembly|Set|Pair)\b/gi, '')
                .replace(/\s+/g, ' ')
                .trim();
            const words = cleaned.split(' ').filter(Boolean);
            const keyTerms = words.slice(0, 5);
            if (keyTerms.length >= 2) {
                return [brand, ...keyTerms].filter(Boolean).join(' ').trim();
            }
        }
        const parts = [brand, partType, title].filter((s) => s && s.trim());
        if (parts.length === 0 && mpn)
            parts.push(mpn);
        return parts.join(' ').trim();
    }
    async resolveTreeId(marketplace) {
        if (!marketplace) {
            return ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService.EBAY_US_TREE_ID;
        }
        const mktToEbay = {
            US: 'EBAY_US',
            AU: 'EBAY_AU',
            DE: 'EBAY_DE',
            GB: 'EBAY_GB',
        };
        const ebayMkt = marketplace.includes('EBAY_')
            ? marketplace
            : (mktToEbay[marketplace] ?? 'EBAY_US');
        const cached = this.treeIdCache.get(ebayMkt);
        if (cached)
            return cached;
        const known = CategoryLookupService_1.KNOWN_TREE_IDS[ebayMkt];
        if (known) {
            this.treeIdCache.set(ebayMkt, known);
            return known;
        }
        try {
            const treeId = await this.taxonomy.getDefaultCategoryTreeId(ebayMkt);
            this.treeIdCache.set(ebayMkt, treeId);
            return treeId;
        }
        catch {
            return ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService.EBAY_US_TREE_ID;
        }
    }
};
exports.CategoryLookupService = CategoryLookupService;
exports.CategoryLookupService = CategoryLookupService = CategoryLookupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(2, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __metadata("design:paramtypes", [ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], CategoryLookupService);
//# sourceMappingURL=category-lookup.service.js.map