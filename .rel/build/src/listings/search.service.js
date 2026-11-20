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
var SearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const listing_record_entity_1 = require("./listing-record.entity");
const store_access_service_js_1 = require("../channels/store-access.service.js");
const teams_service_js_1 = require("../teams/teams.service.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
const listing_vertical_filter_js_1 = require("./utils/listing-vertical-filter.js");
const automotive_access_scope_service_js_1 = require("../auth/automotive-access-scope.service.js");
class MemCache {
    store = new Map();
    maxSize = 200;
    get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.data;
    }
    set(key, data, ttlMs) {
        if (this.store.size >= this.maxSize) {
            const firstKey = this.store.keys().next().value;
            if (firstKey)
                this.store.delete(firstKey);
        }
        this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
    }
}
function splitFilter(val) {
    if (!val?.trim())
        return [];
    return val
        .split(',')
        .map((v) => v.trim().replace(/^[\s.]+|[\s.]+$/g, ''))
        .filter(Boolean);
}
const SAFE_PRICE = `NULLIF(REPLACE(r."startPrice", ',', '.'), '')::numeric`;
function escapeForLike(s) {
    return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
const PUBLISHED_SQL = `(
  r.status = 'published'
  OR r."publishedAt" IS NOT NULL
  OR (r."ebayListingId" IS NOT NULL AND r."ebayListingId" != '')
  OR (r."shopifyProductId" IS NOT NULL AND r."shopifyProductId" != '')
  OR EXISTS (
    SELECT 1 FROM listing_channel_instances lci
    WHERE lci.listing_id = r.id AND lci.sync_status = 'synced'
  )
  OR EXISTS (
    SELECT 1 FROM ebay_published_listings epl
    WHERE epl.sku = r."customLabelSku" AND epl.listing_status = 'active'
      AND r."ebayListingId" IS NOT NULL AND r."ebayListingId" != ''
  )
)`;
const HAS_IMAGE_SQL = `(r."itemPhotoUrl" IS NOT NULL AND r."itemPhotoUrl" != '')`;
const PUBLISH_BLOCKED_SQL = `EXISTS (
  SELECT 1
  FROM catalog_products cp
  WHERE cp.sku = r."customLabelSku"
    AND (cp.organization_id IS NULL OR cp.organization_id = r.organization_id)
    AND (cp.vertical IS NULL OR cp.vertical = 'automotive')
    AND (
      cp.manual_review = TRUE
      OR cp.vertical_validation_status IN (
        'needs_review', 'deleted', 'quarantined', 'blocked', 'rejected'
      )
    )
)`;
const SAFE_QTY = `COALESCE(
  r."quantityNum",
  NULLIF(REPLACE(r.quantity, ',', '.'), '')::numeric,
  0
)`;
const DEDUP_KEY = `CASE
  WHEN btrim(COALESCE(r."customLabelSku", '')) = '' THEN 'ID:' || r.id::text
  ELSE 'SKU:' || btrim(r."customLabelSku")
END`;
const DEDUP_PREF = `(r.marketplace = 'US') DESC,
  (NULLIF(r.title, '') IS NOT NULL) DESC,
  (NULLIF(r."itemPhotoUrl", '') IS NOT NULL) DESC,
  (NULLIF(r.marketplace, '') IS NOT NULL) DESC,
  (r.team_id IS NOT NULL) DESC,
  r.id ASC`;
function parseSkuMarketplaces(v) {
    if (!Array.isArray(v))
        return null;
    const cleaned = [
        ...new Set(v.filter((x) => typeof x === 'string' && x.trim() !== '')),
    ].sort();
    return cleaned.length ? cleaned : null;
}
function deriveCatalogStatus(row) {
    if (row.publishBlocked === true)
        return 'needs_review';
    const isPublished = row.status === 'published' ||
        row.publishedAt != null ||
        (row.ebayListingId != null && String(row.ebayListingId).trim() !== '') ||
        (row.shopifyProductId != null &&
            String(row.shopifyProductId).trim() !== '') ||
        row.hasChannelInstance === true ||
        row.hasEbayPublishedListing === true;
    if (isPublished)
        return 'published';
    const hasImage = row.itemPhotoUrl != null && String(row.itemPhotoUrl).trim() !== '';
    if (!hasImage)
        return 'need_images';
    return 'ready_to_publish';
}
let SearchService = SearchService_1 = class SearchService {
    repo;
    storeAccess;
    teamsService;
    rbac;
    automotiveScope;
    logger = new common_1.Logger(SearchService_1.name);
    facetCache = new MemCache();
    searchCache = new MemCache();
    constructor(repo, storeAccess, teamsService, rbac, automotiveScope) {
        this.repo = repo;
        this.storeAccess = storeAccess;
        this.teamsService = teamsService;
        this.rbac = rbac;
        this.automotiveScope = automotiveScope;
    }
    async search(dto, user) {
        const start = Date.now();
        const limit = Math.min(Number(dto.limit ?? 60), 500);
        const offset = Number(dto.offset ?? 0);
        const q = dto.q?.trim() || '';
        const hasQuery = q.length > 0;
        const qb = this.repo.createQueryBuilder('r');
        qb.leftJoin('teams', 'tm', 'tm.id = r.team_id');
        qb.where('r."deletedAt" IS NULL');
        qb.select([
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
            'r.description',
            'r.cFeatures',
            'r.pEpid',
            'r.pUpc',
            'r.marketplace',
            'r.pipelineJobId',
            'r.teamId',
            'r.status',
            'r.publishedAt',
            'r.ebayListingId',
            'r.shopifyProductId',
            'r.shippingProfileName',
        ]);
        qb.addSelect('tm.name', 'teamName');
        qb.addSelect('tm.color', 'teamColor');
        qb.addSelect(`(SELECT EXISTS(SELECT 1 FROM listing_channel_instances lci WHERE lci.listing_id = r.id AND lci.sync_status = 'synced'))`, 'hasChannelInstance');
        qb.addSelect(`(SELECT EXISTS(SELECT 1 FROM ebay_published_listings epl WHERE epl.sku = r."customLabelSku" AND epl.listing_status = 'active' AND r."ebayListingId" IS NOT NULL AND r."ebayListingId" != ''))`, 'hasEbayPublishedListing');
        qb.addSelect(PUBLISH_BLOCKED_SQL, 'publishBlocked');
        if (hasQuery) {
            const prefixTerms = q
                .replace(/[^\w\s-]/g, '')
                .split(/\s+/)
                .filter(Boolean)
                .map((t) => `${t}:*`)
                .join(' & ');
            qb.addSelect(`GREATEST(
          ts_rank_cd(COALESCE(r."searchVector", ''::tsvector), websearch_to_tsquery('english', :q), 32),
          ts_rank_cd(COALESCE(r."searchVector", ''::tsvector), to_tsquery('english', :prefixQ), 32)
        )`, 'relevanceScore');
            qb.addSelect(`ts_headline('english', COALESCE(r.title, ''),
          websearch_to_tsquery('english', :q),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20, MaxFragments=1')`, 'titleHighlight');
            qb.addSelect(`CASE WHEN LOWER(r."customLabelSku") = LOWER(:q) THEN 100
              WHEN LOWER(r."customLabelSku") LIKE LOWER(:qPrefix) THEN 50
              ELSE 0
         END`, 'skuBoost');
            const qContains = `%${escapeForLike(q)}%`;
            qb.andWhere(`(
          r."searchVector" @@ websearch_to_tsquery('english', :q)
          OR r."searchVector" @@ to_tsquery('english', :prefixQ)
          OR LOWER(r."customLabelSku") = LOWER(:q)
          OR LOWER(r."customLabelSku") LIKE LOWER(:qPrefix)
          OR COALESCE(similarity(COALESCE(r.title, ''), :q), 0) > 0.15
          OR COALESCE(similarity(COALESCE(r."customLabelSku", ''), :q), 0) > 0.3
          OR (
            r."searchVector" IS NULL AND (
              COALESCE(r.title, '') ILIKE :qContains ESCAPE '\\'
              OR COALESCE(r."cBrand", '') ILIKE :qContains ESCAPE '\\'
              OR COALESCE(r."customLabelSku", '') ILIKE :qContains ESCAPE '\\'
              OR COALESCE(r."cManufacturerPartNumber", '') ILIKE :qContains ESCAPE '\\'
            )
          )
        )`);
            qb.setParameters({
                q,
                prefixQ: prefixTerms || q,
                qPrefix: `${q}%`,
                qContains,
            });
        }
        if (dto.exactSku?.trim()) {
            qb.andWhere('LOWER(r."customLabelSku") = LOWER(:exactSku)', {
                exactSku: dto.exactSku.trim(),
            });
        }
        this.applyMultiFilters(qb, dto);
        this.applyExtendedFilters(qb, dto);
        if (dto.minPrice != null) {
            qb.andWhere(`${SAFE_PRICE} >= :minPrice`, { minPrice: dto.minPrice });
        }
        if (dto.maxPrice != null) {
            qb.andWhere(`${SAFE_PRICE} <= :maxPrice`, { maxPrice: dto.maxPrice });
        }
        if (dto.hasImage === '1') {
            qb.andWhere(`r."itemPhotoUrl" IS NOT NULL AND r."itemPhotoUrl" != ''`);
        }
        if (dto.hasPrice === '1') {
            qb.andWhere(`r."startPrice" IS NOT NULL AND r."startPrice" != ''`);
        }
        const accessFilter = await this.buildStoreFilterSql(user);
        if (accessFilter)
            qb.andWhere(accessFilter.sql, accessFilter.params);
        const verticalFilter = (0, listing_vertical_filter_js_1.listingVerticalFilter)(dto.vertical);
        if (verticalFilter)
            qb.andWhere(verticalFilter.sql, verticalFilter.params);
        await this.applyTeamScope(qb, dto, user);
        const sort = dto.sort ?? (hasQuery ? 'relevance' : 'newest');
        const groupBySku = dto.groupBySku === '1';
        let raw;
        let total;
        if (groupBySku) {
            qb.addSelect(`ROW_NUMBER() OVER (PARTITION BY ${DEDUP_KEY} ORDER BY ${DEDUP_PREF})`, 'rn');
            qb.addSelect(`array_agg(r.marketplace) OVER (PARTITION BY ${DEDUP_KEY})`, 'skuMarketplaces');
            if (hasQuery) {
                qb.addSelect(`similarity(r.title, :q)`, 'titleSim');
            }
            if (sort === 'stock_asc' || sort === 'stock_desc') {
                qb.addSelect(SAFE_QTY, 'sortQty');
            }
            const [innerSql, innerParams] = qb.getQueryAndParameters();
            const orderSql = this.buildDedupOrderSql(sort, hasQuery);
            const offIdx = innerParams.length + 1;
            const limIdx = innerParams.length + 2;
            const outerSql = `SELECT sub.*, COUNT(*) OVER() AS "totalCount" ` +
                `FROM (${innerSql}) sub ` +
                `WHERE sub."rn" = 1 ` +
                `ORDER BY ${orderSql} ` +
                `OFFSET $${offIdx} LIMIT $${limIdx}`;
            raw = await this.repo.query(outerSql, [...innerParams, offset, limit]);
            total = raw.length > 0 ? parseInt(raw[0].totalCount, 10) : 0;
        }
        else {
            switch (sort) {
                case 'relevance':
                    if (hasQuery) {
                        qb.orderBy('"skuBoost"', 'DESC');
                        qb.addOrderBy('"relevanceScore"', 'DESC');
                        qb.addOrderBy(`similarity(r.title, :q)`, 'DESC');
                    }
                    else {
                        qb.orderBy('r.importedAt', 'DESC');
                    }
                    break;
                case 'price_asc':
                    qb.orderBy(SAFE_PRICE, 'ASC', 'NULLS LAST');
                    break;
                case 'price_desc':
                    qb.orderBy(SAFE_PRICE, 'DESC', 'NULLS LAST');
                    break;
                case 'oldest':
                    qb.orderBy('r.importedAt', 'ASC');
                    break;
                case 'title_asc':
                    qb.orderBy('r.title', 'ASC', 'NULLS LAST');
                    break;
                case 'title_desc':
                    qb.orderBy('r.title', 'DESC', 'NULLS LAST');
                    break;
                case 'sku_asc':
                    qb.orderBy('r."customLabelSku"', 'ASC', 'NULLS LAST');
                    break;
                case 'sku_desc':
                    qb.orderBy('r."customLabelSku"', 'DESC', 'NULLS LAST');
                    break;
                case 'newest':
                default:
                    qb.orderBy('r.importedAt', 'DESC');
                    break;
            }
            qb.addOrderBy('r.id', 'ASC');
            qb.offset(offset).limit(limit);
            qb.addSelect('COUNT(*) OVER()', 'totalCount');
            raw = await qb.getRawMany();
            total = raw.length > 0 ? parseInt(raw[0].totalCount, 10) : 0;
        }
        const items = raw.map((row) => ({
            id: row.r_id,
            customLabelSku: row.r_customLabelSku ?? null,
            title: row.r_title ?? null,
            cBrand: row.r_cBrand ?? null,
            cType: row.r_cType ?? null,
            categoryId: row.r_categoryId ?? null,
            categoryName: row.r_categoryName ?? null,
            startPrice: row.r_startPrice ?? null,
            quantity: row.r_quantity ?? null,
            conditionId: row.r_conditionId ?? null,
            itemPhotoUrl: row.r_itemPhotoUrl ?? null,
            cManufacturerPartNumber: row.r_cManufacturerPartNumber ?? null,
            cOeOemPartNumber: row.r_cOeOemPartNumber ?? null,
            location: row.r_location ?? null,
            format: row.r_format ?? null,
            sourceFileName: row.r_sourceFileName ?? null,
            importedAt: String(row.r_importedAt ?? ''),
            description: row.r_description ?? null,
            cFeatures: row.r_cFeatures ?? null,
            pEpid: row.r_pEpid ?? null,
            pUpc: row.r_pUpc ?? null,
            marketplace: row.r_marketplace ?? null,
            marketplaces: parseSkuMarketplaces(row.skuMarketplaces),
            pipelineJobId: row.r_pipelineJobId ?? row.r_pipeline_job_id ?? null,
            teamId: row.r_teamId ?? row.r_team_id ?? null,
            teamName: row.teamName ?? null,
            teamColor: row.teamColor ?? null,
            shippingProfileName: row.r_shippingProfileName ?? null,
            ebayListingId: row.r_ebayListingId ?? null,
            publishBlocked: row.publishBlocked === true,
            catalogStatus: deriveCatalogStatus({
                status: row.r_status,
                publishedAt: row.r_publishedAt,
                ebayListingId: row.r_ebayListingId,
                shopifyProductId: row.r_shopifyProductId,
                itemPhotoUrl: row.r_itemPhotoUrl,
                hasChannelInstance: row.hasChannelInstance === true,
                hasEbayPublishedListing: row.hasEbayPublishedListing === true,
                publishBlocked: row.publishBlocked === true,
            }),
            relevanceScore: hasQuery ? parseFloat(row.relevanceScore ?? '0') : null,
            titleHighlight: hasQuery ? (row.titleHighlight ?? null) : null,
        }));
        const nextCursor = items.length === limit ? String(offset + limit) : null;
        return {
            total,
            limit,
            offset,
            nextCursor,
            queryTimeMs: Date.now() - start,
            items,
        };
    }
    async suggest(q, limitNum = 10, user) {
        const start = Date.now();
        const term = q.trim();
        if (!term)
            return { suggestions: [], queryTimeMs: 0 };
        const maxPerType = Math.ceil(limitNum / 3);
        const sf = await this.buildStoreFilterSql(user);
        const applyStoreFilter = (qb) => {
            if (sf)
                qb.andWhere(sf.sql, sf.params);
            return qb;
        };
        const suggestQb = () => applyStoreFilter(this.repo.createQueryBuilder('r'));
        const [skus, titles, brands, categories, mpns] = await Promise.all([
            suggestQb()
                .select('r."customLabelSku"', 'value')
                .addSelect('COUNT(*)', 'count')
                .addSelect(`similarity(r."customLabelSku", :q)`, 'score')
                .where(`(
          LOWER(r."customLabelSku") = LOWER(:q)
          OR LOWER(r."customLabelSku") LIKE LOWER(:prefix)
          OR similarity(r."customLabelSku", :q) > 0.25
        )`)
                .andWhere(`r."customLabelSku" IS NOT NULL AND r."customLabelSku" != ''`)
                .groupBy('r."customLabelSku"')
                .orderBy('score', 'DESC')
                .limit(maxPerType)
                .setParameters({ q: term, prefix: `${term}%` })
                .getRawMany(),
            suggestQb()
                .select('r.title', 'value')
                .addSelect('COUNT(*)', 'count')
                .addSelect(`MAX(ts_rank_cd(r."searchVector", websearch_to_tsquery('english', :q), 32))`, 'score')
                .where(`r."searchVector" @@ websearch_to_tsquery('english', :q)`)
                .andWhere(`r.title IS NOT NULL AND r.title != ''`)
                .groupBy('r.title')
                .orderBy('score', 'DESC')
                .limit(maxPerType)
                .setParameters({ q: term })
                .getRawMany(),
            suggestQb()
                .select('r."cBrand"', 'value')
                .addSelect('COUNT(*)', 'count')
                .addSelect(`similarity(r."cBrand", :q)`, 'score')
                .where(`(
          LOWER(r."cBrand") LIKE LOWER(:prefix)
          OR similarity(r."cBrand", :q) > 0.2
        )`)
                .andWhere(`r."cBrand" IS NOT NULL AND r."cBrand" != ''`)
                .groupBy('r."cBrand"')
                .orderBy('score', 'DESC')
                .limit(maxPerType)
                .setParameters({ q: term, prefix: `${term}%` })
                .getRawMany(),
            suggestQb()
                .select('r."categoryName"', 'value')
                .addSelect('r."categoryId"', 'id')
                .addSelect('COUNT(*)', 'count')
                .addSelect(`similarity(r."categoryName", :q)`, 'score')
                .where(`(
          LOWER(r."categoryName") LIKE LOWER(:anywhere)
          OR similarity(r."categoryName", :q) > 0.15
        )`)
                .andWhere(`r."categoryName" IS NOT NULL AND r."categoryName" != ''`)
                .groupBy('r."categoryName"')
                .addGroupBy('r."categoryId"')
                .orderBy('score', 'DESC')
                .limit(maxPerType)
                .setParameters({ q: term, anywhere: `%${term}%` })
                .getRawMany(),
            suggestQb()
                .select('r."cManufacturerPartNumber"', 'value')
                .addSelect('COUNT(*)', 'count')
                .addSelect(`similarity(r."cManufacturerPartNumber", :q)`, 'score')
                .where(`(
          LOWER(r."cManufacturerPartNumber") LIKE LOWER(:prefix)
          OR similarity(r."cManufacturerPartNumber", :q) > 0.3
        )`)
                .andWhere(`r."cManufacturerPartNumber" IS NOT NULL AND r."cManufacturerPartNumber" != ''`)
                .groupBy('r."cManufacturerPartNumber"')
                .orderBy('score', 'DESC')
                .limit(maxPerType)
                .setParameters({ q: term, prefix: `${term}%` })
                .getRawMany(),
        ]);
        const suggestions = [
            ...skus.map((r) => ({
                type: 'sku',
                value: r.value,
                label: `SKU: ${r.value}`,
                count: Number(r.count),
                score: parseFloat(r.score) + 10,
            })),
            ...brands.map((r) => ({
                type: 'brand',
                value: r.value,
                label: `Brand: ${r.value}`,
                count: Number(r.count),
                score: parseFloat(r.score) + 5,
            })),
            ...categories.map((r) => ({
                type: 'category',
                value: r.value,
                label: `Category: ${r.value}`,
                count: Number(r.count),
                score: parseFloat(r.score) + 3,
            })),
            ...mpns.map((r) => ({
                type: 'mpn',
                value: r.value,
                label: `MPN: ${r.value}`,
                count: Number(r.count),
                score: parseFloat(r.score) + 2,
            })),
            ...titles.map((r) => ({
                type: 'title',
                value: r.value,
                label: r.value,
                count: Number(r.count),
                score: parseFloat(r.score),
            })),
        ];
        suggestions.sort((a, b) => b.score - a.score);
        return {
            suggestions: suggestions.slice(0, limitNum),
            queryTimeMs: Date.now() - start,
        };
    }
    async dynamicFacets(dto, user) {
        const cacheKey = `facets:${user?.id ?? 'system'}:${JSON.stringify(dto)}`;
        const cached = this.facetCache.get(cacheKey);
        if (cached)
            return { ...cached, queryTimeMs: 0 };
        const start = Date.now();
        const q = dto.q?.trim() || '';
        const hasQuery = q.length > 0;
        const storeFilter = await this.buildStoreFilterSql(user);
        const verticalFilter = (0, listing_vertical_filter_js_1.listingVerticalFilter)(dto.vertical);
        const teamScopeIds = await this.resolveTeamScopeIds(dto, user);
        const buildBaseQb = () => {
            const base = this.repo.createQueryBuilder('r');
            base.where('r."deletedAt" IS NULL');
            if (hasQuery) {
                const prefixTerms = q
                    .replace(/[^\w\s-]/g, '')
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((t) => `${t}:*`)
                    .join(' & ');
                const qContains = `%${escapeForLike(q)}%`;
                base.andWhere(`(
            r."searchVector" @@ websearch_to_tsquery('english', :q)
            OR r."searchVector" @@ to_tsquery('english', :prefixQ)
            OR LOWER(r."customLabelSku") = LOWER(:q)
            OR LOWER(r."customLabelSku") LIKE LOWER(:qPrefix)
            OR (
              r."searchVector" IS NULL AND (
                COALESCE(r.title, '') ILIKE :qContains ESCAPE '\\'
                OR COALESCE(r."cBrand", '') ILIKE :qContains ESCAPE '\\'
                OR COALESCE(r."customLabelSku", '') ILIKE :qContains ESCAPE '\\'
                OR COALESCE(r."cManufacturerPartNumber", '') ILIKE :qContains ESCAPE '\\'
              )
            )
          )`);
                base.setParameters({
                    q,
                    prefixQ: prefixTerms || q,
                    qPrefix: `${q}%`,
                    qContains,
                });
            }
            if (dto.hasImage === '1') {
                base.andWhere(`r."itemPhotoUrl" IS NOT NULL AND r."itemPhotoUrl" != ''`);
            }
            if (dto.hasPrice === '1') {
                base.andWhere(`r."startPrice" IS NOT NULL AND r."startPrice" != ''`);
            }
            if (dto.minPrice != null) {
                base.andWhere(`${SAFE_PRICE} >= :minPrice`, { minPrice: dto.minPrice });
            }
            if (dto.maxPrice != null) {
                base.andWhere(`${SAFE_PRICE} <= :maxPrice`, { maxPrice: dto.maxPrice });
            }
            if (storeFilter)
                base.andWhere(storeFilter.sql, storeFilter.params);
            if (verticalFilter)
                base.andWhere(verticalFilter.sql, verticalFilter.params);
            if (teamScopeIds !== null) {
                if (teamScopeIds.length === 0) {
                    base.andWhere('1 = 0');
                }
                else {
                    base.andWhere('r.team_id IN (:...teamScopeIds)', { teamScopeIds });
                }
            }
            return base;
        };
        const buildFacetQb = (excludeDimension) => {
            const fb = buildBaseQb();
            const brandArr = splitFilter(dto.brands);
            const catArr = splitFilter(dto.categories);
            const condArr = splitFilter(dto.conditions);
            const typeArr = splitFilter(dto.types);
            const srcArr = splitFilter(dto.sourceFiles);
            if (excludeDimension !== 'brand' && brandArr.length) {
                fb.andWhere(`r."cBrand" IN (:...facetBrands)`, {
                    facetBrands: brandArr,
                });
            }
            if (excludeDimension !== 'category' && catArr.length) {
                fb.andWhere(`r."categoryId" IN (:...facetCats)`, { facetCats: catArr });
            }
            if (excludeDimension !== 'condition' && condArr.length) {
                fb.andWhere(`r."conditionId" IN (:...facetConds)`, {
                    facetConds: condArr,
                });
            }
            if (excludeDimension !== 'type' && typeArr.length) {
                fb.andWhere(`r."cType" IN (:...facetTypes)`, { facetTypes: typeArr });
            }
            if (excludeDimension !== 'sourceFile' && srcArr.length) {
                fb.andWhere(`r."sourceFileName" IN (:...facetSrc)`, {
                    facetSrc: srcArr,
                });
            }
            const fmtArr = splitFilter(dto.formats);
            if (excludeDimension !== 'format' && fmtArr.length) {
                fb.andWhere(`r.format IN (:...facetFmts)`, { facetFmts: fmtArr });
            }
            const locArr = splitFilter(dto.locations);
            if (excludeDimension !== 'location' && locArr.length) {
                fb.andWhere(`r.location IN (:...facetLocs)`, { facetLocs: locArr });
            }
            const mpnArr = splitFilter(dto.mpns);
            if (excludeDimension !== 'mpn' && mpnArr.length) {
                fb.andWhere(`r."cManufacturerPartNumber" IN (:...facetMpns)`, {
                    facetMpns: mpnArr,
                });
            }
            const makeArr = splitFilter(dto.makes);
            const modelArr = splitFilter(dto.models);
            if (excludeDimension !== 'make' && makeArr.length) {
                fb.andWhere(`r."extractedMake" IN (:...facetMakes)`, {
                    facetMakes: makeArr,
                });
            }
            if (excludeDimension !== 'model' && modelArr.length) {
                fb.andWhere(`r."extractedModel" IN (:...facetModels)`, {
                    facetModels: modelArr,
                });
            }
            const pjArr = splitFilter(dto.pipelineJobIds);
            const mktArr = splitFilter(dto.marketplaces);
            if (excludeDimension !== 'pipelineJob' && pjArr.length) {
                fb.andWhere(`r."pipeline_job_id" IN (:...facetPj)`, { facetPj: pjArr });
            }
            if (excludeDimension !== 'marketplace' && mktArr.length) {
                fb.andWhere(`r.marketplace IN (:...facetMkt)`, { facetMkt: mktArr });
            }
            const teamArr = splitFilter(dto.teamIds);
            if (excludeDimension !== 'team' && teamArr.length) {
                fb.andWhere(`r.team_id IN (:...facetTeamIds)`, {
                    facetTeamIds: teamArr,
                });
            }
            const shipArr = splitFilter(dto.shippingProfiles);
            if (excludeDimension !== 'shippingProfile' && shipArr.length) {
                fb.andWhere(`r."shippingProfileName" IN (:...facetShip)`, {
                    facetShip: shipArr,
                });
            }
            if (excludeDimension !== 'dateAdded') {
                if (dto.importedFrom?.trim()) {
                    fb.andWhere(`r."importedAt" >= :facetImportedFrom::timestamptz`, {
                        facetImportedFrom: dto.importedFrom.trim(),
                    });
                }
                if (dto.importedTo?.trim()) {
                    fb.andWhere(`r."importedAt" < :facetImportedTo::timestamptz`, {
                        facetImportedTo: dto.importedTo.trim(),
                    });
                }
            }
            const stockArr = splitFilter(dto.stockLevel);
            if (excludeDimension !== 'stockLevel' && stockArr.length) {
                const clauses = [];
                if (stockArr.includes('in_stock'))
                    clauses.push(`${SAFE_QTY} > 0`);
                if (stockArr.includes('out_of_stock'))
                    clauses.push(`${SAFE_QTY} <= 0`);
                if (stockArr.includes('low_stock')) {
                    clauses.push(`(${SAFE_QTY} > 0 AND ${SAFE_QTY} <= 2)`);
                }
                if (clauses.length)
                    fb.andWhere(`(${clauses.join(' OR ')})`);
            }
            const statusArr = splitFilter(dto.catalogStatus);
            if (excludeDimension !== 'catalogStatus' && statusArr.length) {
                const clauses = [];
                if (statusArr.includes('needs_review'))
                    clauses.push(PUBLISH_BLOCKED_SQL);
                if (statusArr.includes('published')) {
                    clauses.push(`(${PUBLISHED_SQL} AND NOT ${PUBLISH_BLOCKED_SQL})`);
                }
                if (statusArr.includes('need_images')) {
                    clauses.push(`(NOT ${PUBLISHED_SQL} AND NOT ${PUBLISH_BLOCKED_SQL} AND NOT ${HAS_IMAGE_SQL})`);
                }
                if (statusArr.includes('ready_to_publish')) {
                    clauses.push(`(NOT ${PUBLISHED_SQL} AND NOT ${PUBLISH_BLOCKED_SQL} AND ${HAS_IMAGE_SQL})`);
                }
                if (clauses.length)
                    fb.andWhere(`(${clauses.join(' OR ')})`);
            }
            return fb;
        };
        const [brandsRaw, catsRaw, condsRaw, typesRaw, srcRaw, formatsRaw, locationsRaw, mpnsRaw, makesRaw, modelsRaw, pipelineJobsRaw, marketplacesRaw, teamsRaw, shippingProfilesRaw, priceRaw, totalFiltered,] = await Promise.all([
            buildFacetQb('brand')
                .select('r."cBrand"', 'value')
                .addSelect('COUNT(*)', 'count')
                .andWhere(`r."cBrand" IS NOT NULL AND r."cBrand" != ''`)
                .groupBy('r."cBrand"')
                .orderBy('count', 'DESC')
                .limit(100)
                .getRawMany(),
            buildFacetQb('category')
                .select('r."categoryName"', 'value')
                .addSelect('r."categoryId"', 'id')
                .addSelect('COUNT(*)', 'count')
                .andWhere(`r."categoryName" IS NOT NULL AND r."categoryName" != ''`)
                .groupBy('r."categoryName"')
                .addGroupBy('r."categoryId"')
                .orderBy('count', 'DESC')
                .limit(100)
                .getRawMany(),
            buildFacetQb('condition')
                .select('r."conditionId"', 'value')
                .addSelect('COUNT(*)', 'count')
                .andWhere(`r."conditionId" IS NOT NULL AND r."conditionId" != ''`)
                .groupBy('r."conditionId"')
                .orderBy('count', 'DESC')
                .getRawMany(),
            buildFacetQb('type')
                .select('r."cType"', 'value')
                .addSelect('COUNT(*)', 'count')
                .andWhere(`r."cType" IS NOT NULL AND r."cType" != ''`)
                .groupBy('r."cType"')
                .orderBy('count', 'DESC')
                .limit(100)
                .getRawMany(),
            buildFacetQb('sourceFile')
                .select('r."sourceFileName"', 'value')
                .addSelect('COUNT(*)', 'count')
                .groupBy('r."sourceFileName"')
                .orderBy('count', 'DESC')
                .getRawMany(),
            buildFacetQb('format')
                .select('r.format', 'value')
                .addSelect('COUNT(*)', 'count')
                .andWhere(`r.format IS NOT NULL AND r.format != ''`)
                .groupBy('r.format')
                .orderBy('count', 'DESC')
                .getRawMany(),
            buildFacetQb('location')
                .select('r.location', 'value')
                .addSelect('COUNT(*)', 'count')
                .andWhere(`r.location IS NOT NULL AND r.location != ''`)
                .groupBy('r.location')
                .orderBy('count', 'DESC')
                .limit(50)
                .getRawMany(),
            buildFacetQb('mpn')
                .select('r."cManufacturerPartNumber"', 'value')
                .addSelect('COUNT(*)', 'count')
                .andWhere(`r."cManufacturerPartNumber" IS NOT NULL AND r."cManufacturerPartNumber" != ''`)
                .groupBy('r."cManufacturerPartNumber"')
                .orderBy('count', 'DESC')
                .limit(50)
                .getRawMany(),
            buildFacetQb('make')
                .select('r."extractedMake"', 'value')
                .addSelect('COUNT(*)', 'count')
                .andWhere(`r."extractedMake" IS NOT NULL AND r."extractedMake" != ''`)
                .groupBy('r."extractedMake"')
                .orderBy('count', 'DESC')
                .limit(100)
                .getRawMany(),
            buildFacetQb('model')
                .select('r."extractedModel"', 'value')
                .addSelect('COUNT(*)', 'count')
                .andWhere(`r."extractedModel" IS NOT NULL AND r."extractedModel" != ''`)
                .groupBy('r."extractedModel"')
                .orderBy('count', 'DESC')
                .limit(100)
                .getRawMany(),
            buildFacetQb('pipelineJob')
                .select('r."pipeline_job_id"', 'value')
                .addSelect('COUNT(*)', 'count')
                .andWhere(`r."pipeline_job_id" IS NOT NULL`)
                .groupBy('r."pipeline_job_id"')
                .orderBy('count', 'DESC')
                .limit(50)
                .getRawMany(),
            buildFacetQb('marketplace')
                .select('r.marketplace', 'value')
                .addSelect('COUNT(*)', 'count')
                .andWhere(`r.marketplace IS NOT NULL AND r.marketplace != ''`)
                .groupBy('r.marketplace')
                .orderBy('count', 'DESC')
                .getRawMany(),
            buildFacetQb('team')
                .innerJoin('teams', 'tm', 'tm.id = r.team_id')
                .select('r.team_id', 'value')
                .addSelect('tm.name', 'label')
                .addSelect('tm.color', 'color')
                .addSelect('COUNT(*)', 'count')
                .andWhere(`r.team_id IS NOT NULL`)
                .groupBy('r.team_id')
                .addGroupBy('tm.name')
                .addGroupBy('tm.color')
                .orderBy('count', 'DESC')
                .limit(50)
                .getRawMany(),
            buildFacetQb('shippingProfile')
                .select('r."shippingProfileName"', 'value')
                .addSelect('COUNT(*)', 'count')
                .andWhere(`r."shippingProfileName" IS NOT NULL AND r."shippingProfileName" != ''`)
                .groupBy('r."shippingProfileName"')
                .orderBy('count', 'DESC')
                .limit(50)
                .getRawMany(),
            (() => {
                const pqb = buildBaseQb();
                this.applyMultiFilters(pqb, dto);
                this.applyExtendedFilters(pqb, dto);
                return pqb
                    .select(`MIN(${SAFE_PRICE})`, 'min')
                    .addSelect(`MAX(${SAFE_PRICE})`, 'max')
                    .getRawOne();
            })(),
            (() => {
                const cqb = buildBaseQb();
                this.applyMultiFilters(cqb, dto);
                this.applyExtendedFilters(cqb, dto);
                return cqb.getCount();
            })(),
        ]);
        const result = {
            brands: brandsRaw.map((r) => ({
                value: r.value,
                count: Number(r.count),
            })),
            categories: catsRaw.map((r) => ({
                value: r.value,
                id: r.id,
                count: Number(r.count),
            })),
            conditions: condsRaw.map((r) => ({
                value: r.value,
                count: Number(r.count),
            })),
            types: typesRaw.map((r) => ({ value: r.value, count: Number(r.count) })),
            sourceFiles: srcRaw.map((r) => ({
                value: r.value,
                count: Number(r.count),
            })),
            formats: formatsRaw.map((r) => ({
                value: r.value,
                count: Number(r.count),
            })),
            locations: locationsRaw.map((r) => ({
                value: r.value,
                count: Number(r.count),
            })),
            mpns: mpnsRaw.map((r) => ({ value: r.value, count: Number(r.count) })),
            makes: makesRaw.map((r) => ({ value: r.value, count: Number(r.count) })),
            models: modelsRaw.map((r) => ({
                value: r.value,
                count: Number(r.count),
            })),
            pipelineJobs: pipelineJobsRaw.map((r) => ({
                value: r.value,
                count: Number(r.count),
            })),
            marketplaces: marketplacesRaw.map((r) => ({
                value: r.value,
                count: Number(r.count),
            })),
            teams: teamsRaw.map((r) => ({
                value: r.value,
                label: r.label,
                color: r.color,
                count: Number(r.count),
            })),
            shippingProfiles: shippingProfilesRaw.map((r) => ({
                value: r.value,
                count: Number(r.count),
            })),
            priceRange: {
                min: priceRaw?.min != null ? parseFloat(priceRaw.min) : null,
                max: priceRaw?.max != null ? parseFloat(priceRaw.max) : null,
            },
            totalFiltered,
            queryTimeMs: Date.now() - start,
        };
        this.facetCache.set(cacheKey, result, 30_000);
        return result;
    }
    async buildStoreFilterSql(user) {
        const accessFilter = await this.automotiveScope.buildFilter(user, 'r');
        const storeIds = await this.storeAccess.resolveStoreFilter(user);
        if (storeIds === undefined)
            return accessFilter;
        if (storeIds.length === 0) {
            return {
                sql: accessFilter
                    ? `(${accessFilter.sql}) AND (${store_access_service_js_1.StoreAccessService.UNSCOPED_LISTINGS_SQL})`
                    : store_access_service_js_1.StoreAccessService.UNSCOPED_LISTINGS_SQL,
                params: accessFilter?.params ?? {},
            };
        }
        return {
            sql: accessFilter
                ? `(${accessFilter.sql}) AND (${store_access_service_js_1.StoreAccessService.SCOPED_LISTINGS_SQL})`
                : store_access_service_js_1.StoreAccessService.SCOPED_LISTINGS_SQL,
            params: { ...(accessFilter?.params ?? {}), storeIds },
        };
    }
    applyMultiFilters(qb, dto) {
        const brandArr = splitFilter(dto.brands);
        const catArr = splitFilter(dto.categories);
        const condArr = splitFilter(dto.conditions);
        const typeArr = splitFilter(dto.types);
        const srcArr = splitFilter(dto.sourceFiles);
        const catNameArr = splitFilter(dto.categoryNames);
        const fmtArr = splitFilter(dto.formats);
        const locArr = splitFilter(dto.locations);
        const mpnArr = splitFilter(dto.mpns);
        if (brandArr.length) {
            qb.andWhere(`r."cBrand" IN (:...brands)`, { brands: brandArr });
        }
        if (catArr.length) {
            qb.andWhere(`r."categoryId" IN (:...cats)`, { cats: catArr });
        }
        if (catNameArr.length) {
            qb.andWhere(`r."categoryName" IN (:...catNames)`, {
                catNames: catNameArr,
            });
        }
        if (condArr.length) {
            qb.andWhere(`r."conditionId" IN (:...conds)`, { conds: condArr });
        }
        if (typeArr.length) {
            qb.andWhere(`r."cType" IN (:...types)`, { types: typeArr });
        }
        if (srcArr.length) {
            qb.andWhere(`r."sourceFileName" IN (:...srcs)`, { srcs: srcArr });
        }
        if (fmtArr.length) {
            qb.andWhere(`r.format IN (:...fmts)`, { fmts: fmtArr });
        }
        if (locArr.length) {
            qb.andWhere(`r.location IN (:...locs)`, { locs: locArr });
        }
        if (mpnArr.length) {
            qb.andWhere(`r."cManufacturerPartNumber" IN (:...mpns)`, {
                mpns: mpnArr,
            });
        }
        const pjArr = splitFilter(dto.pipelineJobIds);
        const mktArr = splitFilter(dto.marketplaces);
        if (pjArr.length) {
            qb.andWhere(`r."pipeline_job_id" IN (:...pipelineJobIds)`, {
                pipelineJobIds: pjArr,
            });
        }
        if (mktArr.length) {
            qb.andWhere(`r.marketplace IN (:...marketplaces)`, {
                marketplaces: mktArr,
            });
        }
        const makeArr = splitFilter(dto.makes);
        const modelArr = splitFilter(dto.models);
        if (makeArr.length) {
            qb.andWhere(`r."extractedMake" IN (:...makes)`, { makes: makeArr });
        }
        if (modelArr.length) {
            qb.andWhere(`r."extractedModel" IN (:...models)`, { models: modelArr });
        }
    }
    applyExtendedFilters(qb, dto) {
        const shipArr = splitFilter(dto.shippingProfiles);
        if (shipArr.length) {
            qb.andWhere(`r."shippingProfileName" IN (:...shippingProfiles)`, {
                shippingProfiles: shipArr,
            });
        }
        if (dto.importedFrom?.trim()) {
            qb.andWhere(`r."importedAt" >= :importedFrom::timestamptz`, {
                importedFrom: dto.importedFrom.trim(),
            });
        }
        if (dto.importedTo?.trim()) {
            qb.andWhere(`r."importedAt" < :importedTo::timestamptz`, {
                importedTo: dto.importedTo.trim(),
            });
        }
        const stockArr = splitFilter(dto.stockLevel);
        if (stockArr.length) {
            const clauses = [];
            if (stockArr.includes('in_stock')) {
                clauses.push(`${SAFE_QTY} > 0`);
            }
            if (stockArr.includes('out_of_stock')) {
                clauses.push(`${SAFE_QTY} <= 0`);
            }
            if (stockArr.includes('low_stock')) {
                clauses.push(`(${SAFE_QTY} > 0 AND ${SAFE_QTY} <= 2)`);
            }
            if (clauses.length) {
                qb.andWhere(`(${clauses.join(' OR ')})`);
            }
        }
        const statusArr = splitFilter(dto.catalogStatus);
        if (statusArr.length) {
            const clauses = [];
            if (statusArr.includes('needs_review')) {
                clauses.push(PUBLISH_BLOCKED_SQL);
            }
            if (statusArr.includes('published')) {
                clauses.push(`(${PUBLISHED_SQL} AND NOT ${PUBLISH_BLOCKED_SQL})`);
            }
            if (statusArr.includes('need_images')) {
                clauses.push(`(NOT ${PUBLISHED_SQL} AND NOT ${PUBLISH_BLOCKED_SQL} AND NOT ${HAS_IMAGE_SQL})`);
            }
            if (statusArr.includes('ready_to_publish')) {
                clauses.push(`(NOT ${PUBLISHED_SQL} AND NOT ${PUBLISH_BLOCKED_SQL} AND ${HAS_IMAGE_SQL})`);
            }
            if (clauses.length) {
                qb.andWhere(`(${clauses.join(' OR ')})`);
            }
        }
    }
    buildDedupOrderSql(sort, hasQuery) {
        const price = `NULLIF(REPLACE(sub."r_startPrice", ',', '.'), '')::numeric`;
        const tie = `sub."r_id" ASC`;
        const hasImage = `(COALESCE(btrim(sub."r_itemPhotoUrl"), '') <> '')`;
        const hasEbay = `(COALESCE(btrim(sub."r_ebayListingId"), '') <> '')`;
        const isPublished = `(
      sub."r_status" = 'published'
      OR sub."r_publishedAt" IS NOT NULL
      OR ${hasEbay}
      OR COALESCE(btrim(sub."r_shopifyProductId"), '') <> ''
      OR sub."hasChannelInstance"
      OR sub."hasEbayPublishedListing"
    )`;
        const statusRank = `(CASE WHEN sub."publishBlocked" IS TRUE THEN 3 WHEN ${isPublished} THEN 2 WHEN ${hasImage} THEN 1 ELSE 0 END)`;
        switch (sort) {
            case 'relevance':
                return hasQuery
                    ? `sub."skuBoost" DESC, sub."relevanceScore" DESC, sub."titleSim" DESC, ${tie}`
                    : `sub."r_importedAt" DESC, ${tie}`;
            case 'price_asc':
                return `${price} ASC NULLS LAST, ${tie}`;
            case 'price_desc':
                return `${price} DESC NULLS LAST, ${tie}`;
            case 'title_asc':
                return `sub."r_title" ASC NULLS LAST, ${tie}`;
            case 'title_desc':
                return `sub."r_title" DESC NULLS LAST, ${tie}`;
            case 'sku_asc':
                return `sub."r_customLabelSku" ASC NULLS LAST, ${tie}`;
            case 'sku_desc':
                return `sub."r_customLabelSku" DESC NULLS LAST, ${tie}`;
            case 'oldest':
                return `sub."r_importedAt" ASC, ${tie}`;
            case 'team_asc':
                return `sub."teamName" ASC NULLS LAST, ${tie}`;
            case 'team_desc':
                return `sub."teamName" DESC NULLS LAST, ${tie}`;
            case 'condition_asc':
                return `NULLIF(btrim(sub."r_conditionId"), '') ASC NULLS LAST, ${tie}`;
            case 'condition_desc':
                return `NULLIF(btrim(sub."r_conditionId"), '') DESC NULLS LAST, ${tie}`;
            case 'stock_asc':
                return `sub."sortQty" ASC, ${tie}`;
            case 'stock_desc':
                return `sub."sortQty" DESC, ${tie}`;
            case 'status_asc':
                return `${statusRank} ASC, ${tie}`;
            case 'status_desc':
                return `${statusRank} DESC, ${tie}`;
            case 'ebay_asc':
                return `${hasEbay} ASC, ${tie}`;
            case 'ebay_desc':
                return `${hasEbay} DESC, ${tie}`;
            case 'image_asc':
                return `${hasImage} ASC, ${tie}`;
            case 'image_desc':
                return `${hasImage} DESC, ${tie}`;
            case 'newest':
            default:
                return `sub."r_importedAt" DESC, ${tie}`;
        }
    }
    async resolveTeamScopeIds(dto, user) {
        if (!user)
            return null;
        const manageAll = await this.rbac.userHasPermission(user.id, 'teams.manage');
        const requested = splitFilter(dto.teamIds);
        if (manageAll) {
            return requested.length ? requested : null;
        }
        const userTeams = await this.teamsService.getUserTeamIds(user.id);
        if (requested.length) {
            return requested.filter((id) => userTeams.includes(id));
        }
        return userTeams;
    }
    async applyTeamScope(qb, dto, user) {
        const scope = await this.resolveTeamScopeIds(dto, user);
        if (scope === null)
            return;
        if (scope.length === 0) {
            qb.andWhere('1 = 0');
            return;
        }
        qb.andWhere('r.team_id IN (:...teamScopeIds)', { teamScopeIds: scope });
    }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = SearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(listing_record_entity_1.ListingRecord)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        store_access_service_js_1.StoreAccessService,
        teams_service_js_1.TeamsService,
        rbac_service_js_1.RbacService,
        automotive_access_scope_service_js_1.AutomotiveAccessScopeService])
], SearchService);
//# sourceMappingURL=search.service.js.map