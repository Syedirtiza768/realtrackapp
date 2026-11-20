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
var InventoryWorkbenchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryWorkbenchService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const vin_decode_service_js_1 = require("../fitment/vin-decode.service.js");
const image_asset_entity_js_1 = require("../storage/entities/image-asset.entity.js");
const storage_service_js_1 = require("../storage/storage.service.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const part_fitment_entity_js_1 = require("../fitment/entities/part-fitment.entity.js");
const pipeline_job_entity_js_1 = require("../ingestion/entities/pipeline-job.entity.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const store_entity_js_1 = require("../channels/entities/store.entity.js");
const ebay_listing_channel_entity_js_1 = require("../integrations/ebay/entities/ebay-listing-channel.entity.js");
const single_listing_form_service_js_1 = require("../ingestion/services/single-listing-form.service.js");
const pipeline_service_js_1 = require("../ingestion/pipeline.service.js");
const inventory_auto_trigger_service_js_1 = require("./inventory-auto-trigger.service.js");
const enrichment_retry_service_js_1 = require("./enrichment-retry.service.js");
const fitment_discovery_service_js_1 = require("../listing-optimization/fitment-discovery.service.js");
const listing_generation_pipeline_js_1 = require("../common/openai/pipelines/listing-generation.pipeline.js");
const enrichment_pipeline_js_1 = require("../common/openai/pipelines/enrichment.pipeline.js");
const model_router_js_1 = require("../common/openai/model-router.js");
const ebay_taxonomy_api_service_js_1 = require("../channels/ebay/ebay-taxonomy-api.service.js");
const part_identification_service_js_1 = require("./part-identification.service.js");
const ebay_listing_text_util_js_1 = require("../channels/ebay/ebay-listing-text.util.js");
const platform_generation_util_js_1 = require("../fitment/platform-generation.util.js");
const ebay_marketplace_tree_util_js_1 = require("../channels/ebay/ebay-marketplace-tree.util.js");
const ebay_german_listing_util_js_1 = require("../channels/ebay/ebay-german-listing.util.js");
const teams_service_js_1 = require("../teams/teams.service.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
function parseImageUrls(raw) {
    if (!raw?.trim())
        return [];
    return raw
        .split('|')
        .map((u) => u.trim())
        .filter(Boolean);
}
function computeMissingFields(listing) {
    const missing = [];
    if (!listing.title?.trim())
        missing.push('Title');
    if (!listing.cBrand?.trim())
        missing.push('Brand');
    if (!listing.cOeOemPartNumber?.trim() &&
        !listing.cManufacturerPartNumber?.trim()) {
        missing.push('OEM/MPN');
    }
    if (parseImageUrls(listing.itemPhotoUrl).length < 2) {
        missing.push('Images (min 2)');
    }
    if (!listing.startPrice?.trim() && listing.startPriceNum == null) {
        missing.push('Price');
    }
    if (!listing.quantity?.trim() && listing.quantityNum == null) {
        missing.push('Quantity');
    }
    if (!listing.categoryId?.trim() && !listing.categoryName?.trim()) {
        missing.push('Category');
    }
    if (!listing.description?.trim()) {
        missing.push('Description');
    }
    return missing;
}
function mapListingStatus(listing) {
    if (listing.status === 'published')
        return 'published';
    if (listing.status === 'ready')
        return 'ready';
    return 'draft';
}
const inventoryHasPriceSql = (a) => `NOT (COALESCE(btrim(${a}."startPrice"), '') = '' AND ${a}."startPriceNum" IS NULL)`;
function inventorySortKeySql(column) {
    const blank = (col) => `COALESCE(btrim(f."${col}"), '') = ''`;
    const flag = (cond) => `(CASE WHEN ${cond} THEN 1 ELSE 0 END)`;
    const imageCount = `(SELECT COUNT(*) FROM unnest(string_to_array(COALESCE(f."itemPhotoUrl", ''), '|')) u WHERE btrim(u) <> '')`;
    const enrichmentRank = `(CASE
    WHEN f."enrichmentStage" IN ('vision_lookup','enrichment','generating_us','generating_au','generating_de') THEN 2
    WHEN f."enrichmentStage" = 'completed' THEN 4
    WHEN f."enrichmentStage" = 'needs_review' THEN 3
    WHEN f."enrichmentStage" = 'failed' THEN 5
    WHEN pj.id IS NOT NULL THEN (CASE
      WHEN pj.optimization_status IN ('pending','running') THEN 2
      WHEN pj.optimization_status = 'completed' THEN 4
      WHEN pj.optimization_status = 'needs_review' THEN 3
      WHEN pj.optimization_status = 'failed' THEN 5
      WHEN pj.status = 'completed' THEN 4
      WHEN pj.status = 'failed' THEN 5
      ELSE 2 END)
    WHEN ${imageCount} >= 2 THEN 1
    ELSE 0 END)`;
    switch (column) {
        case 'image':
            return imageCount;
        case 'sku':
            return `LOWER(f."customLabelSku")`;
        case 'brand':
            return `LOWER(COALESCE(NULLIF(btrim(f."cBrand"), ''), 'Generic'))`;
        case 'location':
            return `(CASE WHEN f."origin" = 'add_part' THEN LOWER(NULLIF(btrim(f."location"), '')) END)`;
        case 'team':
            return `(SELECT LOWER(t.name) FROM teams t WHERE t.id = f."team_id")`;
        case 'fitments':
            return `GREATEST(
        (SELECT COUNT(*) FROM part_fitments pf WHERE pf.listing_id = f.id)::int,
        COALESCE((SELECT CASE WHEN jsonb_typeof(cp.fitment_data) = 'array' THEN jsonb_array_length(cp.fitment_data) END
                  FROM catalog_products cp WHERE cp.sku = f."customLabelSku" LIMIT 1), 0))`;
        case 'validation':
            return `(${[
                flag(blank('title')),
                flag(blank('cBrand')),
                flag(`${blank('cOeOemPartNumber')} AND ${blank('cManufacturerPartNumber')}`),
                flag(`${imageCount} < 2`),
                flag(`${blank('startPrice')} AND f."startPriceNum" IS NULL`),
                flag(`${blank('quantity')} AND f."quantityNum" IS NULL`),
                flag(`${blank('categoryId')} AND ${blank('categoryName')}`),
                flag(blank('description')),
            ].join(' + ')})`;
        case 'price':
            return `COALESCE(f."startPriceNum", CASE WHEN btrim(f."startPrice") ~ '^[0-9]+([.,][0-9]+)?$' THEN REPLACE(btrim(f."startPrice"), ',', '.')::numeric END)`;
        case 'status':
            return `(CASE f.status WHEN 'published' THEN 2 WHEN 'ready' THEN 1 ELSE 0 END)`;
        case 'enrichment':
            return enrichmentRank;
        case 'catalog':
            return flag(`${enrichmentRank} = 4`);
        default:
            return 'NULL';
    }
}
let InventoryWorkbenchService = class InventoryWorkbenchService {
    static { InventoryWorkbenchService_1 = this; }
    listingRepo;
    fitmentRepo;
    pipelineJobRepo;
    imageAssetRepo;
    productRepo;
    channelRepo;
    storeRepo;
    singleListingForm;
    pipelineService;
    autoTrigger;
    listingGenPipeline;
    enrichmentPipeline;
    modelRouter;
    taxonomy;
    partIdentification;
    fitmentDiscovery;
    storageService;
    vinDecode;
    listingOptimizationQueue;
    teamsService;
    rbac;
    logger = new common_1.Logger(InventoryWorkbenchService_1.name);
    categorySuggestionCache = new Map();
    static CATEGORY_CACHE_TTL_MS = 60 * 60 * 1000;
    static CATEGORY_API_DELAY_MS = 2500;
    constructor(listingRepo, fitmentRepo, pipelineJobRepo, imageAssetRepo, productRepo, channelRepo, storeRepo, singleListingForm, pipelineService, autoTrigger, listingGenPipeline, enrichmentPipeline, modelRouter, taxonomy, partIdentification, fitmentDiscovery, storageService, vinDecode, listingOptimizationQueue, teamsService, rbac) {
        this.listingRepo = listingRepo;
        this.fitmentRepo = fitmentRepo;
        this.pipelineJobRepo = pipelineJobRepo;
        this.imageAssetRepo = imageAssetRepo;
        this.productRepo = productRepo;
        this.channelRepo = channelRepo;
        this.storeRepo = storeRepo;
        this.singleListingForm = singleListingForm;
        this.pipelineService = pipelineService;
        this.autoTrigger = autoTrigger;
        this.listingGenPipeline = listingGenPipeline;
        this.enrichmentPipeline = enrichmentPipeline;
        this.modelRouter = modelRouter;
        this.taxonomy = taxonomy;
        this.partIdentification = partIdentification;
        this.fitmentDiscovery = fitmentDiscovery;
        this.storageService = storageService;
        this.vinDecode = vinDecode;
        this.listingOptimizationQueue = listingOptimizationQueue;
        this.teamsService = teamsService;
        this.rbac = rbac;
    }
    async resolveTeamScopeIds(user, requestedTeamIds) {
        if (!user)
            return null;
        const manageAll = await this.rbac.userHasPermission(user.id, 'teams.manage');
        const requested = requestedTeamIds
            ?.split(',')
            .map((s) => s.trim())
            .filter(Boolean) ?? [];
        if (manageAll) {
            return requested.length ? requested : null;
        }
        const userTeams = await this.teamsService.getUserTeamIds(user.id);
        if (requested.length) {
            return requested.filter((id) => userTeams.includes(id));
        }
        return userTeams;
    }
    async listListings(query, user) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 25;
        const offset = (page - 1) * limit;
        const params = [];
        let paramIdx = 1;
        const whereClauses = ['l."deletedAt" IS NULL'];
        const teamScopeIds = await this.resolveTeamScopeIds(user, query.teamIds);
        if (teamScopeIds !== null) {
            if (teamScopeIds.length === 0) {
                whereClauses.push('1 = 0');
            }
            else {
                whereClauses.push(`l."team_id" IN (${teamScopeIds.map(() => `$${paramIdx++}`).join(',')})`);
                params.push(...teamScopeIds);
            }
        }
        if (query.status) {
            whereClauses.push(`l.status = $${paramIdx++}`);
            params.push(query.status);
        }
        if (query.search?.trim()) {
            const term = `%${query.search.trim()}%`;
            whereClauses.push(`(l."customLabelSku" ILIKE $${paramIdx} OR l.title ILIKE $${paramIdx} OR l."cBrand" ILIKE $${paramIdx} OR l."cOeOemPartNumber" ILIKE $${paramIdx} OR l."cManufacturerPartNumber" ILIKE $${paramIdx})`);
            params.push(term);
            paramIdx++;
        }
        if (query.missingImages) {
            whereClauses.push(`(l."itemPhotoUrl" IS NULL OR TRIM(l."itemPhotoUrl") = '' OR l."itemPhotoUrl" NOT LIKE '%|%')`);
        }
        if (query.dateAddedFrom) {
            whereClauses.push(`l."importedAt" >= $${paramIdx++}::timestamptz`);
            params.push(query.dateAddedFrom);
        }
        if (query.dateAddedTo) {
            whereClauses.push(`l."importedAt" <= $${paramIdx++}::timestamptz`);
            params.push(query.dateAddedTo);
        }
        if (query.brand?.trim()) {
            whereClauses.push(`l."cBrand" ILIKE $${paramIdx++}`);
            params.push(`%${query.brand.trim()}%`);
        }
        if (query.make?.trim()) {
            whereClauses.push(`l."extractedMake" ILIKE $${paramIdx++}`);
            params.push(`%${query.make.trim()}%`);
        }
        if (query.model?.trim()) {
            whereClauses.push(`l."extractedModel" ILIKE $${paramIdx++}`);
            params.push(`%${query.model.trim()}%`);
        }
        if (query.category?.trim()) {
            whereClauses.push(`l."categoryName" ILIKE $${paramIdx++}`);
            params.push(`%${query.category.trim()}%`);
        }
        if (query.brands?.trim()) {
            const vals = query.brands
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            if (vals.length > 0) {
                whereClauses.push(`l."cBrand" IN (${vals.map(() => `$${paramIdx++}`).join(',')})`);
                params.push(...vals);
            }
        }
        if (query.conditions?.trim()) {
            const vals = query.conditions
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            if (vals.length > 0) {
                whereClauses.push(`l."conditionId" IN (${vals.map(() => `$${paramIdx++}`).join(',')})`);
                params.push(...vals);
            }
        }
        if (query.teamIds?.trim()) {
            const vals = query.teamIds
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            if (vals.length > 0) {
                whereClauses.push(`l."team_id" IN (${vals.map(() => `$${paramIdx++}`).join(',')})`);
                params.push(...vals);
            }
        }
        if (query.locations?.trim()) {
            const vals = query.locations
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            if (vals.length > 0) {
                whereClauses.push(`l."location" IN (${vals.map(() => `$${paramIdx++}`).join(',')})`);
                params.push(...vals);
            }
        }
        if (query.marketplaces?.trim()) {
            const vals = query.marketplaces
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            if (vals.length > 0) {
                whereClauses.push(`l."marketplace" IN (${vals.map(() => `$${paramIdx++}`).join(',')})`);
                params.push(...vals);
            }
        }
        if (query.stockLevel?.trim()) {
            const vals = query.stockLevel
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            const stockClauses = [];
            if (vals.includes('in_stock')) {
                stockClauses.push(`(l."quantityNum" > 2)`);
            }
            if (vals.includes('low_stock')) {
                stockClauses.push(`(l."quantityNum" >= 1 AND l."quantityNum" <= 2)`);
            }
            if (vals.includes('out_of_stock')) {
                stockClauses.push(`(l."quantityNum" IS NULL OR l."quantityNum" <= 0)`);
            }
            if (stockClauses.length > 0) {
                whereClauses.push(`(${stockClauses.join(' OR ')})`);
            }
        }
        if (query.minPrice != null) {
            whereClauses.push(`l."startPriceNum" >= $${paramIdx++}`);
            params.push(query.minPrice);
        }
        if (query.maxPrice != null) {
            whereClauses.push(`l."startPriceNum" <= $${paramIdx++}`);
            params.push(query.maxPrice);
        }
        if (query.minWeight != null) {
            whereClauses.push(`l."weight" >= $${paramIdx++}`);
            params.push(query.minWeight);
        }
        if (query.maxWeight != null) {
            whereClauses.push(`l."weight" <= $${paramIdx++}`);
            params.push(query.maxWeight);
        }
        if (query.hasPrice === '1') {
            whereClauses.push(inventoryHasPriceSql('l'));
        }
        const whereSql = whereClauses.join(' AND ');
        const sortMatch = /^([a-z]+)_(asc|desc)$/.exec(query.sort ?? '');
        const sortKeySql = sortMatch ? inventorySortKeySql(sortMatch[1]) : null;
        const sortDir = sortMatch?.[2] === 'desc' ? 'DESC' : 'ASC';
        const orderSql = sortKeySql
            ? `sort_key ${sortDir} NULLS LAST, "importedAt" DESC, id ASC`
            : `"importedAt" DESC`;
        const countSql = `
      WITH filtered AS (
        SELECT l.*
        FROM listing_records l
        WHERE ${whereSql}
      ),
      ranked AS (
        SELECT f.id,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(f."customLabelSku", f.id::text)
            ORDER BY
              CASE WHEN f."origin" = 'add_part' THEN 0 ELSE 1 END,
              CASE WHEN f.marketplace IS NULL THEN 0 ELSE 1 END,
              f."importedAt" DESC
          ) AS rn
        FROM filtered f
      )
      SELECT COUNT(*)::int AS count FROM ranked WHERE rn = 1
    `;
        const countRow = await this.listingRepo.query(countSql, params);
        const total = Number(countRow[0]?.count ?? 0);
        if (total === 0) {
            return { items: [], total: 0 };
        }
        const listSql = `
      WITH filtered AS (
        SELECT l.*
        FROM listing_records l
        WHERE ${whereSql}
      ),
      ranked AS (
        SELECT f.id, f."importedAt",
          ${sortKeySql ?? 'NULL'} AS sort_key,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(f."customLabelSku", f.id::text)
            ORDER BY
              CASE WHEN f."origin" = 'add_part' THEN 0 ELSE 1 END,
              CASE WHEN f.marketplace IS NULL THEN 0 ELSE 1 END,
              f."importedAt" DESC
          ) AS rn
        FROM filtered f
        LEFT JOIN pipeline_jobs pj ON pj.id = f."pipeline_job_id"
      )
      SELECT id FROM ranked
      WHERE rn = 1
      ORDER BY ${orderSql}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
        const idRows = await this.listingRepo.query(listSql, [...params, limit, offset]);
        if (idRows.length === 0) {
            return { items: [], total };
        }
        const ids = idRows.map((r) => r.id);
        const found = await this.listingRepo.find({ where: { id: (0, typeorm_2.In)(ids) } });
        const byId = new Map(found.map((l) => [l.id, l]));
        const listings = ids
            .map((id) => byId.get(id))
            .filter((l) => Boolean(l));
        const skus = [
            ...new Set(listings.map((l) => l.customLabelSku).filter(Boolean)),
        ];
        const teamIds = [
            ...new Set(listings.map((l) => l.teamId).filter(Boolean)),
        ];
        const [fitmentRows, siblings, catalogProducts, teamRows] = await Promise.all([
            this.fitmentRepo
                .createQueryBuilder('f')
                .select('f.listingId', 'listingId')
                .addSelect('COUNT(*)', 'count')
                .where('f.listingId IN (:...ids)', { ids })
                .groupBy('f.listingId')
                .getRawMany(),
            skus.length
                ? this.listingRepo.find({
                    where: { customLabelSku: (0, typeorm_2.In)(skus), deletedAt: (0, typeorm_2.IsNull)() },
                    select: [
                        'id',
                        'customLabelSku',
                        'marketplace',
                        'status',
                        'ebayListingId',
                        'pipelineJobId',
                    ],
                })
                : Promise.resolve([]),
            skus.length
                ? this.productRepo.find({
                    where: { sku: (0, typeorm_2.In)(skus) },
                    select: ['sku', 'fitmentData'],
                })
                : Promise.resolve([]),
            teamIds.length
                ? this.listingRepo.query(`SELECT id, name, color FROM teams WHERE id = ANY($1)`, [teamIds])
                : Promise.resolve([]),
        ]);
        const pipelineJobs = await this.loadPipelineJobsForListings(listings, siblings);
        const storeListingsBySku = await this.loadStoreListingsBySkus(skus);
        const fitmentByListing = new Map(fitmentRows.map((r) => [r.listingId, Number(r.count)]));
        const catalogFitmentBySku = new Map(catalogProducts.map((p) => {
            const count = Array.isArray(p.fitmentData) ? p.fitmentData.length : 0;
            return [p.sku, count];
        }));
        const teamById = new Map(teamRows.map((t) => [t.id, { name: t.name, color: t.color }]));
        const siblingsBySku = new Map();
        for (const s of siblings) {
            const key = s.customLabelSku ?? s.id;
            const group = siblingsBySku.get(key) ?? [];
            group.push(s);
            siblingsBySku.set(key, group);
        }
        const items = listings.map((listing) => {
            const imageUrls = parseImageUrls(listing.itemPhotoUrl);
            const price = listing.startPriceNum ??
                (listing.startPrice ? parseFloat(listing.startPrice) : 0);
            const quantity = listing.quantityNum ??
                (listing.quantity ? parseInt(listing.quantity, 10) : 0);
            const skuKey = listing.customLabelSku ?? listing.id;
            const variantRows = siblingsBySku.get(skuKey) ?? [listing];
            const marketplaceVariants = variantRows.map((v) => ({
                listingId: v.id,
                marketplace: v.marketplace,
                status: v.status,
                ebayListingId: v.ebayListingId ?? undefined,
                pipelineJobId: v.pipelineJobId ?? undefined,
            }));
            const jobIds = new Set(variantRows
                .map((v) => v.pipelineJobId)
                .filter((id) => Boolean(id)));
            const hasCompletedPipelineJob = [...jobIds].some((jid) => pipelineJobs.get(jid)?.status === 'completed');
            const primaryJob = listing.pipelineJobId
                ? pipelineJobs.get(listing.pipelineJobId)
                : undefined;
            const enrichmentStatus = this.autoTrigger.deriveStatus(listing, primaryJob);
            return {
                id: listing.id,
                sku: listing.customLabelSku ?? '',
                title: listing.title ?? listing.cOeOemPartNumber ?? '',
                brand: listing.cBrand ?? 'Generic',
                price: Number.isFinite(price) ? price : 0,
                quantity: Number.isFinite(quantity) ? quantity : 0,
                condition: listing.conditionId ?? 'Used',
                imageUrl: imageUrls[0] ?? '',
                imageUrls,
                categoryName: listing.categoryName ?? '',
                status: mapListingStatus(listing),
                ebayListingId: listing.ebayListingId ?? undefined,
                fitmentCount: Math.max(fitmentByListing.get(listing.id) ?? 0, listing.customLabelSku
                    ? (catalogFitmentBySku.get(listing.customLabelSku) ?? 0)
                    : 0),
                missingFields: computeMissingFields(listing),
                pipelineJobId: listing.pipelineJobId ?? undefined,
                pipelineJobStatus: primaryJob?.status,
                hasCompletedPipelineJob,
                enrichmentStatus,
                ...(enrichmentStatus === 'failed' || enrichmentStatus === 'needs_review'
                    ? {
                        failureReason: listing.enrichmentLastFailureReason ?? undefined,
                        failureClass: (0, enrichment_retry_service_js_1.classifyFailureForUi)(listing.enrichmentLastFailureReason, imageUrls.length) ??
                            undefined,
                    }
                    : {}),
                intakeSource: listing.origin === listing_record_entity_js_1.ListingOrigin.ADD_PART,
                marketplaceVariants,
                storeListings: listing.customLabelSku
                    ? (storeListingsBySku.get(listing.customLabelSku) ?? [])
                    : [],
                location: listing.origin === listing_record_entity_js_1.ListingOrigin.ADD_PART
                    ? (listing.location ?? undefined)
                    : undefined,
                version: listing.version,
                teamName: listing.teamId
                    ? (teamById.get(listing.teamId)?.name ?? null)
                    : null,
                teamColor: listing.teamId
                    ? (teamById.get(listing.teamId)?.color ?? null)
                    : null,
                importedAt: listing.importedAt
                    ? new Date(listing.importedAt).toISOString()
                    : undefined,
            };
        });
        return { items, total };
    }
    async loadPipelineJobsForListings(listings, siblings) {
        const jobIds = new Set();
        for (const l of [...listings, ...siblings]) {
            if (l.pipelineJobId)
                jobIds.add(l.pipelineJobId);
        }
        if (jobIds.size === 0)
            return new Map();
        const jobs = await this.pipelineJobRepo.find({
            where: { id: (0, typeorm_2.In)([...jobIds]) },
        });
        return new Map(jobs.map((j) => [j.id, j]));
    }
    async getListingDetail(listingId) {
        const listing = await this.getListingOrThrow(listingId);
        const sku = listing.customLabelSku;
        const [fitments, siblings, pipelineJob, catalogProduct] = await Promise.all([
            this.fitmentRepo.find({
                where: { listingId },
                relations: ['make', 'model', 'submodel', 'engine'],
                order: { yearStart: 'ASC' },
            }),
            sku
                ? this.listingRepo.find({
                    where: { customLabelSku: sku, deletedAt: (0, typeorm_2.IsNull)() },
                })
                : Promise.resolve([listing]),
            listing.pipelineJobId
                ? this.pipelineJobRepo.findOne({
                    where: { id: listing.pipelineJobId },
                })
                : Promise.resolve(null),
            sku
                ? this.productRepo.findOne({ where: { sku } })
                : Promise.resolve(null),
        ]);
        const priorJobs = await this.getCompletedJobsForSku(sku, listing.id);
        const storeListings = sku
            ? ((await this.loadStoreListingsBySkus([sku])).get(sku) ?? [])
            : [];
        return {
            listing: this.serializeListing(listing),
            donorVehicle: {
                vin: catalogProduct?.donorVin ?? null,
                year: catalogProduct?.donorYear ?? null,
                make: catalogProduct?.donorMake ?? null,
                model: catalogProduct?.donorModel ?? null,
            },
            fitments: fitments.map((f) => ({
                id: f.id,
                make: f.make?.name ?? null,
                model: f.model?.name ?? null,
                submodel: f.submodel?.name ?? null,
                engine: f.engine?.code ?? null,
                yearStart: f.yearStart,
                yearEnd: f.yearEnd,
                source: f.source,
                confidence: f.confidence,
                verified: f.verified,
                notes: f.notes,
            })),
            marketplaceVariants: siblings.map((s) => ({
                listingId: s.id,
                marketplace: s.marketplace,
                status: s.status,
                ebayListingId: s.ebayListingId,
                pipelineJobId: s.pipelineJobId,
                title: s.title,
                importedAt: s.importedAt,
            })),
            pipelineJob: pipelineJob
                ? {
                    id: pipelineJob.id,
                    status: pipelineJob.status,
                    originalFilename: pipelineJob.originalFilename,
                    completedAt: pipelineJob.completedAt,
                    createdAt: pipelineJob.createdAt,
                    totalParts: pipelineJob.totalParts,
                    enrichedCount: pipelineJob.enrichedCount,
                }
                : null,
            enrichmentStatus: this.autoTrigger.deriveStatus(listing, pipelineJob),
            priorCompletedJobs: priorJobs,
            missingFields: computeMissingFields(listing),
            imageUrls: parseImageUrls(listing.itemPhotoUrl),
            storeListings,
        };
    }
    async loadStoreListingsBySkus(skus) {
        const result = new Map();
        if (skus.length === 0)
            return result;
        const products = await this.productRepo.find({
            where: { sku: (0, typeorm_2.In)(skus) },
            select: ['id', 'sku'],
        });
        if (products.length === 0)
            return result;
        const skuByProductId = new Map(products.filter((p) => p.sku).map((p) => [p.id, p.sku]));
        const productIds = products.map((p) => p.id);
        const channels = await this.channelRepo.find({
            where: { catalogProductId: (0, typeorm_2.In)(productIds) },
            relations: ['ebayAccount'],
        });
        const storeIds = new Set();
        for (const ch of channels) {
            if (ch.ebayAccount?.primaryStoreId) {
                storeIds.add(ch.ebayAccount.primaryStoreId);
            }
        }
        const stores = storeIds.size > 0
            ? await this.storeRepo.find({ where: { id: (0, typeorm_2.In)([...storeIds]) } })
            : [];
        const storeMap = new Map(stores.map((s) => [s.id, s]));
        for (const ch of channels) {
            const sku = skuByProductId.get(ch.catalogProductId);
            if (!sku)
                continue;
            const account = ch.ebayAccount;
            const storeId = account?.primaryStoreId ?? '';
            const store = storeMap.get(storeId);
            const entry = {
                storeId,
                storeName: store?.storeName ?? account?.ebayUserId ?? 'Unknown store',
                marketplaceId: ch.marketplaceId,
                offerId: ch.offerId,
                ebayListingId: ch.listingId,
                listingUrl: ch.listingUrl,
                price: ch.channelPrice != null ? Number(ch.channelPrice) : null,
                quantity: ch.channelQuantity,
                status: ch.listingStatus,
                publishedAt: ch.publishedAt ? ch.publishedAt.toISOString() : null,
                lastSyncedAt: ch.lastSyncedAt ? ch.lastSyncedAt.toISOString() : null,
            };
            const list = result.get(sku) ?? [];
            list.push(entry);
            result.set(sku, list);
        }
        return result;
    }
    async getCompletedJobsForSku(sku, excludeListingId) {
        if (!sku)
            return [];
        const related = await this.listingRepo.find({
            where: { customLabelSku: sku, deletedAt: (0, typeorm_2.IsNull)() },
            select: ['id', 'pipelineJobId'],
        });
        const jobIds = [
            ...new Set(related
                .filter((r) => r.id !== excludeListingId && r.pipelineJobId)
                .map((r) => r.pipelineJobId)),
        ];
        if (jobIds.length === 0)
            return [];
        const jobs = await this.pipelineJobRepo.find({
            where: { id: (0, typeorm_2.In)(jobIds), status: 'completed' },
        });
        return jobs.map((j) => {
            const linked = related.find((r) => r.pipelineJobId === j.id);
            return {
                jobId: j.id,
                completedAt: j.completedAt ? j.completedAt.toISOString() : null,
                listingId: linked?.id ?? excludeListingId,
            };
        });
    }
    serializeListing(listing) {
        return {
            id: listing.id,
            customLabelSku: listing.customLabelSku,
            title: listing.title,
            description: listing.description,
            cBrand: listing.cBrand,
            cType: listing.cType,
            cManufacturerPartNumber: listing.cManufacturerPartNumber,
            cOeOemPartNumber: listing.cOeOemPartNumber,
            cFeatures: listing.cFeatures,
            categoryId: listing.categoryId,
            categoryName: listing.categoryName,
            conditionId: listing.conditionId,
            startPrice: listing.startPrice,
            startPriceNum: listing.startPriceNum,
            quantity: listing.quantity,
            quantityNum: listing.quantityNum,
            itemPhotoUrl: listing.itemPhotoUrl,
            pUpc: listing.pUpc,
            pEpid: listing.pEpid,
            location: listing.origin === listing_record_entity_js_1.ListingOrigin.ADD_PART ? listing.location : null,
            format: listing.format,
            sourceFileName: listing.sourceFileName,
            marketplace: listing.marketplace,
            status: listing.status,
            ebayListingId: listing.ebayListingId,
            pipelineJobId: listing.pipelineJobId,
            extractedMake: listing.extractedMake,
            extractedModel: listing.extractedModel,
            enrichmentStage: listing.enrichmentStage,
            enrichmentPermanentFail: listing.enrichmentPermanentFail,
            failureReason: listing.enrichmentLastFailureReason ?? undefined,
            failureClass: (0, enrichment_retry_service_js_1.classifyFailureForUi)(listing.enrichmentLastFailureReason, parseImageUrls(listing.itemPhotoUrl).length) ?? undefined,
            importedAt: listing.importedAt,
            updatedAt: listing.updatedAt,
            publishedAt: listing.publishedAt,
            version: listing.version,
        };
    }
    async lookupPartForListing(listingId) {
        return this.singleListingForm.lookupAndApplyToListing(listingId);
    }
    async inlineEnrichListing(listingId) {
        const setStage = async (stage) => {
            try {
                await this.listingRepo.update(listingId, {
                    enrichmentStage: stage,
                });
            }
            catch {
            }
        };
        try {
            return await this.runInlineEnrichListing(listingId, setStage);
        }
        catch (err) {
            await setStage(inventory_auto_trigger_service_js_1.INLINE_ENRICH_STAGES.FAILED);
            throw err;
        }
    }
    async runInlineEnrichListing(listingId, setStage) {
        this.logger.log(`Inline enrich [vision_lookup]: listing ${listingId}`);
        await setStage('vision_lookup');
        const { lookup: partLookup } = await this.singleListingForm.lookupAndApplyToListing(listingId);
        const baseListing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!baseListing || baseListing.deletedAt) {
            throw new common_1.NotFoundException(`Listing ${listingId} not found after lookup`);
        }
        const sku = baseListing.customLabelSku;
        if (!sku) {
            await setStage('failed');
            throw new common_1.BadRequestException('Listing has no SKU — cannot enrich');
        }
        const imageUrls = parseImageUrls(baseListing.itemPhotoUrl);
        this.logger.log(`Inline enrich [browse_identify]: listing ${listingId}`);
        const browseCorroboration = await this.partIdentification.identifyAndCorroborate({
            brand: baseListing.cBrand,
            mpn: baseListing.cManufacturerPartNumber,
            oemNumber: baseListing.cOeOemPartNumber,
        });
        if (browseCorroboration.checked) {
            this.logger.log(`Inline enrich [browse_identify]: listing ${listingId} — ` +
                `found=${browseCorroboration.found}` +
                (browseCorroboration.found
                    ? ` category="${browseCorroboration.categoryName}" (${browseCorroboration.categoryId})`
                    : ''));
        }
        this.logger.log(`Inline enrich [enrichment]: listing ${listingId}`);
        await setStage('enrichment');
        let enrichmentGateFailReason = null;
        let enrichedPlacement = null;
        try {
            const enrichInput = {
                sku: baseListing.customLabelSku,
                partNumber: baseListing.cManufacturerPartNumber || baseListing.cOeOemPartNumber,
                partName: baseListing.title,
                partType: baseListing.cType,
                brand: baseListing.cBrand,
                price: baseListing.startPriceNum,
                description: baseListing.description,
                features: baseListing.cFeatures,
                categoryName: baseListing.categoryName,
                categoryId: baseListing.categoryId,
                condition: baseListing.conditionId,
                donorMake: baseListing.extractedMake,
                donorModel: baseListing.extractedModel,
                imageUrls,
                image_count: imageUrls.length,
                browseCatalogChecked: browseCorroboration.checked,
                browseCatalogFound: browseCorroboration.found,
            };
            const enrichmentResult = await this.enrichmentPipeline.enrich(enrichInput);
            const autoApproveMinScore = this.modelRouter.getThresholds().autoApproveMinScore;
            const passedGate = enrichmentResult.passedGate === true;
            const preservePhotoIdentity = partLookup.source === 'vision';
            enrichedPlacement =
                passedGate && !preservePhotoIdentity
                    ? enrichmentResult.placement
                    : null;
            const score = enrichmentResult.validationScore ?? 100;
            if (!passedGate) {
                const reasons = enrichmentResult.hardFails ?? [];
                enrichmentGateFailReason = `ai_validation_gate: ${reasons.join(', ') || 'unspecified'}`;
                this.logger.warn(`Inline enrich [enrichment]: listing ${listingId} failed validation gate ` +
                    `(score=${score}) — ${enrichmentGateFailReason}`);
            }
            else if (score < autoApproveMinScore) {
                this.logger.warn(`Inline enrich [enrichment]: listing ${listingId} scored ${score}<${autoApproveMinScore} ` +
                    `(no hard fails) — continuing; deterministic post-steps decide final stage`);
            }
            if (passedGate && !preservePhotoIdentity) {
                if (enrichmentResult.title)
                    baseListing.title = enrichmentResult.title.slice(0, 80);
                if (enrichmentResult.brand)
                    baseListing.cBrand = enrichmentResult.brand;
                if (enrichmentResult.description)
                    baseListing.description = enrichmentResult.description;
                if (enrichmentResult.partType)
                    baseListing.cType = enrichmentResult.partType;
                if (enrichmentResult.mpn)
                    baseListing.cManufacturerPartNumber = enrichmentResult.mpn;
                if (enrichmentResult.oemNumber)
                    baseListing.cOeOemPartNumber = enrichmentResult.oemNumber;
            }
            if (passedGate && enrichmentResult.features?.length)
                baseListing.cFeatures = enrichmentResult.features.join(' | ');
            if (passedGate &&
                !preservePhotoIdentity &&
                browseCorroboration.found &&
                browseCorroboration.categoryId) {
                baseListing.categoryId = browseCorroboration.categoryId;
                baseListing.categoryName =
                    browseCorroboration.categoryName ?? browseCorroboration.categoryId;
                this.logger.log(`Category from Browse API corroboration for listing ${listingId}: ` +
                    `"${baseListing.categoryName}" (${baseListing.categoryId})`);
            }
            else if (passedGate &&
                !preservePhotoIdentity &&
                enrichmentResult.suggestedCategory) {
                baseListing.categoryName = enrichmentResult.suggestedCategory;
                for (const query of this.buildCategoryQueryCandidates(baseListing)) {
                    const resolved = await this.resolveCategoryFromQuery(query, 'US');
                    if (resolved) {
                        baseListing.categoryId = resolved.categoryId;
                        baseListing.categoryName = resolved.categoryName;
                        this.logger.log(`Resolved category for listing ${listingId}: "${resolved.categoryName}" (${resolved.categoryId})`);
                        break;
                    }
                }
            }
            if (baseListing.categoryId) {
                void this.partIdentification.ensureCategoryCached(baseListing.categoryId);
            }
            this.logger.log(`Inline enrich [enrichment]: done for listing ${listingId} title="${enrichmentResult.title}" ` +
                `model=${enrichmentResult.model} score=${enrichmentResult.validationScore}`);
        }
        catch (err) {
            this.logger.error(`Inline enrich [enrichment]: AI enrichment failed for listing ${listingId}: ` +
                `${err instanceof Error ? err.message : err}`);
            throw err;
        }
        await this.listingRepo.save(baseListing);
        if (baseListing.customLabelSku) {
            try {
                const catalogProduct = await this.productRepo.findOne({
                    where: { sku: baseListing.customLabelSku },
                });
                if (catalogProduct) {
                    let changed = false;
                    if (baseListing.categoryId &&
                        baseListing.categoryId !== catalogProduct.categoryId) {
                        catalogProduct.categoryId = baseListing.categoryId;
                        changed = true;
                    }
                    if (baseListing.categoryName &&
                        baseListing.categoryName !== catalogProduct.categoryName) {
                        catalogProduct.categoryName = baseListing.categoryName;
                        changed = true;
                    }
                    if (changed) {
                        await this.productRepo.save(catalogProduct);
                        this.logger.log(`Synced category to catalog product ${catalogProduct.id}: "${baseListing.categoryName}" (${baseListing.categoryId})`);
                    }
                }
            }
            catch (syncErr) {
                this.logger.warn(`Failed to sync category to catalog product for SKU ${baseListing.customLabelSku}: ` +
                    `${syncErr instanceof Error ? syncErr.message : syncErr}`);
            }
        }
        const marketplaceListings = [];
        const generatedMarketplaceListingIds = [];
        const MARKETPLACES = ['US'];
        let anyCategoryResolved = Boolean(baseListing.categoryId);
        for (const mkt of MARKETPLACES) {
            const stageName = `generating_${mkt.toLowerCase()}`;
            this.logger.log(`Inline enrich [${stageName}]: listing ${listingId}`);
            await setStage(stageName);
            if (mkt !== 'US') {
                await this.sleep(InventoryWorkbenchService_1.CATEGORY_API_DELAY_MS);
            }
            const mktCategory = await this.resolveCategoryForMarketplace(mkt, baseListing);
            if (mktCategory)
                anyCategoryResolved = true;
            const existing = await this.listingRepo.findOne({
                where: { customLabelSku: sku, marketplace: mkt, deletedAt: (0, typeorm_2.IsNull)() },
            });
            if (existing) {
                if (!existing.categoryId && mktCategory) {
                    await this.listingRepo.update(existing.id, {
                        categoryId: mktCategory.categoryId,
                        categoryName: mktCategory.categoryName,
                    });
                }
                marketplaceListings.push({
                    marketplace: mkt,
                    listingId: existing.id,
                    title: existing.title ?? '',
                });
                continue;
            }
            const productData = {
                sku: baseListing.customLabelSku,
                brand: baseListing.cBrand,
                mpn: baseListing.cManufacturerPartNumber,
                oem_number: baseListing.cOeOemPartNumber,
                title: baseListing.title,
                part_type: baseListing.cType,
                placement: null,
                material: null,
                features: baseListing.cFeatures,
                image_count: imageUrls.length,
                extracted_make: baseListing.extractedMake,
                extracted_model: baseListing.extractedModel,
                price: baseListing.startPriceNum,
                description: baseListing.description,
            };
            if (mkt === 'DE') {
                const partTypeRaw = typeof productData.part_type === 'string'
                    ? productData.part_type
                    : '';
                const placementRaw = typeof productData.placement === 'string'
                    ? productData.placement
                    : '';
                productData.germanPartType =
                    (0, ebay_german_listing_util_js_1.translatePartNameToGerman)(partTypeRaw) || partTypeRaw;
                productData.germanPlacement =
                    (0, ebay_german_listing_util_js_1.formatGermanPlacement)(placementRaw) || placementRaw;
                productData.marketplaceLanguage = 'German';
            }
            try {
                const sellerCountry = mkt === 'DE' ? 'DE' : mkt === 'AU' ? 'AE' : 'AE';
                const aiResult = await this.listingGenPipeline.generate(productData, baseListing.categoryName ?? 'eBay Motors Parts & Accessories', baseListing.conditionId ?? 'Used', { marketplace: mkt, sellerCountry });
                const newListing = this.listingRepo.create({
                    sourceFileName: `inline-enrich-${mkt.toLowerCase()}`,
                    sourceFilePath: `inline-enrich:${listingId}/${mkt}`,
                    origin: baseListing.origin,
                    sheetName: `Inline Enrich ${mkt}`,
                    sourceRowNumber: baseListing.sourceRowNumber,
                    action: 'Add',
                    customLabelSku: sku,
                    categoryId: mktCategory?.categoryId ?? baseListing.categoryId,
                    categoryName: mktCategory?.categoryName ?? baseListing.categoryName,
                    title: partLookup.source === 'vision'
                        ? baseListing.title
                        : aiResult.title.slice(0, 80),
                    description: partLookup.source === 'vision'
                        ? baseListing.description
                        : aiResult.description,
                    startPrice: baseListing.startPrice,
                    startPriceNum: baseListing.startPriceNum,
                    quantity: baseListing.quantity,
                    quantityNum: baseListing.quantityNum,
                    itemPhotoUrl: baseListing.itemPhotoUrl,
                    conditionId: baseListing.conditionId,
                    format: baseListing.format,
                    duration: baseListing.duration,
                    location: baseListing.location,
                    shippingProfileName: baseListing.shippingProfileName,
                    returnProfileName: baseListing.returnProfileName,
                    paymentProfileName: baseListing.paymentProfileName,
                    cBrand: baseListing.cBrand,
                    cType: baseListing.cType,
                    cFeatures: baseListing.cFeatures,
                    cManufacturerPartNumber: baseListing.cManufacturerPartNumber,
                    cOeOemPartNumber: baseListing.cOeOemPartNumber,
                    extractedMake: baseListing.extractedMake,
                    extractedModel: baseListing.extractedModel,
                    teamId: baseListing.teamId,
                    marketplace: mkt,
                    version: 1,
                });
                const saved = await this.listingRepo.save(newListing);
                generatedMarketplaceListingIds.push(saved.id);
                marketplaceListings.push({
                    marketplace: mkt,
                    listingId: saved.id,
                    title: partLookup.source === 'vision'
                        ? (baseListing.title ?? '')
                        : aiResult.title,
                });
                this.logger.log(`Inline enrich [${stageName}]: created ${mkt} listing for SKU ${sku}`);
            }
            catch (err) {
                this.logger.error(`Inline enrich [${stageName}]: failed for ${mkt} (SKU ${sku}): ${err instanceof Error ? err.message : err}`);
                const fallbackListing = this.listingRepo.create({
                    sourceFileName: `inline-enrich-${mkt.toLowerCase()}`,
                    sourceFilePath: `inline-enrich:${listingId}/${mkt}`,
                    origin: baseListing.origin,
                    sheetName: `Inline Enrich ${mkt}`,
                    sourceRowNumber: baseListing.sourceRowNumber,
                    action: 'Add',
                    customLabelSku: sku,
                    categoryId: mktCategory?.categoryId ?? baseListing.categoryId,
                    categoryName: mktCategory?.categoryName ?? baseListing.categoryName,
                    title: baseListing.title,
                    description: baseListing.description,
                    startPrice: baseListing.startPrice,
                    startPriceNum: baseListing.startPriceNum,
                    quantity: baseListing.quantity,
                    quantityNum: baseListing.quantityNum,
                    itemPhotoUrl: baseListing.itemPhotoUrl,
                    conditionId: baseListing.conditionId,
                    format: baseListing.format,
                    duration: baseListing.duration,
                    location: baseListing.location,
                    cBrand: baseListing.cBrand,
                    cType: baseListing.cType,
                    cFeatures: baseListing.cFeatures,
                    cManufacturerPartNumber: baseListing.cManufacturerPartNumber,
                    cOeOemPartNumber: baseListing.cOeOemPartNumber,
                    extractedMake: baseListing.extractedMake,
                    extractedModel: baseListing.extractedModel,
                    marketplace: mkt,
                    version: 1,
                });
                const saved = await this.listingRepo.save(fallbackListing);
                generatedMarketplaceListingIds.push(saved.id);
                marketplaceListings.push({
                    marketplace: mkt,
                    listingId: saved.id,
                    title: saved.title ?? '',
                });
            }
        }
        if (baseListing.status === 'draft' && !enrichmentGateFailReason) {
            baseListing.status = 'ready';
            await this.listingRepo.save(baseListing);
        }
        await this.upsertCatalogProductFromListing(baseListing);
        if (partLookup.year &&
            (partLookup.make || partLookup.brand) &&
            partLookup.model) {
            await this.seedBrowseFitment(sku, {
                year: partLookup.year,
                make: (partLookup.make || partLookup.brand),
                model: partLookup.model,
            });
        }
        const { count: fitmentRowCount, rows: fitmentRows } = await this.discoverAndPersistFitment(baseListing, listingId);
        const composedTitle = this.composeDeterministicTitle(baseListing, fitmentRows, enrichedPlacement);
        if (composedTitle) {
            baseListing.title = composedTitle;
            await this.listingRepo.update(listingId, { title: composedTitle });
            const generatedListingPatch = {
                title: composedTitle,
            };
            if (partLookup.source === 'vision') {
                generatedListingPatch.description = baseListing.description;
            }
            for (const generatedListingId of generatedMarketplaceListingIds) {
                await this.listingRepo.update(generatedListingId, generatedListingPatch);
                const responseListing = marketplaceListings.find((item) => item.listingId === generatedListingId);
                if (responseListing)
                    responseListing.title = composedTitle;
            }
            await this.upsertCatalogProductFromListing(baseListing);
            this.logger.log(`Inline enrich: deterministic title for listing ${listingId}: "${composedTitle}"`);
        }
        const hasCategory = anyCategoryResolved || Boolean(baseListing.categoryId);
        const hasFitment = fitmentRowCount > 0;
        const finalStage = hasCategory && hasFitment && !enrichmentGateFailReason
            ? inventory_auto_trigger_service_js_1.INLINE_ENRICH_STAGES.COMPLETED
            : inventory_auto_trigger_service_js_1.INLINE_ENRICH_STAGES.NEEDS_REVIEW;
        await setStage(finalStage);
        if (finalStage === inventory_auto_trigger_service_js_1.INLINE_ENRICH_STAGES.NEEDS_REVIEW &&
            enrichmentGateFailReason) {
            await this.listingRepo.update(listingId, {
                enrichmentLastFailureReason: enrichmentGateFailReason,
            });
        }
        this.logger.log(`Inline enrich [${finalStage}]: listing ${listingId} (SKU ${sku}) — ` +
            `${marketplaceListings.length} marketplace listing(s), ` +
            `category=${hasCategory ? 'yes' : 'no'}, fitmentRows=${fitmentRowCount}`);
        return { baseListing, marketplaceListings };
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async getCategorySuggestionsCached(query, treeId) {
        const key = `${treeId}::${query.toLowerCase().trim()}`;
        const cached = this.categorySuggestionCache.get(key);
        if (cached &&
            Date.now() - cached.at < InventoryWorkbenchService_1.CATEGORY_CACHE_TTL_MS) {
            return cached.suggestions;
        }
        const suggestions = await this.taxonomy.getCategorySuggestions(query, treeId);
        this.categorySuggestionCache.set(key, { at: Date.now(), suggestions });
        return suggestions;
    }
    async resolveCategoryFromQuery(query, mkt) {
        const trimmed = query.trim();
        if (!trimmed)
            return null;
        const treeId = (0, ebay_marketplace_tree_util_js_1.resolveCategoryTreeId)(mkt);
        try {
            const suggestions = await this.getCategorySuggestionsCached(trimmed, treeId);
            const best = suggestions[0]?.category;
            if (best?.categoryId) {
                return {
                    categoryId: best.categoryId,
                    categoryName: best.categoryName ?? best.categoryId,
                };
            }
        }
        catch (err) {
            this.logger.warn(`Category resolution failed for ${mkt} (tree ${treeId}) query "${trimmed}": ` +
                `${err instanceof Error ? err.message : err}`);
        }
        return null;
    }
    async resolveCategoryForListing(listing, mkt) {
        if (mkt === 'US' && listing.categoryId) {
            return {
                categoryId: listing.categoryId,
                categoryName: listing.categoryName ?? listing.categoryId,
            };
        }
        for (const query of this.buildCategoryQueryCandidates(listing)) {
            const resolved = await this.resolveCategoryFromQuery(query, mkt);
            if (resolved)
                return resolved;
            await this.sleep(800);
        }
        return null;
    }
    composeDeterministicTitle(listing, fitmentRows, placement) {
        const firstRowModel = fitmentRows
            .map((r) => String(r.Model ?? r.model ?? '').trim())
            .find(Boolean);
        let model = listing.extractedModel?.trim() || firstRowModel || '';
        let make = listing.cBrand?.trim() || listing.extractedMake?.trim() || '';
        if (model && make.toLowerCase().endsWith(` ${model.toLowerCase()}`)) {
            make = make.slice(0, make.length - model.length).trim();
        }
        if (make && model.toLowerCase().startsWith(`${make.toLowerCase()} `)) {
            model = model.slice(make.length).trim();
        }
        if (/^(unknown|n\/?a|none|other)$/i.test(model)) {
            model = '';
        }
        const fitmentYears = [];
        for (const row of fitmentRows) {
            const parsed = (0, platform_generation_util_js_1.parseYearRange)(String(row.Year ?? row.year ?? ''));
            if (parsed)
                fitmentYears.push(parsed.min, parsed.max);
        }
        const aligned = (0, platform_generation_util_js_1.alignGenerationAndYearRange)({
            make,
            model,
            anchorYear: fitmentYears[0] ?? null,
            fitmentYears,
        });
        let partName = this.cleanTitlePartName(listing.cType) ??
            this.cleanTitlePartName(listing.categoryName) ??
            null;
        if (partName && placement?.trim()) {
            const pos = placement.trim().toLowerCase();
            if (partName.toLowerCase().startsWith(`${pos} `)) {
                partName = partName.slice(placement.trim().length).trim() || partName;
            }
        }
        const oemCandidate = (listing.cOeOemPartNumber ||
            listing.cManufacturerPartNumber ||
            '').trim();
        const oemPartNumber = oemCandidate &&
            !/^(19|20)\d{2}$/.test(oemCandidate) &&
            oemCandidate.length >= 4
            ? oemCandidate
            : null;
        return (0, ebay_listing_text_util_js_1.buildStructuredEbayTitle)({
            yearRange: aligned.yearRange || null,
            make: make || null,
            model: model || null,
            generation: aligned.generation || null,
            position: placement,
            partName,
            oemPartNumber,
        });
    }
    static TITLE_PART_NAME_JUNK = new Set([
        'oem',
        'aftermarket',
        'salvage',
        'used',
        'new',
        'genuine',
        'general',
        'unknown',
        'other',
        'misc',
        'miscellaneous',
        'part',
        'parts',
        'n/a',
        'na',
        'none',
    ]);
    cleanTitlePartName(raw) {
        let s = (raw ?? '').replace(/\s+/g, ' ').trim();
        if (!s)
            return null;
        for (let i = 0; i < 4; i++) {
            const before = s;
            s = s.replace(/^(?:OEM|Genuine|Used|New|Original)\b\s*/i, '');
            s = s.replace(/\s*\b(?:OEM|Genuine|Used|New|Original)$/i, '');
            s = s.trim();
            if (s === before)
                break;
        }
        if (!s)
            return null;
        if (InventoryWorkbenchService_1.TITLE_PART_NAME_JUNK.has(s.toLowerCase())) {
            return null;
        }
        if (/^other\b.*\b(parts|accessories)$/i.test(s) ||
            /\b(parts|assemblies|accessories)\b.*&/i.test(s) ||
            /&.*\b(parts|assemblies|accessories)\b/i.test(s) ||
            /,.*(parts|assemblies|accessories)$/i.test(s)) {
            return null;
        }
        return s;
    }
    async seedBrowseFitment(sku, vehicle) {
        try {
            const product = await this.productRepo.findOne({ where: { sku } });
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
            await this.productRepo.update(product.id, {
                fitmentData: [
                    {
                        Year: vehicle.year,
                        Make: vehicle.make,
                        Model: vehicle.model,
                        Source: 'ebay_browse',
                    },
                    ...existing,
                ],
            });
            this.logger.log(`Seeded Browse fitment for SKU ${sku}: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
        }
        catch (err) {
            this.logger.warn(`Failed to seed Browse fitment for SKU ${sku}: ${err instanceof Error ? err.message : err}`);
        }
    }
    async discoverAndPersistFitment(listing, listingId) {
        if (!listing.customLabelSku)
            return { count: 0, rows: [] };
        try {
            const product = await this.productRepo.findOne({
                where: { sku: listing.customLabelSku },
            });
            if (!product)
                return { count: 0, rows: [] };
            if (!product.fitmentData &&
                listing.extractedMake?.trim() &&
                listing.extractedModel?.trim()) {
                const models = listing.extractedModel
                    .split(/[,/]/)
                    .map((m) => m.trim())
                    .filter(Boolean);
                const titleYear = String(listing.title ?? '').match(/\b((?:19|20)\d{2})\b/)?.[1] ?? '';
                product.fitmentData = models.map((model) => ({
                    Make: listing.extractedMake,
                    Model: model,
                    Year: titleYear,
                    Source: 'extracted_vehicle',
                }));
            }
            const seededFitment = Array.isArray(product.fitmentData)
                ? product.fitmentData
                : [];
            const fitmentResult = await this.fitmentDiscovery.discover(product, {
                marketplace: 'US',
                categoryId: listing.categoryId ?? undefined,
            });
            const discoveredJson = this.fitmentDiscovery.toFitmentDataJson(fitmentResult.rows);
            const fitmentJson = discoveredJson.length > 0 ? discoveredJson : seededFitment;
            await this.productRepo.update(product.id, {
                fitmentData: fitmentJson.length > 0 ? fitmentJson : product.fitmentData,
                fitmentStatus: fitmentResult.status,
                fitmentConfidence: fitmentResult.confidence,
                donorVin: fitmentResult.donorVin,
                donorVinDecoded: fitmentResult.donorVinDecoded,
            });
            if (fitmentResult.ebayCatalogCategoryId &&
                !product.categoryId &&
                !listing.categoryId) {
                const catId = fitmentResult.ebayCatalogCategoryId;
                const catName = fitmentResult.ebayCatalogCategoryName ?? catId;
                await this.productRepo.update(product.id, {
                    categoryId: catId,
                    categoryName: catName,
                });
                await this.listingRepo.update(listingId, {
                    categoryId: catId,
                    categoryName: catName,
                });
                this.logger.log(`Applied eBay catalog category to listing ${listingId}: "${catName}" (${catId})`);
            }
            if (fitmentJson.length > 0) {
                this.logger.log(`Inline enrich: persisted ${fitmentJson.length} fitment row(s) for SKU ${listing.customLabelSku}`);
            }
            else {
                this.logger.warn(`Inline enrich: no fitment rows discovered for SKU ${listing.customLabelSku} (listing ${listingId})`);
            }
            return { count: fitmentJson.length, rows: fitmentJson };
        }
        catch (err) {
            this.logger.warn(`Fitment discovery failed for listing ${listingId}: ` +
                `${err instanceof Error ? err.message : err}`);
            return { count: 0, rows: [] };
        }
    }
    async resolveCategoryForMarketplace(mkt, listing) {
        const resolved = await this.resolveCategoryForListing(listing, mkt);
        if (resolved) {
            this.logger.log(`Resolved ${mkt} category for SKU ${listing.customLabelSku}: "${resolved.categoryName}" (${resolved.categoryId})`);
        }
        else {
            this.logger.warn(`No category suggestions for ${mkt} — SKU ${listing.customLabelSku} (tried: ${this.buildCategoryQueryCandidates(listing).join(' | ')})`);
        }
        return resolved;
    }
    buildCategoryQueryCandidates(listing) {
        const brand = listing.cBrand?.trim();
        const partTypeRaw = listing.cType?.trim();
        const partType = partTypeRaw && partTypeRaw.toUpperCase() !== 'OEM' ? partTypeRaw : null;
        const categoryName = listing.categoryName?.trim();
        const title = listing.title?.trim();
        const make = listing.extractedMake?.trim();
        const model = listing.extractedModel?.trim()?.split(/[,/]/)[0]?.trim();
        const genericCategories = new Set([
            'gauges',
            'body parts',
            'interior parts & accessories',
            'engines & components',
            'lighting',
            'brakes',
        ]);
        const titleWords = title
            ? title
                .replace(/\b(New|OEM|Genuine|Original|Used|Left|Right|Front|Rear|Driver|Passenger|Upper|Lower|Assembly|Set|Pair)\b/gi, '')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 6)
            : [];
        const candidates = [];
        const push = (q) => {
            const t = q.trim();
            if (t && !candidates.includes(t))
                candidates.push(t);
        };
        if (brand && partType)
            push(`${brand} ${partType}`);
        if (make && model && partType)
            push(`${make} ${model} ${partType}`);
        if (titleWords.length >= 3)
            push(titleWords.slice(0, 5).join(' '));
        if (make && model && titleWords.length >= 2) {
            push(`${make} ${model} ${titleWords.slice(2, 5).join(' ')}`);
        }
        if (brand &&
            categoryName &&
            !genericCategories.has(categoryName.toLowerCase())) {
            push(`${brand} ${categoryName}`);
        }
        if (categoryName && !genericCategories.has(categoryName.toLowerCase())) {
            push(categoryName);
        }
        if (brand && categoryName)
            push(`${brand} ${categoryName}`);
        if (titleWords.length > 0) {
            const lead = brand ?? make;
            const rest = lead && titleWords[0]?.toLowerCase() === lead.toLowerCase()
                ? titleWords.slice(1)
                : titleWords;
            push([lead, ...rest].filter(Boolean).join(' '));
        }
        return candidates;
    }
    buildCategoryQuery(listing) {
        return this.buildCategoryQueryCandidates(listing)[0] ?? '';
    }
    async upsertCatalogProductFromListing(listing) {
        if (!listing.customLabelSku)
            return;
        try {
            const existing = await this.productRepo.findOne({
                where: { sku: listing.customLabelSku },
            });
            const patch = {};
            if (listing.categoryId)
                patch.categoryId = listing.categoryId;
            if (listing.categoryName)
                patch.categoryName = listing.categoryName;
            if (listing.cBrand)
                patch.brand = listing.cBrand;
            if (listing.cType)
                patch.partType = listing.cType;
            if (listing.description)
                patch.description = listing.description;
            if (listing.cFeatures)
                patch.features = listing.cFeatures;
            if (listing.cManufacturerPartNumber)
                patch.mpn = listing.cManufacturerPartNumber;
            if (listing.cOeOemPartNumber)
                patch.oemPartNumber = listing.cOeOemPartNumber;
            if (listing.title)
                patch.title = listing.title;
            if (existing) {
                let changed = false;
                for (const [k, v] of Object.entries(patch)) {
                    if (v && existing[k] !== v) {
                        existing[k] = v;
                        changed = true;
                    }
                }
                if (changed)
                    await this.productRepo.save(existing);
            }
            else {
                const created = this.productRepo.create({
                    sku: listing.customLabelSku,
                    title: listing.title,
                    ...patch,
                });
                await this.productRepo.save(created);
                this.logger.log(`Created catalog product for SKU ${listing.customLabelSku} from inline enrichment`);
            }
        }
        catch (err) {
            this.logger.warn(`Failed to upsert catalog product for SKU ${listing.customLabelSku}: ` +
                `${err instanceof Error ? err.message : err}`);
        }
    }
    async updateListingImages(listingId, imageUrls, uploadedAssetIds) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing || listing.deletedAt) {
            throw new common_1.NotFoundException(`Listing ${listingId} not found`);
        }
        const rawIncoming = imageUrls.map((u) => u.trim()).filter(Boolean);
        if (rawIncoming.length === 0) {
            throw new common_1.BadRequestException('At least one image URL is required');
        }
        const incoming = await this.storageService.mirrorRemoteImageUrls(rawIncoming, `inventory/${listingId}`);
        const existing = parseImageUrls(listing.itemPhotoUrl);
        const existingImageSet = new Set(existing);
        const hasNewImages = incoming.some((url) => !existingImageSet.has(url));
        const merged = [...existing];
        for (const url of incoming) {
            if (!merged.includes(url))
                merged.push(url);
        }
        listing.itemPhotoUrl = merged.join('|');
        await this.listingRepo.save(listing);
        if (uploadedAssetIds?.length) {
            await this.imageAssetRepo.update({ id: (0, typeorm_2.In)(uploadedAssetIds) }, { listingId: listing.id });
        }
        const detail = await this.getListingDetail(listingId);
        const mergedCount = parseImageUrls(listing.itemPhotoUrl).length;
        if (mergedCount >= 2) {
            const stage = listing.enrichmentStage;
            const mayEnqueue = hasNewImages ||
                !stage ||
                stage === inventory_auto_trigger_service_js_1.INLINE_ENRICH_STAGES.FAILED ||
                stage === inventory_auto_trigger_service_js_1.INLINE_ENRICH_STAGES.NEEDS_REVIEW ||
                stage === inventory_auto_trigger_service_js_1.INLINE_ENRICH_STAGES.VISION_LOOKUP;
            if (mayEnqueue) {
                await this.autoTrigger.enqueueAutoEnrich(listingId, {
                    force: hasNewImages || listing.enrichmentPermanentFail,
                });
            }
        }
        return detail;
    }
    async updateDonorVehicle(listingId, dto) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing || listing.deletedAt) {
            throw new common_1.NotFoundException(`Listing ${listingId} not found`);
        }
        const sku = listing.customLabelSku?.trim();
        if (!sku) {
            throw new common_1.BadRequestException('Listing has no SKU to link a catalog product');
        }
        const product = await this.productRepo.findOne({ where: { sku } });
        if (!product) {
            throw new common_1.NotFoundException(`No catalog product found for SKU ${sku}`);
        }
        const nextVin = dto.donorVin?.trim().toUpperCase() || null;
        let decoded = null;
        if (nextVin && nextVin !== (product.donorVin ?? '').toUpperCase()) {
            try {
                decoded = await this.vinDecode.decode(nextVin);
            }
            catch (err) {
                this.logger.warn(`VIN decode failed for ${nextVin} (listing ${listingId}): ${err instanceof Error ? err.message : err}`);
            }
        }
        const resolveField = (requestValue, existingValue, decodedValue) => {
            const explicit = requestValue?.trim();
            if (explicit)
                return explicit;
            const existing = existingValue?.trim();
            if (existing)
                return existing;
            return decodedValue?.trim() || null;
        };
        if (dto.donorVin !== undefined) {
            product.donorVin = nextVin;
        }
        product.donorYear = resolveField(dto.donorYear, product.donorYear, decoded?.year);
        product.donorMake = resolveField(dto.donorMake, product.donorMake, decoded?.make);
        product.donorModel = resolveField(dto.donorModel, product.donorModel, decoded?.model);
        await this.productRepo.save(product);
        try {
            await this.listingOptimizationQueue.add('optimize-product', { productId: product.id, marketplace: 'US' }, {
                jobId: `donor-vehicle-${product.id}-${Date.now()}`,
                attempts: 3,
                backoff: { type: 'exponential', delay: 30_000 },
            });
        }
        catch (err) {
            this.logger.warn(`Failed to enqueue listing optimization after donor vehicle update for ${listingId}: ${err instanceof Error ? err.message : err}`);
        }
        return {
            donorVin: product.donorVin,
            donorYear: product.donorYear,
            donorMake: product.donorMake,
            donorModel: product.donorModel,
        };
    }
    async reorderListingImages(listingId, imageUrls) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing || listing.deletedAt) {
            throw new common_1.NotFoundException(`Listing ${listingId} not found`);
        }
        const existing = parseImageUrls(listing.itemPhotoUrl);
        const incoming = imageUrls.map((u) => u.trim()).filter(Boolean);
        for (const url of incoming) {
            if (!existing.includes(url)) {
                throw new common_1.BadRequestException(`URL not found on listing: ${url.slice(0, 80)}...`);
            }
        }
        listing.itemPhotoUrl = incoming.length > 0 ? incoming.join('|') : null;
        await this.listingRepo.save(listing);
        if (incoming.length > 0) {
            const assets = await this.imageAssetRepo.find({
                where: { listingId },
            });
            for (let i = 0; i < incoming.length; i++) {
                const url = incoming[i];
                const asset = assets.find((a) => a.cdnUrl === url);
                if (asset) {
                    asset.sortOrder = i;
                    asset.isPrimary = i === 0;
                    await this.imageAssetRepo.save(asset);
                }
            }
        }
        return this.getListingDetail(listingId);
    }
    async bulkLookupParts(listingIds) {
        const results = [];
        for (const listingId of listingIds) {
            try {
                const { lookup } = await this.singleListingForm.lookupAndApplyToListing(listingId);
                results.push({ listingId, success: true, lookup });
            }
            catch (err) {
                results.push({
                    listingId,
                    success: false,
                    error: err instanceof Error ? err.message : 'Lookup failed',
                });
            }
        }
        return { results };
    }
    async buildRequeueWarnings(listingIds) {
        const uniqueIds = [...new Set(listingIds)];
        const listings = await this.listingRepo.find({
            where: { id: (0, typeorm_2.In)(uniqueIds) },
        });
        const warnings = [];
        const warnedSkus = new Set();
        for (const listing of listings) {
            const skuKey = listing.customLabelSku ?? listing.id;
            if (warnedSkus.has(skuKey))
                continue;
            const related = listing.customLabelSku
                ? await this.listingRepo.find({
                    where: {
                        customLabelSku: listing.customLabelSku,
                        deletedAt: (0, typeorm_2.IsNull)(),
                    },
                    select: ['id', 'pipelineJobId'],
                })
                : [{ id: listing.id, pipelineJobId: listing.pipelineJobId }];
            const jobIds = [
                ...new Set(related
                    .map((r) => r.pipelineJobId)
                    .filter((id) => Boolean(id))),
            ];
            if (jobIds.length === 0)
                continue;
            const completedJobs = await this.pipelineJobRepo.find({
                where: { id: (0, typeorm_2.In)(jobIds), status: 'completed' },
                order: { completedAt: 'DESC' },
            });
            if (completedJobs.length > 0) {
                warnedSkus.add(skuKey);
                const job = completedJobs[0];
                warnings.push({
                    listingId: listing.id,
                    sku: listing.customLabelSku ?? '',
                    jobId: job.id,
                    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
                });
            }
        }
        return warnings;
    }
    async sendToPipeline(listingIds, userId) {
        const uniqueIds = [...new Set(listingIds)];
        const listings = await this.listingRepo.find({
            where: { id: (0, typeorm_2.In)(uniqueIds) },
        });
        if (listings.length !== uniqueIds.length) {
            throw new common_1.BadRequestException('One or more listings were not found');
        }
        for (const listing of listings) {
            const images = parseImageUrls(listing.itemPhotoUrl);
            if (images.length < 2) {
                throw new common_1.BadRequestException(`Listing ${listing.customLabelSku ?? listing.id} needs at least 2 photos before sending to pipeline`);
            }
            const partNumber = listing.cOeOemPartNumber?.trim() ||
                listing.cManufacturerPartNumber?.trim();
            if (!partNumber) {
                throw new common_1.BadRequestException(`Listing ${listing.customLabelSku ?? listing.id} is missing an OEM/part number`);
            }
            if (!listing.cBrand?.trim()) {
                throw new common_1.BadRequestException(`Listing ${listing.customLabelSku ?? listing.id} is missing a brand`);
            }
        }
        const warnings = await this.buildRequeueWarnings(uniqueIds);
        const job = await this.pipelineService.createBatchJobFromListings(uniqueIds, userId, {
            source: 'inventory',
            forceVision: true,
        });
        return { job, warnings };
    }
    async enrichListings(listingIds, userId) {
        return this.sendToPipeline(listingIds, userId);
    }
    async getListingOrThrow(listingId) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing || listing.deletedAt) {
            throw new common_1.NotFoundException(`Listing ${listingId} not found`);
        }
        return listing;
    }
    async getFilterBrands() {
        const rows = await this.listingRepo
            .createQueryBuilder('l')
            .select('DISTINCT l."cBrand"', 'brand')
            .where('l."cBrand" IS NOT NULL AND TRIM(l."cBrand") != \'\'')
            .andWhere('l."deletedAt" IS NULL')
            .orderBy('l."cBrand"', 'ASC')
            .getRawMany();
        return rows.map((r) => r.brand);
    }
    async getFilterMakes() {
        const rows = await this.listingRepo
            .createQueryBuilder('l')
            .select('DISTINCT l."extractedMake"', 'make')
            .where('l."extractedMake" IS NOT NULL AND TRIM(l."extractedMake") != \'\'')
            .andWhere('l."deletedAt" IS NULL')
            .orderBy('l."extractedMake"', 'ASC')
            .getRawMany();
        return rows.map((r) => r.make);
    }
    async getFilterModels(make) {
        const qb = this.listingRepo
            .createQueryBuilder('l')
            .select('DISTINCT l."extractedModel"', 'model')
            .where('l."extractedModel" IS NOT NULL AND TRIM(l."extractedModel") != \'\'')
            .andWhere('l."deletedAt" IS NULL');
        if (make?.trim()) {
            qb.andWhere('l."extractedMake" ILIKE :make', {
                make: `%${make.trim()}%`,
            });
        }
        qb.orderBy('l."extractedModel"', 'ASC');
        const rows = await qb.getRawMany();
        return rows.map((r) => r.model);
    }
    async getFilterCategories() {
        const rows = await this.listingRepo
            .createQueryBuilder('l')
            .select('DISTINCT l."categoryName"', 'category')
            .where('l."categoryName" IS NOT NULL AND TRIM(l."categoryName") != \'\'')
            .andWhere('l."deletedAt" IS NULL')
            .orderBy('l."categoryName"', 'ASC')
            .getRawMany();
        return rows.map((r) => r.category);
    }
    async listFacets(query, user) {
        const teamScopeIds = await this.resolveTeamScopeIds(user, query.teamIds);
        const buildWhere = (exclude) => {
            const clauses = ['l."deletedAt" IS NULL'];
            const params = [];
            let idx = 1;
            const addParam = (sql, val) => {
                clauses.push(sql.replace('$?', `$${idx++}`));
                params.push(val);
            };
            if (teamScopeIds !== null) {
                if (teamScopeIds.length === 0) {
                    clauses.push('1 = 0');
                }
                else {
                    clauses.push(`l."team_id" IN (${teamScopeIds.map(() => `$${idx++}`).join(',')})`);
                    params.push(...teamScopeIds);
                }
            }
            if (exclude !== 'status' && query.status)
                addParam('l.status = $?', query.status);
            if (exclude !== 'search' && query.search?.trim()) {
                const term = `%${query.search.trim()}%`;
                clauses.push(`(l."customLabelSku" ILIKE $${idx} OR l.title ILIKE $${idx} OR l."cBrand" ILIKE $${idx} OR l."cOeOemPartNumber" ILIKE $${idx} OR l."cManufacturerPartNumber" ILIKE $${idx})`);
                params.push(term);
                idx++;
            }
            if (exclude !== 'missingImages' && query.missingImages) {
                clauses.push(`(l."itemPhotoUrl" IS NULL OR TRIM(l."itemPhotoUrl") = '' OR l."itemPhotoUrl" NOT LIKE '%|%')`);
            }
            if (exclude !== 'dateRange' && query.dateAddedFrom)
                addParam(`l."importedAt" >= $?::timestamptz`, query.dateAddedFrom);
            if (exclude !== 'dateRange' && query.dateAddedTo)
                addParam(`l."importedAt" <= $?::timestamptz`, query.dateAddedTo);
            if (exclude !== 'brand' && query.brand?.trim())
                addParam(`l."cBrand" ILIKE $?`, `%${query.brand.trim()}%`);
            if (exclude !== 'make' && query.make?.trim())
                addParam(`l."extractedMake" ILIKE $?`, `%${query.make.trim()}%`);
            if (exclude !== 'model' && query.model?.trim())
                addParam(`l."extractedModel" ILIKE $?`, `%${query.model.trim()}%`);
            if (exclude !== 'category' && query.category?.trim())
                addParam(`l."categoryName" ILIKE $?`, `%${query.category.trim()}%`);
            if (exclude !== 'brands' && query.brands?.trim()) {
                const vals = query.brands
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (vals.length) {
                    clauses.push(`l."cBrand" IN (${vals.map(() => `$${idx++}`).join(',')})`);
                    params.push(...vals);
                }
            }
            if (exclude !== 'conditions' && query.conditions?.trim()) {
                const vals = query.conditions
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (vals.length) {
                    clauses.push(`l."conditionId" IN (${vals.map(() => `$${idx++}`).join(',')})`);
                    params.push(...vals);
                }
            }
            if (exclude !== 'teamIds' && query.teamIds?.trim()) {
                const vals = query.teamIds
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (vals.length) {
                    clauses.push(`l."team_id" IN (${vals.map(() => `$${idx++}`).join(',')})`);
                    params.push(...vals);
                }
            }
            if (exclude !== 'locations' && query.locations?.trim()) {
                const vals = query.locations
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (vals.length) {
                    clauses.push(`l."location" IN (${vals.map(() => `$${idx++}`).join(',')})`);
                    params.push(...vals);
                }
            }
            if (exclude !== 'marketplaces' && query.marketplaces?.trim()) {
                const vals = query.marketplaces
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (vals.length) {
                    clauses.push(`l."marketplace" IN (${vals.map(() => `$${idx++}`).join(',')})`);
                    params.push(...vals);
                }
            }
            if (exclude !== 'stockLevel' && query.stockLevel?.trim()) {
                const vals = query.stockLevel
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                const sc = [];
                if (vals.includes('in_stock'))
                    sc.push(`(l."quantityNum" > 2)`);
                if (vals.includes('low_stock'))
                    sc.push(`(l."quantityNum" >= 1 AND l."quantityNum" <= 2)`);
                if (vals.includes('out_of_stock'))
                    sc.push(`(l."quantityNum" IS NULL OR l."quantityNum" <= 0)`);
                if (sc.length)
                    clauses.push(`(${sc.join(' OR ')})`);
            }
            if (exclude !== 'priceRange') {
                if (query.minPrice != null)
                    addParam(`l."startPriceNum" >= $?`, query.minPrice);
                if (query.maxPrice != null)
                    addParam(`l."startPriceNum" <= $?`, query.maxPrice);
            }
            if (exclude !== 'weightRange') {
                if (query.minWeight != null)
                    addParam(`l."weight" >= $?`, query.minWeight);
                if (query.maxWeight != null)
                    addParam(`l."weight" <= $?`, query.maxWeight);
            }
            if (exclude !== 'hasPrice' && query.hasPrice === '1') {
                clauses.push(inventoryHasPriceSql('l'));
            }
            return { sql: clauses.join(' AND '), params };
        };
        const facetQuery = async (exclude, selectExpr, groupCol, extraWhere) => {
            const { sql, params } = buildWhere(exclude);
            const ew = extraWhere ? ` AND ${extraWhere}` : '';
            const fq = `
        WITH filtered AS (SELECT l.* FROM listing_records l WHERE ${sql}),
        ranked AS (
          SELECT f.*, ROW_NUMBER() OVER (
            PARTITION BY COALESCE(f."customLabelSku", f.id::text)
            ORDER BY CASE WHEN f."origin" = 'add_part' THEN 0 ELSE 1 END,
                     CASE WHEN f.marketplace IS NULL THEN 0 ELSE 1 END, f."importedAt" DESC
          ) AS rn FROM filtered f
        )
        SELECT ${selectExpr} AS value, COUNT(*)::int AS count
        FROM ranked f WHERE rn = 1 AND ${groupCol} IS NOT NULL AND TRIM(${groupCol}::text) != '' ${ew}
        GROUP BY ${groupCol} ORDER BY count DESC LIMIT 100
      `;
            return this.listingRepo.query(fq, params);
        };
        const teamFacetQuery = async () => {
            const { sql, params } = buildWhere('teamIds');
            const fq = `
        WITH filtered AS (SELECT l.* FROM listing_records l WHERE ${sql}),
        ranked AS (
          SELECT f.*, ROW_NUMBER() OVER (
            PARTITION BY COALESCE(f."customLabelSku", f.id::text)
            ORDER BY CASE WHEN f."origin" = 'add_part' THEN 0 ELSE 1 END,
                     CASE WHEN f.marketplace IS NULL THEN 0 ELSE 1 END, f."importedAt" DESC
          ) AS rn FROM filtered f
        )
        SELECT f."team_id" AS value, COUNT(*)::int AS count, t.name AS label, t.color
        FROM ranked f LEFT JOIN teams t ON t.id = f."team_id"
        WHERE f.rn = 1 AND f."team_id" IS NOT NULL
        GROUP BY f."team_id", t.name, t.color ORDER BY count DESC LIMIT 100
      `;
            return this.listingRepo.query(fq, params);
        };
        const marketplaceFacetQuery = async () => {
            const { sql, params } = buildWhere('marketplaces');
            const fq = `
        SELECT l."marketplace" AS value, COUNT(DISTINCT COALESCE(l."customLabelSku", l.id::text))::int AS count
        FROM listing_records l
        WHERE ${sql} AND l."marketplace" IS NOT NULL AND TRIM(l."marketplace") != ''
        GROUP BY l."marketplace" ORDER BY count DESC LIMIT 100
      `;
            return this.listingRepo.query(fq, params);
        };
        const stockFacetQuery = async () => {
            const { sql, params } = buildWhere('stockLevel');
            const fq = `
        WITH filtered AS (SELECT l.* FROM listing_records l WHERE ${sql}),
        ranked AS (
          SELECT f.*, ROW_NUMBER() OVER (
            PARTITION BY COALESCE(f."customLabelSku", f.id::text)
            ORDER BY CASE WHEN f."origin" = 'add_part' THEN 0 ELSE 1 END,
                     CASE WHEN f.marketplace IS NULL THEN 0 ELSE 1 END, f."importedAt" DESC
          ) AS rn FROM filtered f
        )
        SELECT value, COUNT(*)::int AS count FROM (
          SELECT CASE
            WHEN "quantityNum" > 2 THEN 'in_stock'
            WHEN "quantityNum" >= 1 AND "quantityNum" <= 2 THEN 'low_stock'
            ELSE 'out_of_stock'
          END AS value FROM ranked WHERE rn = 1
        ) sub GROUP BY value
      `;
            return this.listingRepo.query(fq, params);
        };
        const summaryQuery = async () => {
            const { sql, params } = buildWhere();
            const sq = `
        WITH filtered AS (SELECT l.* FROM listing_records l WHERE ${sql}),
        ranked AS (
          SELECT f.*, ROW_NUMBER() OVER (
            PARTITION BY COALESCE(f."customLabelSku", f.id::text)
            ORDER BY CASE WHEN f."origin" = 'add_part' THEN 0 ELSE 1 END,
                     CASE WHEN f.marketplace IS NULL THEN 0 ELSE 1 END, f."importedAt" DESC
          ) AS rn FROM filtered f
        )
        SELECT COUNT(*)::int AS total,
               COALESCE(MIN("startPriceNum"), 0)::float AS "minPrice",
               COALESCE(MAX("startPriceNum"), 0)::float AS "maxPrice",
               COALESCE(MIN(weight), 0)::float AS "minWeight",
               COALESCE(MAX(weight), 0)::float AS "maxWeight"
        FROM ranked WHERE rn = 1
      `;
            const rows = await this.listingRepo.query(sq, params);
            return (rows[0] ?? {
                total: 0,
                minPrice: 0,
                maxPrice: 0,
                minWeight: 0,
                maxWeight: 0,
            });
        };
        const [brands, conditions, locations, marketplaces, makes, models, categories, statuses, teams, stockLevels, summary,] = await Promise.all([
            facetQuery('brands', 'f."cBrand"', 'f."cBrand"'),
            facetQuery('conditions', 'f."conditionId"', 'f."conditionId"'),
            facetQuery('locations', 'f."location"', 'f."location"'),
            marketplaceFacetQuery(),
            facetQuery('make', 'f."extractedMake"', 'f."extractedMake"'),
            facetQuery('model', 'f."extractedModel"', 'f."extractedModel"'),
            facetQuery('category', 'f."categoryName"', 'f."categoryName"'),
            facetQuery('status', 'f."status"', 'f."status"'),
            teamFacetQuery(),
            stockFacetQuery(),
            summaryQuery(),
        ]);
        return {
            brands,
            conditions,
            locations,
            marketplaces,
            makes,
            models,
            categories,
            statuses,
            teams,
            stockLevels,
            totalFiltered: summary.total,
            priceRange: { min: summary.minPrice, max: summary.maxPrice },
            weightRange: { min: summary.minWeight, max: summary.maxWeight },
        };
    }
    async sendToCatalog(listingIds) {
        const uniqueIds = [...new Set(listingIds)];
        const listings = await this.listingRepo.find({
            where: { id: (0, typeorm_2.In)(uniqueIds) },
        });
        const results = [];
        for (const listing of listings) {
            const sku = listing.customLabelSku;
            if (!sku) {
                results.push({
                    listingId: listing.id,
                    sku: '',
                    catalogProductId: null,
                    success: false,
                    error: 'No SKU',
                });
                continue;
            }
            try {
                const imageUrls = parseImageUrls(listing.itemPhotoUrl);
                let product = await this.productRepo.findOne({ where: { sku } });
                if (product) {
                    product.title = listing.title ?? product.title;
                    product.brand = listing.cBrand ?? product.brand;
                    product.description = listing.description ?? product.description;
                    product.categoryName = listing.categoryName ?? product.categoryName;
                    product.categoryId = listing.categoryId ?? product.categoryId;
                    product.price = listing.startPriceNum ?? product.price;
                    product.quantity = listing.quantityNum ?? product.quantity;
                    product.conditionId = listing.conditionId ?? product.conditionId;
                    product.mpn = listing.cManufacturerPartNumber ?? product.mpn;
                    product.oemPartNumber =
                        listing.cOeOemPartNumber ?? product.oemPartNumber;
                    product.partType = listing.cType ?? product.partType;
                    product.features = listing.cFeatures ?? product.features;
                    if (imageUrls.length > 0)
                        product.imageUrls = imageUrls;
                    if (listing.extractedMake)
                        product.donorMake = listing.extractedMake;
                    product.optimizationStatus = 'completed';
                    await this.productRepo.save(product);
                }
                else {
                    const newProduct = this.productRepo.create({
                        sku,
                        title: listing.title ?? `SKU ${sku}`,
                        brand: listing.cBrand,
                        mpn: listing.cManufacturerPartNumber,
                        oemPartNumber: listing.cOeOemPartNumber,
                        description: listing.description,
                        categoryName: listing.categoryName,
                        categoryId: listing.categoryId,
                        price: listing.startPriceNum ?? 0,
                        quantity: listing.quantityNum ?? 1,
                        conditionId: listing.conditionId ?? 'Used',
                        partType: listing.cType,
                        features: listing.cFeatures,
                        importId: `inline:${listing.id}`,
                        sourceFile: listing.sourceFileName,
                        sourceRow: listing.sourceRowNumber,
                        optimizationStatus: 'completed',
                        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
                    });
                    product = await this.productRepo.save(newProduct);
                }
                results.push({
                    listingId: listing.id,
                    sku,
                    catalogProductId: product.id,
                    success: true,
                });
                this.logger.log(`Send to catalog: ${product ? 'updated' : 'created'} product for SKU ${sku}`);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.error(`Send to catalog failed for listing ${listing.id} (SKU ${sku}): ${msg}`);
                results.push({
                    listingId: listing.id,
                    sku: sku ?? '',
                    catalogProductId: null,
                    success: false,
                    error: msg,
                });
            }
        }
        return { results };
    }
    async softDeleteListing(listingId) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing) {
            throw new common_1.NotFoundException(`Listing ${listingId} not found`);
        }
        await this.listingRepo.softRemove(listing);
        return { success: true };
    }
    async bulkSoftDeleteListings(ids) {
        if (!ids.length) {
            throw new common_1.BadRequestException('No listing ids provided');
        }
        const listings = await this.listingRepo.findBy({ id: (0, typeorm_2.In)(ids) });
        if (!listings.length) {
            throw new common_1.NotFoundException('No listings found for given IDs');
        }
        await this.listingRepo.softRemove(listings);
        return { deleted: listings.length };
    }
};
exports.InventoryWorkbenchService = InventoryWorkbenchService;
exports.InventoryWorkbenchService = InventoryWorkbenchService = InventoryWorkbenchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(1, (0, typeorm_1.InjectRepository)(part_fitment_entity_js_1.PartFitment)),
    __param(2, (0, typeorm_1.InjectRepository)(pipeline_job_entity_js_1.PipelineJob)),
    __param(3, (0, typeorm_1.InjectRepository)(image_asset_entity_js_1.ImageAsset)),
    __param(4, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(5, (0, typeorm_1.InjectRepository)(ebay_listing_channel_entity_js_1.EbayListingChannel)),
    __param(6, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(18, (0, bullmq_1.InjectQueue)('listing-optimization')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        single_listing_form_service_js_1.SingleListingFormService,
        pipeline_service_js_1.PipelineService,
        inventory_auto_trigger_service_js_1.InventoryAutoTriggerService,
        listing_generation_pipeline_js_1.ListingGenerationPipeline,
        enrichment_pipeline_js_1.EnrichmentPipeline,
        model_router_js_1.ModelRouter,
        ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService,
        part_identification_service_js_1.PartIdentificationService,
        fitment_discovery_service_js_1.FitmentDiscoveryService,
        storage_service_js_1.StorageService,
        vin_decode_service_js_1.VinDecodeService, Function, teams_service_js_1.TeamsService,
        rbac_service_js_1.RbacService])
], InventoryWorkbenchService);
//# sourceMappingURL=inventory-workbench.service.js.map