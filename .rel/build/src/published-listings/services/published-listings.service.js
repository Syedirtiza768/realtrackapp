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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsService = exports.LIVE_SYNC_SKEW_MS = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const channel_webhook_log_entity_js_1 = require("../../channels/entities/channel-webhook-log.entity.js");
const store_entity_js_1 = require("../../channels/entities/store.entity.js");
const store_access_service_js_1 = require("../../channels/store-access.service.js");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
const connected_ebay_account_entity_js_1 = require("../../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_published_listing_entity_js_1 = require("../entities/ebay-published-listing.entity.js");
const ebay_published_listing_sync_log_entity_js_1 = require("../entities/ebay-published-listing-sync-log.entity.js");
const store_slug_util_js_1 = require("../store-slug.util.js");
const published_listings_response_util_js_1 = require("../published-listings-response.util.js");
const published_listings_enrichment_service_js_1 = require("./published-listings-enrichment.service.js");
const published_listings_health_service_js_1 = require("./published-listings-health.service.js");
const ebay_listing_images_util_js_1 = require("../../channels/ebay/ebay-listing-images.util.js");
const webhook_signature_js_1 = require("../../integrations/motoark/webhook-signature.js");
exports.LIVE_SYNC_SKEW_MS = 6 * 60 * 60 * 1000;
const STORE_SYNC_STALE_AFTER_HOURS = Math.max(1, Number(process.env.PUBLISHED_LISTINGS_SYNC_STALE_AFTER_HOURS ?? 24) || 24);
const STORE_SYNC_STALE_MS = STORE_SYNC_STALE_AFTER_HOURS * 60 * 60 * 1000;
let PublishedListingsService = class PublishedListingsService {
    listingRepo;
    catalogProductRepo;
    webhookLogRepo;
    storeRepo;
    accountRepo;
    syncLogRepo;
    storeAccess;
    enrichment;
    health;
    constructor(listingRepo, catalogProductRepo, webhookLogRepo, storeRepo, accountRepo, syncLogRepo, storeAccess, enrichment, health) {
        this.listingRepo = listingRepo;
        this.catalogProductRepo = catalogProductRepo;
        this.webhookLogRepo = webhookLogRepo;
        this.storeRepo = storeRepo;
        this.accountRepo = accountRepo;
        this.syncLogRepo = syncLogRepo;
        this.storeAccess = storeAccess;
        this.enrichment = enrichment;
        this.health = health;
    }
    async resolvePrimemotiveStoreId(organizationId) {
        const [organizationStores, accounts, listingStoreRows] = await Promise.all([
            this.storeRepo.find({ where: { organizationId, channel: 'ebay' } }),
            this.accountRepo.find({
                where: { organizationId },
                relations: ['primaryStore'],
            }),
            this.listingRepo
                .createQueryBuilder('listing')
                .innerJoin(store_entity_js_1.Store, 'store', 'store.id = listing.storeId')
                .select('DISTINCT store.id', 'storeId')
                .where('listing.organizationId = :organizationId', {
                organizationId,
            })
                .andWhere('store.channel = :channel', { channel: 'ebay' })
                .andWhere('LOWER(BTRIM(store.store_name)) = :storeName', {
                storeName: 'primemotive',
            })
                .getRawMany(),
        ]);
        const matchesPrimemotive = (store) => store?.channel === 'ebay' &&
            store.storeName.trim().toLowerCase() === 'primemotive';
        const storeIds = new Set([
            ...organizationStores.filter(matchesPrimemotive).map((store) => store.id),
            ...accounts
                .map((account) => account.primaryStore)
                .filter(matchesPrimemotive)
                .map((store) => store.id),
            ...listingStoreRows.map((row) => row.storeId),
        ]);
        if (storeIds.size === 0) {
            throw new common_1.NotFoundException('Primemotive eBay store was not found for this organization');
        }
        if (storeIds.size > 1) {
            throw new common_1.ConflictException('Multiple Primemotive eBay stores were found for this organization');
        }
        return [...storeIds][0];
    }
    async listPrimemotive(organizationId, user, query) {
        const storeId = await this.resolvePrimemotiveStoreId(organizationId);
        return this.list(organizationId, user, {
            ...query,
            storeId,
            storeSlug: undefined,
            status: 'all',
        }, { requirePublishedActiveRecord: true });
    }
    async list(organizationId, user, query, constraints = {}) {
        const accessibleStores = await this.storeAccess.getAccessibleStoreIds(user);
        const page = query.page ?? 1;
        const limit = Math.min(query.limit ?? 50, 200);
        const offset = (page - 1) * limit;
        const qb = await this.buildListQuery(organizationId, user, query, accessibleStores, constraints.requirePublishedActiveRecord);
        if (query.afterId) {
            if (!constraints.requirePublishedActiveRecord || page !== 1 || query.sortBy || query.sortDir)
                throw new common_1.BadRequestException('afterId requires the dedicated Primemotive feed without page/sort overrides');
            qb.andWhere('l.id > :afterId', { afterId: query.afterId }).orderBy('l.id', 'ASC');
        }
        const [items, total] = await qb.skip(query.afterId ? 0 : offset).take(limit).getManyAndCount();
        const cursor = query.afterId ? { nextId: items.at(-1)?.id ?? query.afterId, hasMore: total > items.length } : {};
        if (query.includeCatalogData !== 'true') {
            return { items, total, page, limit, ...cursor };
        }
        const catalogProducts = await this.loadCatalogProducts(items
            .map((listing) => listing.catalogProductId)
            .filter((id) => Boolean(id)), organizationId);
        const catalogById = new Map(catalogProducts.map((product) => [product.id, product]));
        return {
            items: items.map((listing) => (0, published_listings_response_util_js_1.toPublishedListingApiResponse)(listing, {
                includeCatalogData: true,
                catalogData: listing.catalogProductId
                    ? catalogById.has(listing.catalogProductId)
                        ? (0, published_listings_response_util_js_1.toPublishedListingCatalogData)(catalogById.get(listing.catalogProductId))
                        : null
                    : null,
            })),
            total,
            page,
            limit,
            ...cursor,
        };
    }
    async recordPrimemotiveSaleEvent(organizationId, user, dto, rawBody, timestampHeader, signatureHeader) {
        (0, webhook_signature_js_1.verifyWebhook)(process.env.PRIMEMOTIVE_SALES_WEBHOOK_SECRET, rawBody, timestampHeader, signatureHeader);
        const listing = await this.listingRepo.findOne({
            where: { id: dto.listingId, organizationId },
            relations: ['store'],
        });
        if (!listing?.store ||
            listing.store.channel !== 'ebay' ||
            listing.store.storeName.trim().toLowerCase() !== 'primemotive') {
            throw new common_1.NotFoundException('Primemotive published listing not found');
        }
        await this.assertListingAccess(user, listing.storeId);
        const externalId = `${organizationId}:${dto.eventId}`;
        const payload = {
            organizationId,
            storeId: listing.storeId,
            listingId: listing.id,
            eventId: dto.eventId,
            eventType: dto.eventType,
            soldAt: dto.soldAt,
            quantity: dto.quantity,
            externalOrderId: dto.externalOrderId,
            unitPrice: dto.unitPrice,
            currency: dto.currency,
        };
        const hash = (0, webhook_signature_js_1.payloadHash)(payload);
        return this.webhookLogRepo.manager.transaction(async (em) => {
            await em.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`primemotive-sale:${externalId}`]);
            const [receipt] = await em.query('SELECT * FROM primemotive_sale_receipts WHERE organization_id=$1 AND event_id=$2', [organizationId, dto.eventId]);
            if (receipt) {
                if (receipt.payload_hash !== hash)
                    throw new common_1.ConflictException('Event ID was already used with a different payload');
                return { status: 'duplicate', eventId: dto.eventId, listingId: receipt.listing_id, receivedAt: new Date(receipt.received_at).toISOString() };
            }
            const logs = em.getRepository(channel_webhook_log_entity_js_1.ChannelWebhookLog);
            const existing = await logs.findOne({ where: { channel: 'primemotive', eventType: 'listing.sold', externalId } });
            if (existing && (0, webhook_signature_js_1.payloadHash)(existing.payload) !== hash)
                throw new common_1.ConflictException('Event ID was already used with a different payload');
            const receivedAt = existing?.createdAt ?? new Date();
            await em.query('INSERT INTO primemotive_sale_receipts(organization_id,event_id,listing_id,payload_hash,received_at) VALUES($1,$2,$3,$4,$5)', [organizationId, dto.eventId, listing.id, hash, receivedAt]);
            if (!existing)
                await logs.save(logs.create({ channel: 'primemotive', eventType: dto.eventType, externalId, payload, processingStatus: 'processed', processedAt: receivedAt }));
            return { status: existing ? 'duplicate' : 'accepted', eventId: dto.eventId, listingId: listing.id, receivedAt: receivedAt.toISOString() };
        });
    }
    async listPrimemotiveSalesEvents(organizationId, user, query) {
        const page = query.page ?? 1;
        const limit = Math.min(query.limit ?? 50, 200);
        const qb = this.webhookLogRepo
            .createQueryBuilder('event')
            .where('event.channel = :channel', { channel: 'primemotive' })
            .andWhere('event.eventType = :eventType', { eventType: 'listing.sold' })
            .andWhere("event.payload ->> 'organizationId' = :organizationId", {
            organizationId,
        });
        if (!user.storeAccessAll) {
            const accessibleStores = await this.storeAccess.getAccessibleStoreIds(user);
            if (accessibleStores.size === 0) {
                qb.andWhere('1 = 0');
            }
            else {
                qb.andWhere("event.payload ->> 'storeId' IN (:...storeIds)", {
                    storeIds: [...accessibleStores],
                });
            }
        }
        const [items, total] = await qb
            .orderBy('event.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();
        return { items, total, page, limit };
    }
    async exportCsv(organizationId, user, query) {
        const accessibleStores = await this.storeAccess.getAccessibleStoreIds(user);
        const exportQuery = { ...query, status: query.status ?? 'all' };
        const qb = await this.buildListQuery(organizationId, user, exportQuery, accessibleStores);
        const exportPage = query.page ?? 1;
        const exportPageSize = 10000;
        qb.skip((exportPage - 1) * exportPageSize).take(exportPageSize);
        const items = await qb.getMany();
        const headers = [
            'eBay Item ID',
            'Title',
            'SKU',
            'Price',
            'Currency',
            'Qty Available',
            'Qty Sold',
            'Status',
            'Format',
            'Condition',
            'Category',
            'Store',
            'Account',
            'Marketplace',
            'Listing URL',
            'Brand',
            'MPN',
            'OE Numbers',
            'Listed From',
            'Listed Until',
            'Last Synced',
        ];
        const escape = (v) => {
            if (v == null)
                return '';
            const s = String(v);
            if (s.includes(',') || s.includes('"') || s.includes('\n'))
                return `"${s.replace(/"/g, '""')}"`;
            return s;
        };
        const rows = items.map((r) => {
            const specifics = r.itemSpecifics ?? {};
            const brand = this.firstSpecificFromItem(specifics, [
                'brand',
                'manufacturer',
                'marque',
            ]);
            const mpn = this.firstSpecificFromItem(specifics, [
                'manufacturer part number',
                'mpn',
                'mfr part number',
                'manufacturer part no',
            ]);
            const oeNumbers = this.allSpecificsFromItem(specifics, [
                'oe/oem number',
                'oem number',
                'oe number',
                'oe/oem part number',
                'interchange part number',
                'other part number',
            ]);
            return [
                escape(r.ebayItemId),
                escape(r.title),
                escape(r.sku),
                escape(r.price),
                escape(r.currency),
                escape(r.quantityAvailable),
                escape(r.quantitySold),
                escape(r.listingStatus),
                escape(r.listingFormat),
                escape(r.condition),
                escape(r.categoryName),
                escape(r.accountDisplayName),
                escape(r.accountDisplayName),
                escape(r.marketplaceId),
                escape(r.listingUrl),
                escape(brand),
                escape(mpn),
                escape(oeNumbers.join('; ')),
                escape(r.ebayStartTime),
                escape(r.ebayEndTime),
                escape(r.lastSyncedAt),
            ].join(',');
        });
        return [headers.join(','), ...rows].join('\n');
    }
    firstSpecificFromItem(specifics, keys) {
        const entries = Object.entries(specifics ?? {});
        for (const want of keys) {
            const hit = entries.find(([k]) => k.trim().toLowerCase() === want);
            const vals = hit?.[1];
            if (Array.isArray(vals)) {
                const v = vals.find((x) => typeof x === 'string' && x.trim());
                if (v?.trim())
                    return v.trim();
            }
        }
        return null;
    }
    allSpecificsFromItem(specifics, keys) {
        const out = [];
        const seen = new Set();
        const entries = Object.entries(specifics ?? {});
        for (const want of keys) {
            const hit = entries.find(([k]) => k.trim().toLowerCase() === want);
            const vals = hit?.[1];
            if (Array.isArray(vals)) {
                for (const v of vals) {
                    if (typeof v === 'string' && v.trim()) {
                        const key = v.trim().toLowerCase();
                        if (!seen.has(key)) {
                            seen.add(key);
                            out.push(v.trim());
                        }
                    }
                }
            }
        }
        return out;
    }
    async buildListQuery(organizationId, user, query, accessibleStores, requirePublishedActiveRecord = false) {
        const qb = this.listingRepo
            .createQueryBuilder('l')
            .innerJoin(connected_ebay_account_entity_js_1.ConnectedEbayAccount, 'cea', 'cea.id = l.ebayAccountId')
            .where('l.organizationId = :organizationId', { organizationId });
        if (!user.storeAccessAll) {
            if (accessibleStores.size === 0) {
                qb.andWhere('1 = 0');
            }
            else {
                qb.andWhere('l.storeId IN (:...storeIds)', {
                    storeIds: [...accessibleStores],
                });
            }
        }
        if (query.ebayAccountId) {
            qb.andWhere('l.ebayAccountId = :ebayAccountId', {
                ebayAccountId: query.ebayAccountId,
            });
        }
        if (query.storeId) {
            qb.andWhere('l.storeId = :storeId', { storeId: query.storeId });
        }
        if (requirePublishedActiveRecord) {
            qb.andWhere("l.listingStatus = 'active'")
                .andWhere('l.ebayItemId IS NOT NULL')
                .andWhere("BTRIM(l.ebayItemId) <> ''");
        }
        const slugStoreIds = await this.resolveStoreSlugIds(organizationId, this.resolveListStoreSlugFilter(query));
        if (slugStoreIds) {
            if (slugStoreIds.length === 0) {
                qb.andWhere('1 = 0');
            }
            else {
                qb.andWhere('l.storeId IN (:...slugStoreIds)', { slugStoreIds });
            }
        }
        if (query.offerId) {
            qb.andWhere('l.offerId = :offerId', { offerId: query.offerId });
        }
        if (query.marketplaceId) {
            qb.andWhere('l.marketplaceId = :marketplaceId', {
                marketplaceId: query.marketplaceId,
            });
        }
        const status = query.status ?? 'active';
        if (status !== 'all') {
            qb.andWhere('l.listingStatus = :status', { status });
        }
        if (status === 'active') {
            qb.andWhere("cea.connectionStatus = 'active'");
            qb.andWhere('cea.lastSuccessfulSyncAt IS NOT NULL');
            qb.andWhere('l.lastSyncedAt IS NOT NULL');
            qb.andWhere(`l.lastSyncedAt >= cea.lastSuccessfulSyncAt - INTERVAL '${exports.LIVE_SYNC_SKEW_MS / 1000} seconds'`);
            qb.andWhere('l.quantityAvailable > 0');
        }
        if (query.format) {
            qb.andWhere('l.listingFormat = :format', { format: query.format });
        }
        if (query.condition) {
            qb.andWhere('l.condition ILIKE :condition', {
                condition: `%${query.condition}%`,
            });
        }
        if (query.categoryId) {
            qb.andWhere('l.categoryId = :categoryId', {
                categoryId: query.categoryId,
            });
        }
        if (query.priceMin != null) {
            qb.andWhere('l.price >= :priceMin', { priceMin: query.priceMin });
        }
        if (query.priceMax != null) {
            qb.andWhere('l.price <= :priceMax', { priceMax: query.priceMax });
        }
        if (query.quantityMin != null) {
            qb.andWhere('l.quantityAvailable >= :quantityMin', {
                quantityMin: query.quantityMin,
            });
        }
        if (query.quantityMax != null) {
            qb.andWhere('l.quantityAvailable <= :quantityMax', {
                quantityMax: query.quantityMax,
            });
        }
        if (query.soldMin != null) {
            qb.andWhere('l.quantitySold >= :soldMin', { soldMin: query.soldMin });
        }
        if (query.listedFrom) {
            qb.andWhere('l.ebayStartTime >= :listedFrom', {
                listedFrom: query.listedFrom,
            });
        }
        if (query.listedTo) {
            qb.andWhere('l.ebayStartTime <= :listedTo', { listedTo: query.listedTo });
        }
        const updatedAfter = query.updatedAfter ?? query.updateAfter;
        if (updatedAfter) {
            qb.andWhere('l.updatedAt >= :updatedAfter', {
                updatedAfter,
            });
        }
        if (query.lowStock === 'true') {
            qb.andWhere('l.quantityAvailable > 0 AND l.quantityAvailable <= 3');
        }
        if (query.lowStock === 'out') {
            qb.andWhere('l.quantityAvailable <= 0');
        }
        if (query.search?.trim()) {
            const term = `%${query.search.trim()}%`;
            qb.andWhere(new typeorm_2.Brackets((sub) => {
                sub
                    .where('l.title ILIKE :term', { term })
                    .orWhere('l.sku ILIKE :term', { term })
                    .orWhere('l.ebayItemId ILIKE :term', { term })
                    .orWhere('l.categoryName ILIKE :term', { term })
                    .orWhere('l.accountDisplayName ILIKE :term', { term })
                    .orWhere('l.item_specifics::text ILIKE :term', { term });
            }));
        }
        const sortMap = {
            price: 'l.price',
            sales: 'l.quantitySold',
            quantity: 'l.quantityAvailable',
            created: 'l.createdAt',
            updated: 'l.updatedAt',
            title: 'l.title',
            synced: 'l.lastSyncedAt',
            id: 'l.id',
        };
        const sortCol = sortMap[query.sortBy ?? 'updated'] ?? 'l.updatedAt';
        const sortDir = query.sortDir === 'asc' ? 'ASC' : 'DESC';
        qb.orderBy(sortCol, sortDir).addOrderBy('l.id', sortDir);
        return qb;
    }
    resolveListStoreSlugFilter(query) {
        if (query.storeId)
            return undefined;
        if ((0, store_slug_util_js_1.isAllStoresSlugQuery)(query.storeSlug))
            return undefined;
        if (query.storeSlug?.trim())
            return query.storeSlug;
        const defaults = (0, store_slug_util_js_1.resolveDefaultPublishedListingsStoreSlugs)();
        return defaults || undefined;
    }
    async resolveStoreSlugIds(organizationId, storeSlug) {
        if ((0, store_slug_util_js_1.isAllStoresSlugQuery)(storeSlug))
            return null;
        const slugs = (0, store_slug_util_js_1.parseStoreSlugQuery)(storeSlug);
        if (slugs.length === 0)
            return null;
        const ids = new Set();
        for (const slug of slugs) {
            for (const id of store_slug_util_js_1.EBAY_STORE_SLUG_ALIASES[slug] ?? []) {
                ids.add(id);
            }
        }
        const stores = await this.storeRepo
            .createQueryBuilder('s')
            .where('s.organization_id = :organizationId', { organizationId })
            .andWhere(new typeorm_2.Brackets((sub) => {
            sub
                .where(`LOWER(COALESCE(s.config->>'storeSlug', '')) IN (:...slugs)`, { slugs })
                .orWhere(`LOWER(COALESCE(s.store_url, '')) LIKE ANY(ARRAY[:...urlPatterns])`, {
                urlPatterns: slugs.map((s) => `%/str/${s}%`),
            });
        }))
            .getMany();
        for (const store of stores) {
            ids.add(store.id);
        }
        if (ids.size === 0) {
            throw new common_1.BadRequestException(`No stores matched storeSlug="${slugs.join(',')}"`);
        }
        return [...ids];
    }
    async getById(id, organizationId, user, includeCatalogData = false) {
        let listing = await this.listingRepo.findOne({
            where: { id, organizationId },
        });
        if (!listing)
            throw new common_1.NotFoundException('Published listing not found');
        await this.assertListingAccess(user, listing.storeId);
        listing = await this.maybeEnrichDetailOnDemand(listing);
        const storeSlug = await this.resolveStoreSlugForId(listing.storeId);
        if (!includeCatalogData) {
            return (0, published_listings_response_util_js_1.toPublishedListingApiResponse)(listing, { storeSlug });
        }
        const catalogProduct = listing.catalogProductId
            ? (await this.loadCatalogProducts([listing.catalogProductId], organizationId))[0] ?? null
            : null;
        return (0, published_listings_response_util_js_1.toPublishedListingApiResponse)(listing, {
            storeSlug,
            includeCatalogData: true,
            catalogData: catalogProduct
                ? (0, published_listings_response_util_js_1.toPublishedListingCatalogData)(catalogProduct)
                : null,
        });
    }
    async getByIdRaw(id, organizationId, user) {
        const listing = await this.listingRepo.findOne({
            where: { id, organizationId },
        });
        if (!listing)
            throw new common_1.NotFoundException('Published listing not found');
        await this.assertListingAccess(user, listing.storeId);
        return listing;
    }
    async getByIdsRaw(ids, organizationId, user) {
        if (ids.length === 0)
            return [];
        const listings = await this.listingRepo.find({
            where: { id: (0, typeorm_2.In)(ids), organizationId },
        });
        if (listings.length !== ids.length) {
            const found = new Set(listings.map((l) => l.id));
            const missing = ids.filter((id) => !found.has(id));
            throw new common_1.NotFoundException(`Listings not found: ${missing.join(', ')}`);
        }
        for (const listing of listings) {
            await this.assertListingAccess(user, listing.storeId);
        }
        return listings;
    }
    async maybeEnrichDetailOnDemand(listing) {
        const flag = (process.env.PUBLISHED_LISTINGS_ON_DEMAND_ENRICH ?? '').toLowerCase();
        if (flag !== '1' && flag !== 'true' && flag !== 'yes')
            return listing;
        if (!listing.ebayItemId)
            return listing;
        const enrichmentInput = {
            storeId: listing.storeId,
            ebayItemId: listing.ebayItemId,
            sku: listing.sku,
            marketplaceId: listing.marketplaceId,
            listingUrl: listing.listingUrl,
            title: listing.title,
            imageUrls: listing.imageUrls ?? [],
            compatibility: listing.compatibility,
            description: listing.description,
            itemSpecifics: listing.itemSpecifics ?? {},
            skipTrading: true,
        };
        if (!this.enrichment.needsEnrichment(enrichmentInput))
            return listing;
        try {
            const result = await this.enrichment.enrichListing(enrichmentInput);
            if (result.sources.length === 0)
                return listing;
            const nextImages = (0, ebay_listing_images_util_js_1.preferRicherImageUrls)(result.imageUrls, listing.imageUrls);
            const imagesImproved = nextImages.length > (listing.imageUrls?.length ?? 0);
            const descriptionImproved = Boolean(result.description?.trim()) &&
                result.description?.trim() !== listing.description?.trim();
            const titleImproved = Boolean(result.title?.trim()) &&
                result.title?.trim() !== listing.title?.trim();
            const listingUrlImproved = Boolean(result.listingUrl?.trim()) &&
                result.listingUrl?.trim() !== listing.listingUrl?.trim();
            const specificsImproved = Object.keys(result.itemSpecifics ?? {}).length >
                Object.keys(listing.itemSpecifics ?? {}).length;
            const compatImproved = result.compatibility != null &&
                Array.isArray(result.compatibility
                    .compatibleProducts) &&
                !(listing.compatibility != null &&
                    Array.isArray(listing.compatibility
                        .compatibleProducts));
            if (!imagesImproved &&
                !descriptionImproved &&
                !titleImproved &&
                !listingUrlImproved &&
                !specificsImproved &&
                !compatImproved) {
                return listing;
            }
            listing.imageUrls = nextImages;
            if (result.title?.trim())
                listing.title = result.title.trim();
            if (result.listingUrl?.trim())
                listing.listingUrl = result.listingUrl.trim();
            if (result.description?.trim())
                listing.description = result.description;
            if (Object.keys(result.itemSpecifics ?? {}).length > 0) {
                listing.itemSpecifics = result.itemSpecifics;
            }
            if (result.compatibility != null) {
                listing.compatibility = result.compatibility;
            }
            if (result.rawGetItem) {
                listing.rawEbayResponse = {
                    ...(listing.rawEbayResponse ?? {}),
                    pageEnrichment: result.rawGetItem,
                    pageEnrichmentSources: result.sources,
                };
            }
            listing.healthFlags = this.health.computeHealthFlags({
                title: listing.title,
                imageUrls: listing.imageUrls,
                itemSpecifics: listing.itemSpecifics ?? {},
                compatibility: listing.compatibility,
                quantityAvailable: listing.quantityAvailable,
                quantitySold: listing.quantitySold,
                performanceMetrics: listing.performanceMetrics ?? {},
                categoryId: listing.categoryId,
                price: listing.price,
                description: listing.description,
                lastSyncedAt: listing.lastSyncedAt,
            });
            await this.listingRepo.save(listing);
        }
        catch {
        }
        return listing;
    }
    async getSummary(organizationId, user, ebayAccountId) {
        const accessibleStores = await this.storeAccess.getAccessibleStoreIds(user);
        const qb = this.listingRepo
            .createQueryBuilder('l')
            .where('l.organizationId = :organizationId', { organizationId });
        if (!user.storeAccessAll) {
            if (accessibleStores.size === 0) {
                return {
                    total: 0,
                    active: 0,
                    ended: 0,
                    outOfStock: 0,
                    withWarnings: 0,
                    lastSyncedAt: null,
                };
            }
            qb.andWhere('l.storeId IN (:...storeIds)', {
                storeIds: [...accessibleStores],
            });
        }
        if (ebayAccountId) {
            qb.andWhere('l.ebayAccountId = :ebayAccountId', { ebayAccountId });
        }
        const total = await qb.getCount();
        const active = await qb
            .clone()
            .andWhere("l.listingStatus = 'active'")
            .getCount();
        const ended = await qb
            .clone()
            .andWhere("l.listingStatus = 'ended'")
            .getCount();
        const outOfStock = await qb
            .clone()
            .andWhere("l.listingStatus = 'out_of_stock'")
            .getCount();
        const withWarnings = await qb
            .clone()
            .andWhere('jsonb_array_length(l.health_flags) > 0')
            .getCount();
        const lastRow = await this.listingRepo
            .createQueryBuilder('l')
            .select('MAX(l.lastSyncedAt)', 'max')
            .where('l.organizationId = :organizationId', { organizationId })
            .getRawOne();
        return {
            total,
            active,
            ended,
            outOfStock,
            withWarnings,
            lastSyncedAt: lastRow?.max?.toISOString() ?? null,
        };
    }
    async listStores(organizationId, user) {
        const accessibleStores = await this.storeAccess.getAccessibleStoreIds(user);
        const accounts = await this.accountRepo.find({
            where: { organizationId },
            relations: ['primaryStore'],
        });
        const storeIds = [
            ...new Set(accounts
                .map((a) => a.primaryStoreId)
                .filter((id) => user.storeAccessAll || accessibleStores.has(id))),
        ];
        const listingStoreRows = await this.listingRepo
            .createQueryBuilder('l')
            .select('DISTINCT l.storeId', 'storeId')
            .where('l.organizationId = :organizationId', { organizationId })
            .getRawMany();
        for (const row of listingStoreRows) {
            if (user.storeAccessAll || accessibleStores.has(row.storeId)) {
                storeIds.push(row.storeId);
            }
        }
        const uniqueStoreIds = [...new Set(storeIds)];
        if (uniqueStoreIds.length === 0)
            return { items: [] };
        const stores = await this.storeRepo.find({
            where: { id: (0, typeorm_2.In)(uniqueStoreIds) },
        });
        const storeById = new Map(stores.map((s) => [s.id, s]));
        const accountByStore = new Map(accounts.map((a) => [a.primaryStoreId, a]));
        const accountIds = accounts.map((account) => account.id);
        const latestSuccessfulSyncByAccount = new Map();
        if (accountIds.length > 0) {
            const successfulSyncRows = await this.syncLogRepo
                .createQueryBuilder('log')
                .select('log.ebayAccountId', 'ebayAccountId')
                .addSelect('MAX(COALESCE(log.completedAt, log.startedAt))', 'lastSuccessAt')
                .where('log.organizationId = :organizationId', { organizationId })
                .andWhere('log.ebayAccountId IN (:...accountIds)', { accountIds })
                .andWhere("log.status = 'completed'")
                .andWhere("log.trigger <> 'single'")
                .groupBy('log.ebayAccountId')
                .getRawMany();
            for (const row of successfulSyncRows) {
                if (row.lastSuccessAt) {
                    latestSuccessfulSyncByAccount.set(row.ebayAccountId, new Date(row.lastSuccessAt));
                }
            }
        }
        const countRows = await this.listingRepo
            .createQueryBuilder('l')
            .select('l.storeId', 'storeId')
            .addSelect(`SUM(CASE WHEN l.listingStatus = 'active' AND l.quantityAvailable > 0 THEN 1 ELSE 0 END)`, 'activeCount')
            .addSelect(`SUM(CASE WHEN l.listingStatus = 'ended' THEN 1 ELSE 0 END)`, 'endedCount')
            .addSelect('MAX(l.lastSyncedAt)', 'lastSyncedAt')
            .where('l.organizationId = :organizationId', { organizationId })
            .andWhere('l.storeId IN (:...storeIds)', { storeIds: uniqueStoreIds })
            .groupBy('l.storeId')
            .getRawMany();
        const countsByStore = new Map(countRows.map((r) => [
            r.storeId,
            {
                active: Number(r.activeCount) || 0,
                ended: Number(r.endedCount) || 0,
                lastSyncedAt: r.lastSyncedAt,
            },
        ]));
        const liveActiveByStore = await this.countLiveActiveByStore(organizationId, uniqueStoreIds);
        const items = [];
        for (const storeId of uniqueStoreIds) {
            const store = storeById.get(storeId);
            if (!store)
                continue;
            const account = accountByStore.get(storeId);
            const counts = countsByStore.get(storeId) ?? {
                active: 0,
                ended: 0,
                lastSyncedAt: null,
            };
            const liveActive = liveActiveByStore.get(storeId) ?? 0;
            const successfulSyncAt = [
                account?.lastSuccessfulSyncAt ?? null,
                account ? latestSuccessfulSyncByAccount.get(account.id) ?? null : null,
            ]
                .filter((value) => Boolean(value))
                .sort((a, b) => b.getTime() - a.getTime())[0];
            const syncStatus = this.resolveStoreSyncStatus(account, liveActive, successfulSyncAt);
            items.push({
                storeId,
                storeSlug: this.extractStoreSlug(store),
                name: store.storeName,
                activeListingCount: liveActive,
                endedListingCount: counts.ended,
                lastSyncedAt: (successfulSyncAt ?? counts.lastSyncedAt)?.toISOString() ?? null,
                syncStatus,
                ebayAccountId: account?.id ?? null,
                connectionStatus: account?.connectionStatus ?? null,
            });
        }
        items.sort((a, b) => a.name.localeCompare(b.name));
        return { items };
    }
    async getSyncStatus(organizationId, user) {
        const { items: stores } = await this.listStores(organizationId, user);
        const storeIds = stores.map((s) => s.storeId);
        const accountIds = stores
            .map((s) => s.ebayAccountId)
            .filter((id) => Boolean(id));
        const latestFailByAccount = new Map();
        if (accountIds.length > 0) {
            const failLogs = await this.syncLogRepo
                .createQueryBuilder('log')
                .where('log.organizationId = :organizationId', { organizationId })
                .andWhere('log.ebayAccountId IN (:...accountIds)', { accountIds })
                .andWhere("log.status = 'failed'")
                .orderBy('log.startedAt', 'DESC')
                .getMany();
            for (const log of failLogs) {
                if (latestFailByAccount.has(log.ebayAccountId))
                    continue;
                const firstError = Array.isArray(log.errors) ? log.errors[0] : null;
                const message = firstError &&
                    typeof firstError === 'object' &&
                    'message' in firstError
                    ? String(firstError.message ?? '')
                    : null;
                latestFailByAccount.set(log.ebayAccountId, {
                    at: log.completedAt ?? log.startedAt,
                    error: message || 'Published listings sync failed',
                });
            }
        }
        let globalActiveCount = 0;
        const enrichedStores = stores.map((store) => {
            globalActiveCount += store.activeListingCount;
            const fail = store.ebayAccountId
                ? latestFailByAccount.get(store.ebayAccountId)
                : undefined;
            const lastSuccessMs = store.lastSyncedAt
                ? new Date(store.lastSyncedAt).getTime()
                : 0;
            const failedRecently = Boolean(fail) && (!lastSuccessMs || fail.at.getTime() > lastSuccessMs);
            const syncStatus = failedRecently ? 'failed' : store.syncStatus;
            const healthFlags = [];
            if (syncStatus === 'failed')
                healthFlags.push('store_sync_failed');
            if (syncStatus === 'stale')
                healthFlags.push('sync_stale');
            if (store.activeListingCount === 0)
                healthFlags.push('empty_active_mirror');
            return {
                storeId: store.storeId,
                storeSlug: store.storeSlug,
                name: store.name,
                activeCount: store.activeListingCount,
                endedCount: store.endedListingCount,
                lastSuccessAt: store.lastSyncedAt,
                lastErrorAt: fail?.at.toISOString() ?? null,
                lastError: fail?.error ?? null,
                syncStatus,
                healthFlags,
            };
        });
        return {
            organizationId,
            globalActiveCount,
            stores: enrichedStores,
            generatedAt: new Date().toISOString(),
        };
    }
    async countLiveActiveByStore(organizationId, storeIds) {
        if (storeIds.length === 0)
            return new Map();
        const rows = await this.listingRepo
            .createQueryBuilder('l')
            .innerJoin(connected_ebay_account_entity_js_1.ConnectedEbayAccount, 'cea', 'cea.id = l.ebayAccountId')
            .select('l.storeId', 'storeId')
            .addSelect('COUNT(*)', 'cnt')
            .where('l.organizationId = :organizationId', { organizationId })
            .andWhere('l.storeId IN (:...storeIds)', { storeIds })
            .andWhere("l.listingStatus = 'active'")
            .andWhere('l.quantityAvailable > 0')
            .andWhere("cea.connectionStatus = 'active'")
            .andWhere('cea.lastSuccessfulSyncAt IS NOT NULL')
            .andWhere('l.lastSyncedAt IS NOT NULL')
            .andWhere(`l.lastSyncedAt >= cea.lastSuccessfulSyncAt - INTERVAL '${exports.LIVE_SYNC_SKEW_MS / 1000} seconds'`)
            .groupBy('l.storeId')
            .getRawMany();
        return new Map(rows.map((r) => [r.storeId, Number(r.cnt) || 0]));
    }
    resolveStoreSyncStatus(account, liveActive, successfulSyncAt = account?.lastSuccessfulSyncAt) {
        if (!account)
            return 'never_synced';
        if (account.connectionStatus !== 'active')
            return 'inactive';
        if (!successfulSyncAt)
            return 'never_synced';
        const age = Date.now() - successfulSyncAt.getTime();
        if (age > STORE_SYNC_STALE_MS)
            return 'stale';
        void liveActive;
        return 'ok';
    }
    extractStoreSlug(store) {
        const fromConfig = typeof store.config?.storeSlug === 'string'
            ? store.config.storeSlug.trim().toLowerCase()
            : '';
        if (fromConfig)
            return fromConfig;
        const url = store.storeUrl ?? '';
        const match = url.match(/ebay\.com\/str\/([a-z0-9_-]+)/i);
        if (match?.[1])
            return match[1].toLowerCase();
        for (const preferred of [
            'salvagea',
            'blacklineusedautoparts',
            'blackline',
            'salvage',
        ]) {
            if (store_slug_util_js_1.EBAY_STORE_SLUG_ALIASES[preferred]?.includes(store.id)) {
                return preferred;
            }
        }
        for (const [slug, ids] of Object.entries(store_slug_util_js_1.EBAY_STORE_SLUG_ALIASES)) {
            if (ids.includes(store.id))
                return slug;
        }
        return null;
    }
    async resolveStoreSlugForId(storeId) {
        const store = await this.storeRepo.findOne({ where: { id: storeId } });
        return store ? this.extractStoreSlug(store) : null;
    }
    async assertListingAccess(user, storeId) {
        if (user.storeAccessAll)
            return;
        const stores = await this.storeAccess.getAccessibleStoreIds(user);
        if (!stores.has(storeId)) {
            throw new common_1.ForbiddenException('No access to this store listing');
        }
    }
    async loadCatalogProducts(ids, organizationId) {
        const uniqueIds = [...new Set(ids)];
        if (uniqueIds.length === 0)
            return [];
        return this.catalogProductRepo
            .createQueryBuilder('product')
            .select([
            'product.id',
            'product.organizationId',
            'product.sku',
            'product.mpn',
            'product.mpnNormalized',
            'product.upc',
            'product.ean',
            'product.epid',
            'product.title',
            'product.brand',
            'product.partType',
            'product.placement',
            'product.material',
            'product.features',
            'product.countryOfOrigin',
            'product.oemPartNumber',
            'product.weight',
            'product.categoryId',
            'product.categoryName',
            'product.verticalAttributes',
            'product.fitmentData',
            'product.fitmentRows',
        ])
            .where('product.id IN (:...ids)', { ids: uniqueIds })
            .andWhere('(product.organizationId = :organizationId OR product.organizationId IS NULL)', { organizationId })
            .getMany();
    }
};
exports.PublishedListingsService = PublishedListingsService;
exports.PublishedListingsService = PublishedListingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_published_listing_entity_js_1.EbayPublishedListing)),
    __param(1, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(2, (0, typeorm_1.InjectRepository)(channel_webhook_log_entity_js_1.ChannelWebhookLog)),
    __param(3, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(4, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(5, (0, typeorm_1.InjectRepository)(ebay_published_listing_sync_log_entity_js_1.EbayPublishedListingSyncLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        store_access_service_js_1.StoreAccessService,
        published_listings_enrichment_service_js_1.PublishedListingsEnrichmentService,
        published_listings_health_service_js_1.PublishedListingsHealthService])
], PublishedListingsService);
//# sourceMappingURL=published-listings.service.js.map