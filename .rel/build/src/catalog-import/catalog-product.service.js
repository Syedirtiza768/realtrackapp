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
var CatalogProductService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogProductService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const catalog_product_entity_js_1 = require("./entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const catalog_product_derivatives_js_1 = require("./utils/catalog-product-derivatives.js");
const catalog_product_list_query_js_1 = require("./utils/catalog-product-list-query.js");
const listing_guards_js_1 = require("../common/openai/listing-guards.js");
const storage_service_js_1 = require("../storage/storage.service.js");
const automotive_access_scope_service_js_1 = require("../auth/automotive-access-scope.service.js");
let CatalogProductService = CatalogProductService_1 = class CatalogProductService {
    productRepo;
    listingRepo;
    storageService;
    automotiveScope;
    logger = new common_1.Logger(CatalogProductService_1.name);
    constructor(productRepo, listingRepo, storageService, automotiveScope) {
        this.productRepo = productRepo;
        this.listingRepo = listingRepo;
        this.storageService = storageService;
        this.automotiveScope = automotiveScope;
    }
    async findAll(params, user) {
        const qb = this.productRepo.createQueryBuilder('p');
        const accessFilter = await this.automotiveScope.buildFilter(user, 'p');
        if (accessFilter)
            qb.andWhere(accessFilter.sql, accessFilter.params);
        (0, catalog_product_list_query_js_1.applyCatalogProductListFilters)(qb, params);
        qb.orderBy('p.createdAt', 'DESC').take(params.limit).skip(params.offset);
        const [products, total] = await qb.getManyAndCount();
        if (!params.includeDerived) {
            return { products, total };
        }
        const enriched = products.map((row) => ({
            ...row,
            derived: (0, catalog_product_derivatives_js_1.computeCatalogProductDerived)(row),
        }));
        return { products: enriched, total };
    }
    async findOne(id, user) {
        const qb = this.productRepo
            .createQueryBuilder('p')
            .where('p.id = :id', { id });
        const accessFilter = await this.automotiveScope.buildFilter(user, 'p');
        if (accessFilter)
            qb.andWhere(accessFilter.sql, accessFilter.params);
        const product = await qb.getOne();
        if (!product)
            throw new common_1.NotFoundException(`Catalog product ${id} not found`);
        return product;
    }
    async findBySku(sku, user) {
        const qb = this.productRepo
            .createQueryBuilder('p')
            .where('p.sku = :sku', { sku });
        const accessFilter = await this.automotiveScope.buildFilter(user, 'p');
        if (accessFilter)
            qb.andWhere(accessFilter.sql, accessFilter.params);
        return qb.getOne();
    }
    async findByIds(ids, user) {
        if (!ids.length)
            return [];
        const qb = this.productRepo
            .createQueryBuilder('p')
            .where('p.id IN (:...ids)', { ids });
        const accessFilter = await this.automotiveScope.buildFilter(user, 'p');
        if (accessFilter)
            qb.andWhere(accessFilter.sql, accessFilter.params);
        return qb.getMany();
    }
    async findByListingIds(listingIds, user) {
        if (!listingIds.length)
            return [];
        const listingQb = this.listingRepo
            .createQueryBuilder('r')
            .where('r.id IN (:...listingIds)', { listingIds });
        const listingAccess = await this.automotiveScope.buildFilter(user, 'r');
        if (listingAccess)
            listingQb.andWhere(listingAccess.sql, listingAccess.params);
        const listings = await listingQb.getMany();
        const skus = listings
            .map((l) => l.customLabelSku)
            .filter((s) => s != null && s !== '');
        if (!skus.length)
            return [];
        const productQb = this.productRepo
            .createQueryBuilder('p')
            .where('p.sku IN (:...skus)', { skus });
        const productAccess = await this.automotiveScope.buildFilter(user, 'p');
        if (productAccess)
            productQb.andWhere(productAccess.sql, productAccess.params);
        return productQb.getMany();
    }
    applyProfileOverrides(products, overrides) {
        const { shippingProfile, returnProfile, paymentProfile } = overrides;
        if (!shippingProfile && !returnProfile && !paymentProfile) {
            return products;
        }
        return products.map((p) => {
            const copy = { ...p };
            if (shippingProfile)
                copy.shippingProfile = shippingProfile;
            if (returnProfile)
                copy.returnProfile = returnProfile;
            if (paymentProfile)
                copy.paymentProfile = paymentProfile;
            return copy;
        });
    }
    async persistProfileOverridesForListings(listingIds, overrides, user) {
        const { shippingProfile, returnProfile, paymentProfile } = overrides;
        if (!shippingProfile && !returnProfile && !paymentProfile)
            return;
        const listingQb = this.listingRepo
            .createQueryBuilder('r')
            .where('r.id IN (:...listingIds)', { listingIds });
        const listingAccess = await this.automotiveScope.buildFilter(user, 'r');
        if (listingAccess)
            listingQb.andWhere(listingAccess.sql, listingAccess.params);
        const listings = await listingQb.getMany();
        const skus = [
            ...new Set(listings
                .map((l) => l.customLabelSku)
                .filter((s) => s != null && s !== '')),
        ];
        if (!skus.length)
            return;
        const products = await this.findBySkuList(skus, user);
        for (const product of products) {
            if (shippingProfile)
                product.shippingProfile = shippingProfile;
            if (returnProfile)
                product.returnProfile = returnProfile;
            if (paymentProfile)
                product.paymentProfile = paymentProfile;
            await this.update(product.id, {
                shippingProfile: product.shippingProfile ?? undefined,
                returnProfile: product.returnProfile ?? undefined,
                paymentProfile: product.paymentProfile ?? undefined,
            }, user);
        }
    }
    async update(id, dto, user) {
        const product = await this.findOne(id, user);
        if (dto.title !== undefined)
            product.title = dto.title;
        if (dto.description !== undefined)
            product.description = dto.description;
        if (dto.brand !== undefined) {
            product.brand = dto.brand;
            product.brandNormalized = dto.brand
                ? dto.brand.toLowerCase().trim()
                : null;
        }
        if (dto.mpn !== undefined) {
            product.mpn = dto.mpn;
            product.mpnNormalized = dto.mpn
                ? dto.mpn.toLowerCase().replace(/[\s\-]/g, '')
                : null;
        }
        if (dto.oemPartNumber !== undefined)
            product.oemPartNumber = dto.oemPartNumber;
        if (dto.partType !== undefined)
            product.partType = dto.partType;
        if (dto.placement !== undefined)
            product.placement = dto.placement;
        if (dto.material !== undefined)
            product.material = dto.material;
        if (dto.features !== undefined)
            product.features = dto.features;
        if (dto.countryOfOrigin !== undefined)
            product.countryOfOrigin = dto.countryOfOrigin;
        if (dto.price !== undefined)
            product.price = dto.price;
        if (dto.quantity !== undefined)
            product.quantity = dto.quantity;
        if (dto.conditionId !== undefined)
            product.conditionId = dto.conditionId;
        if (dto.conditionLabel !== undefined)
            product.conditionLabel = dto.conditionLabel;
        if (dto.categoryId !== undefined)
            product.categoryId = dto.categoryId;
        if (dto.categoryName !== undefined)
            product.categoryName = dto.categoryName;
        if (dto.imageUrls !== undefined) {
            product.imageUrls = await this.storageService.mirrorRemoteImageUrls(dto.imageUrls, `catalog-product/${product.id}`);
        }
        if (dto.location !== undefined)
            product.location = dto.location;
        if (dto.format !== undefined)
            product.format = dto.format;
        if (dto.duration !== undefined)
            product.duration = dto.duration;
        if (dto.shippingProfile !== undefined)
            product.shippingProfile = dto.shippingProfile;
        if (dto.returnProfile !== undefined)
            product.returnProfile = dto.returnProfile;
        if (dto.paymentProfile !== undefined)
            product.paymentProfile = dto.paymentProfile;
        if (dto.fitmentData !== undefined)
            product.fitmentData = dto.fitmentData;
        const saved = await this.productRepo.save(product);
        await this.syncToListingRecord(saved, dto, user);
        return saved;
    }
    async updateBySku(sku, dto, user) {
        const product = await this.findBySku(sku, user);
        if (!product)
            throw new common_1.NotFoundException(`Catalog product with SKU ${sku} not found`);
        return this.update(product.id, dto, user);
    }
    async syncToListingRecord(product, changed, user) {
        if (!product.sku)
            return;
        const listingQb = this.listingRepo
            .createQueryBuilder('r')
            .where('r.customLabelSku = :sku', { sku: product.sku });
        const listingAccess = await this.automotiveScope.buildFilter(user, 'r');
        if (listingAccess)
            listingQb.andWhere(listingAccess.sql, listingAccess.params);
        const listings = await listingQb.getMany();
        if (!listings.length)
            return;
        const patch = {};
        if (changed.title !== undefined)
            patch.title = product.title;
        if (changed.description !== undefined)
            patch.description = product.description;
        if (changed.price !== undefined) {
            patch.startPrice = product.price != null ? String(product.price) : null;
            patch.startPriceNum = product.price;
        }
        if (changed.quantity !== undefined) {
            patch.quantity =
                product.quantity != null ? String(product.quantity) : null;
            patch.quantityNum = product.quantity;
        }
        if (changed.imageUrls !== undefined) {
            patch.itemPhotoUrl = product.imageUrls?.length
                ? product.imageUrls.join('|')
                : null;
        }
        if (changed.conditionId !== undefined)
            patch.conditionId = product.conditionId;
        if (changed.conditionLabel !== undefined)
            patch.conditionLabel = product.conditionLabel;
        if (changed.categoryId !== undefined)
            patch.categoryId = product.categoryId;
        if (changed.categoryName !== undefined)
            patch.categoryName = product.categoryName;
        if (changed.format !== undefined)
            patch.format = product.format;
        if (changed.duration !== undefined)
            patch.duration = product.duration;
        if (changed.location !== undefined)
            patch.location = product.location;
        if (changed.shippingProfile !== undefined)
            patch.shippingProfileName = product.shippingProfile;
        if (changed.returnProfile !== undefined)
            patch.returnProfileName = product.returnProfile;
        if (changed.paymentProfile !== undefined)
            patch.paymentProfileName = product.paymentProfile;
        if (changed.brand !== undefined)
            patch.cBrand = product.brand;
        if (changed.partType !== undefined)
            patch.cType = product.partType;
        if (changed.features !== undefined)
            patch.cFeatures = product.features;
        if (changed.mpn !== undefined)
            patch.cManufacturerPartNumber = product.mpn;
        if (changed.oemPartNumber !== undefined)
            patch.cOeOemPartNumber = product.oemPartNumber;
        if (changed.material !== undefined)
            patch.cMaterial = product.material;
        if (changed.placement !== undefined)
            patch.cPlacement = product.placement;
        if (changed.countryOfOrigin !== undefined)
            patch.countryOfOrigin = product.countryOfOrigin;
        if (Object.keys(patch).length === 0)
            return;
        await this.listingRepo.update({ id: (0, typeorm_2.In)(listings.map((row) => row.id)) }, patch);
    }
    async findBySkuList(skus, user) {
        if (!skus.length)
            return [];
        const qb = this.productRepo
            .createQueryBuilder('p')
            .where('p.sku IN (:...skus)', { skus });
        const accessFilter = await this.automotiveScope.buildFilter(user, 'p');
        if (accessFilter)
            qb.andWhere(accessFilter.sql, accessFilter.params);
        return qb.getMany();
    }
    async bulkFixConditionMismatchTitles(pipelineJobId) {
        const runner = this.productRepo.manager.connection.createQueryRunner();
        await runner.connect();
        try {
            const conditionFilter = `
        AND (
          condition_label ~* '\\m(used|refurbished|salvage)\\M'
          OR condition_id IN ('3000','4000','5000','6000','7000','2000','2500')
          OR condition_id ~* '^(USED_|FOR_PARTS|SELLER_REFURB)'
        )`;
            const catalogResult = await runner.query(`
        UPDATE catalog_products
           SET title = trim(regexp_replace(regexp_replace(title, '\\mNew\\M', '', 'gi'), '\\s+', ' ', 'g')),
               "updatedAt" = NOW()
         WHERE pipeline_job_id = $1
           AND title ~* '\\mNew\\M'
           ${conditionFilter}
      `, [pipelineJobId]);
            const listingResult = await runner.query(`
        UPDATE listing_records
           SET title = trim(regexp_replace(regexp_replace(title, '\\mNew\\M', '', 'gi'), '\\s+', ' ', 'g')),
               "updatedAt" = NOW()
         WHERE pipeline_job_id = $1
           AND title ~* '\\mNew\\M'
           AND (
             condition_label ~* '\\m(used|refurbished|salvage)\\M'
             OR "conditionId" IN ('3000','4000','5000','6000','7000','2000','2500')
             OR "conditionId" ~* '^(USED_|FOR_PARTS|SELLER_REFURB)'
           )
      `, [pipelineJobId]);
            return {
                catalogUpdated: catalogResult[1] ?? 0,
                listingsUpdated: listingResult[1] ?? 0,
            };
        }
        finally {
            await runner.release();
        }
    }
    async bulkSanitizeTitles(pipelineJobId) {
        let catalogUpdated = 0;
        let listingsUpdated = 0;
        const products = await this.productRepo.find({
            where: { pipelineJobId },
            select: ['id', 'title'],
        });
        for (const p of products) {
            const cleaned = (0, listing_guards_js_1.sanitizeTitle)(p.title);
            if (cleaned !== p.title) {
                await this.productRepo.update(p.id, { title: cleaned });
                catalogUpdated++;
            }
        }
        const listings = await this.listingRepo.find({
            where: { pipelineJobId },
            select: ['id', 'title'],
        });
        for (const l of listings) {
            if (!l.title)
                continue;
            const cleaned = (0, listing_guards_js_1.sanitizeTitle)(l.title);
            if (cleaned !== l.title) {
                await this.listingRepo.update(l.id, { title: cleaned });
                listingsUpdated++;
            }
        }
        this.logger.log(`bulkSanitizeTitles(${pipelineJobId}): catalog=${catalogUpdated}, listings=${listingsUpdated}`);
        return { catalogUpdated, listingsUpdated };
    }
};
exports.CatalogProductService = CatalogProductService;
exports.CatalogProductService = CatalogProductService = CatalogProductService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(1, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        storage_service_js_1.StorageService,
        automotive_access_scope_service_js_1.AutomotiveAccessScopeService])
], CatalogProductService);
//# sourceMappingURL=catalog-product.service.js.map