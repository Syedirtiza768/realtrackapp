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
var DuplicateDetectionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuplicateDetectionService = exports.UPC_OUTSIDE_SCOPE_STRATEGY = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const catalog_product_entity_js_1 = require("../entities/catalog-product.entity.js");
const catalog_identifiers_js_1 = require("../utils/catalog-identifiers.js");
exports.UPC_OUTSIDE_SCOPE_STRATEGY = 'upc_outside_scope';
let DuplicateDetectionService = DuplicateDetectionService_1 = class DuplicateDetectionService {
    productRepo;
    logger = new common_1.Logger(DuplicateDetectionService_1.name);
    constructor(productRepo) {
        this.productRepo = productRepo;
    }
    async checkDuplicate(product) {
        if (product.sku) {
            const match = await this.productRepo.findOne({
                where: { sku: product.sku },
                select: ['id'],
            });
            if (match) {
                return {
                    isDuplicate: true,
                    isPartialMatch: false,
                    matchStrategy: 'sku',
                    matchedProductId: match.id,
                    confidence: 1.0,
                };
            }
        }
        if (product.mpn) {
            const normalized = this.normalizeMpn(product.mpn);
            const match = await this.productRepo.findOne({
                where: { mpnNormalized: normalized },
                select: ['id'],
            });
            if (match) {
                return {
                    isDuplicate: true,
                    isPartialMatch: false,
                    matchStrategy: 'mpn',
                    matchedProductId: match.id,
                    confidence: 0.95,
                };
            }
        }
        if (product.ebayItemId) {
            const match = await this.productRepo.findOne({
                where: { ebayItemId: product.ebayItemId },
                select: ['id'],
            });
            if (match) {
                return {
                    isDuplicate: true,
                    isPartialMatch: false,
                    matchStrategy: 'ebay_item_id',
                    matchedProductId: match.id,
                    confidence: 1.0,
                };
            }
        }
        const upc = (0, catalog_identifiers_js_1.normalizeCatalogUpc)(product.upc);
        if (upc) {
            const match = await this.productRepo.findOne({
                where: { upc },
                select: ['id'],
            });
            if (match) {
                return {
                    isDuplicate: true,
                    isPartialMatch: false,
                    matchStrategy: 'upc',
                    matchedProductId: match.id,
                    confidence: 1.0,
                };
            }
        }
        if (product.brand && product.mpn) {
            const brandNorm = this.normalizeBrand(product.brand);
            const mpnNorm = this.normalizeMpn(product.mpn);
            const match = await this.productRepo.findOne({
                where: { brandNormalized: brandNorm, mpnNormalized: mpnNorm },
                select: ['id'],
            });
            if (match) {
                return {
                    isDuplicate: true,
                    isPartialMatch: false,
                    matchStrategy: 'brand_mpn',
                    matchedProductId: match.id,
                    confidence: 0.9,
                };
            }
        }
        if (product.title) {
            const titleNorm = this.normalizeTitle(product.title);
            const match = await this.productRepo.findOne({
                where: { titleNormalized: titleNorm },
                select: ['id'],
            });
            if (match) {
                return {
                    isDuplicate: false,
                    isPartialMatch: true,
                    matchStrategy: 'title_normalized',
                    matchedProductId: match.id,
                    confidence: 0.7,
                };
            }
        }
        return {
            isDuplicate: false,
            isPartialMatch: false,
            matchStrategy: null,
            matchedProductId: null,
            confidence: 0,
        };
    }
    async checkDuplicateBatch(products, scope) {
        const results = new Map();
        const upcEntries = products.filter((p) => (0, catalog_identifiers_js_1.normalizeCatalogUpc)(p.upc));
        if (upcEntries.length > 0) {
            const upcs = [
                ...new Set(upcEntries.map((p) => (0, catalog_identifiers_js_1.normalizeCatalogUpc)(p.upc))),
            ];
            const existingByUpc = await this.productRepo
                .createQueryBuilder('p')
                .select(['p.id', 'p.upc', 'p.organizationId', 'p.vertical'])
                .where('p.upc IN (:...upcs)', { upcs })
                .getMany();
            const upcMap = new Map(existingByUpc.map((p) => [p.upc, p]));
            for (const entry of upcEntries) {
                const match = upcMap.get((0, catalog_identifiers_js_1.normalizeCatalogUpc)(entry.upc));
                if (!match)
                    continue;
                results.set(entry.index, this.isInScope(match, scope)
                    ? {
                        isDuplicate: true,
                        isPartialMatch: false,
                        matchStrategy: 'upc',
                        matchedProductId: match.id,
                        confidence: 1.0,
                    }
                    : {
                        isDuplicate: false,
                        isPartialMatch: false,
                        matchStrategy: exports.UPC_OUTSIDE_SCOPE_STRATEGY,
                        matchedProductId: match.id,
                        confidence: 1.0,
                    });
            }
        }
        const skuEntries = products.filter((p) => p.sku && !results.has(p.index));
        if (skuEntries.length > 0) {
            const skus = skuEntries.map((p) => p.sku);
            const existingBySkuQuery = this.productRepo
                .createQueryBuilder('p')
                .select(['p.id', 'p.sku'])
                .where('p.sku IN (:...skus)', { skus });
            if (scope?.organizationId)
                existingBySkuQuery.andWhere('p.organization_id = :scopeOrganizationId', { scopeOrganizationId: scope.organizationId });
            if (scope?.vertical)
                existingBySkuQuery.andWhere(scope.vertical === 'automotive'
                    ? '(p.vertical = :scopeVertical OR p.vertical IS NULL)'
                    : 'p.vertical = :scopeVertical', { scopeVertical: scope.vertical });
            const existingBySku = await existingBySkuQuery.getMany();
            const skuMap = new Map(existingBySku.map((p) => [p.sku, p.id]));
            for (const entry of skuEntries) {
                if (skuMap.has(entry.sku)) {
                    results.set(entry.index, {
                        isDuplicate: true,
                        isPartialMatch: false,
                        matchStrategy: 'sku',
                        matchedProductId: skuMap.get(entry.sku),
                        confidence: 1.0,
                    });
                }
            }
        }
        const mpnEntries = products.filter((p) => p.mpn && !results.has(p.index));
        if (mpnEntries.length > 0) {
            const mpns = mpnEntries.map((p) => this.normalizeMpn(p.mpn));
            const existingByMpnQuery = this.productRepo
                .createQueryBuilder('p')
                .select(['p.id', 'p.mpnNormalized'])
                .where('p.mpn_normalized IN (:...mpns)', { mpns });
            if (scope?.organizationId)
                existingByMpnQuery.andWhere('p.organization_id = :scopeOrganizationId', { scopeOrganizationId: scope.organizationId });
            if (scope?.vertical)
                existingByMpnQuery.andWhere(scope.vertical === 'automotive'
                    ? '(p.vertical = :scopeVertical OR p.vertical IS NULL)'
                    : 'p.vertical = :scopeVertical', { scopeVertical: scope.vertical });
            const existingByMpn = await existingByMpnQuery.getMany();
            const mpnMap = new Map(existingByMpn.map((p) => [p.mpnNormalized, p.id]));
            for (const entry of mpnEntries) {
                const norm = this.normalizeMpn(entry.mpn);
                if (mpnMap.has(norm)) {
                    results.set(entry.index, {
                        isDuplicate: true,
                        isPartialMatch: false,
                        matchStrategy: 'mpn',
                        matchedProductId: mpnMap.get(norm),
                        confidence: 0.95,
                    });
                }
            }
        }
        const titleEntries = products.filter((p) => p.title && !results.has(p.index));
        if (titleEntries.length > 0) {
            const titles = titleEntries.map((p) => this.normalizeTitle(p.title));
            const existingByTitleQuery = this.productRepo
                .createQueryBuilder('p')
                .select(['p.id', 'p.titleNormalized'])
                .where('p.title_normalized IN (:...titles)', { titles });
            if (scope?.organizationId)
                existingByTitleQuery.andWhere('p.organization_id = :scopeOrganizationId', { scopeOrganizationId: scope.organizationId });
            if (scope?.vertical)
                existingByTitleQuery.andWhere(scope.vertical === 'automotive'
                    ? '(p.vertical = :scopeVertical OR p.vertical IS NULL)'
                    : 'p.vertical = :scopeVertical', { scopeVertical: scope.vertical });
            const existingByTitle = await existingByTitleQuery.getMany();
            const titleMap = new Map(existingByTitle.map((p) => [p.titleNormalized, p.id]));
            for (const entry of titleEntries) {
                const norm = this.normalizeTitle(entry.title);
                if (titleMap.has(norm)) {
                    results.set(entry.index, {
                        isDuplicate: false,
                        isPartialMatch: true,
                        matchStrategy: 'title_normalized',
                        matchedProductId: titleMap.get(norm),
                        confidence: 0.7,
                    });
                }
            }
        }
        return results;
    }
    isInScope(product, scope) {
        if (scope?.organizationId && product.organizationId !== scope.organizationId)
            return false;
        if (scope?.vertical) {
            if (scope.vertical === 'automotive')
                return product.vertical === 'automotive' || product.vertical == null;
            return product.vertical === scope.vertical;
        }
        return true;
    }
    normalizeMpn(mpn) {
        return mpn
            .toUpperCase()
            .replace(/[\s\-_.\/\\]+/g, '')
            .trim();
    }
    normalizeBrand(brand) {
        return brand
            .toUpperCase()
            .replace(/[\s\-_.]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    normalizeTitle(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
};
exports.DuplicateDetectionService = DuplicateDetectionService;
exports.DuplicateDetectionService = DuplicateDetectionService = DuplicateDetectionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], DuplicateDetectionService);
//# sourceMappingURL=duplicate-detection.service.js.map