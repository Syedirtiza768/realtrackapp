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
var PublishedListingsSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsSyncService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_2 = require("typeorm");
const connected_ebay_account_entity_js_1 = require("../../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_listing_channel_entity_js_1 = require("../../integrations/ebay/entities/ebay-listing-channel.entity.js");
const store_entity_js_1 = require("../../channels/entities/store.entity.js");
const ebay_marketplace_headers_util_js_1 = require("../../channels/ebay/ebay-marketplace-headers.util.js");
const ebay_inventory_api_service_js_1 = require("../../channels/ebay/ebay-inventory-api.service.js");
const ebay_trading_api_service_js_1 = require("../../channels/ebay/ebay-trading-api.service.js");
const ebay_browse_api_service_js_1 = require("../../channels/ebay/ebay-browse-api.service.js");
const ebay_published_listing_entity_js_1 = require("../entities/ebay-published-listing.entity.js");
const ebay_published_listing_sync_log_entity_js_1 = require("../entities/ebay-published-listing-sync-log.entity.js");
const ebay_listing_images_util_js_1 = require("../../channels/ebay/ebay-listing-images.util.js");
const published_listings_health_service_js_1 = require("./published-listings-health.service.js");
const published_listings_enrichment_service_js_1 = require("./published-listings-enrichment.service.js");
let PublishedListingsSyncService = PublishedListingsSyncService_1 = class PublishedListingsSyncService {
    accountRepo;
    listingRepo;
    syncLogRepo;
    channelRepo;
    storeRepo;
    inventoryApi;
    tradingApi;
    browseApi;
    health;
    enrichment;
    syncQueue;
    logger = new common_1.Logger(PublishedListingsSyncService_1.name);
    constructor(accountRepo, listingRepo, syncLogRepo, channelRepo, storeRepo, inventoryApi, tradingApi, browseApi, health, enrichment, syncQueue) {
        this.accountRepo = accountRepo;
        this.listingRepo = listingRepo;
        this.syncLogRepo = syncLogRepo;
        this.channelRepo = channelRepo;
        this.storeRepo = storeRepo;
        this.inventoryApi = inventoryApi;
        this.tradingApi = tradingApi;
        this.browseApi = browseApi;
        this.health = health;
        this.enrichment = enrichment;
        this.syncQueue = syncQueue;
    }
    async enqueueSync(input) {
        const accounts = await this.resolveAccounts(input.organizationId, input.ebayAccountId);
        const jobIds = [];
        const syncLogIds = [];
        for (const account of accounts) {
            if (account.connectionStatus !== 'active') {
                throw new common_1.BadRequestException(`Account "${account.accountDisplayName}" is not active (${account.connectionStatus})`);
            }
            const syncLog = await this.syncLogRepo.save(this.syncLogRepo.create({
                organizationId: input.organizationId,
                ebayAccountId: account.id,
                marketplaceId: input.marketplaceId ?? null,
                trigger: input.listingIds?.length
                    ? 'single'
                    : (input.trigger ?? 'manual'),
                status: 'pending',
                triggeredByUserId: input.userId ?? null,
            }));
            const job = await this.syncQueue.add('sync-account', {
                organizationId: input.organizationId,
                ebayAccountId: account.id,
                userId: input.userId ?? null,
                marketplaceId: input.marketplaceId ?? null,
                syncLogId: syncLog.id,
                listingIds: input.listingIds,
                trigger: input.listingIds?.length ? 'single' : 'manual',
                syncMode: input.syncMode,
            }, {
                jobId: `pub-listings-sync-${account.id}-${Date.now()}`,
                removeOnComplete: 100,
                removeOnFail: 200,
            });
            jobIds.push(job.id ?? '');
            syncLogIds.push(syncLog.id);
        }
        return { jobIds, syncLogIds };
    }
    async syncListingById(listingId, organizationId) {
        const local = await this.listingRepo.findOne({
            where: { id: listingId, organizationId },
        });
        if (!local)
            throw new common_1.NotFoundException('Published listing not found');
        const account = await this.accountRepo.findOne({
            where: { id: local.ebayAccountId, organizationId },
        });
        if (!account)
            throw new common_1.NotFoundException('eBay account not found');
        const channelLinks = await this.channelRepo.find({
            where: { organizationId, ebayAccountId: account.id },
        });
        const channelByOffer = new Map();
        const channelByListing = new Map();
        for (const ch of channelLinks) {
            if (ch.offerId)
                channelByOffer.set(ch.offerId, ch);
            if (ch.listingId)
                channelByListing.set(ch.listingId, ch);
        }
        await this.syncSingleListing(account, local, channelByOffer, channelByListing);
        return this.listingRepo.findOneByOrFail({ id: listingId });
    }
    async syncAccount(payload) {
        const syncLog = payload.syncLogId
            ? await this.syncLogRepo.findOneBy({ id: payload.syncLogId })
            : null;
        if (syncLog) {
            syncLog.status = 'running';
            await this.syncLogRepo.save(syncLog);
        }
        const account = await this.accountRepo.findOne({
            where: {
                id: payload.ebayAccountId,
                organizationId: payload.organizationId,
            },
        });
        if (!account) {
            throw new common_1.NotFoundException('eBay account not found');
        }
        const storeId = account.primaryStoreId;
        const store = await this.storeRepo.findOneBy({ id: storeId });
        const accountMarketplaceId = payload.marketplaceId ??
            (store ? (0, ebay_marketplace_headers_util_js_1.resolveMarketplaceId)(store) : 'EBAY_US');
        const errors = [];
        const warnings = [];
        let processed = 0;
        let created = 0;
        let updated = 0;
        let failed = 0;
        let advanceSyncWatermark = false;
        const channelLinks = await this.channelRepo.find({
            where: {
                organizationId: payload.organizationId,
                ebayAccountId: account.id,
            },
        });
        const channelByOffer = new Map();
        const channelByListing = new Map();
        for (const ch of channelLinks) {
            if (ch.offerId)
                channelByOffer.set(ch.offerId, ch);
            if (ch.listingId)
                channelByListing.set(ch.listingId, ch);
        }
        const seenKeys = new Set();
        try {
            if (payload.listingIds?.length) {
                for (const listingId of payload.listingIds) {
                    const local = await this.listingRepo.findOne({
                        where: {
                            id: listingId,
                            organizationId: payload.organizationId,
                            ebayAccountId: account.id,
                        },
                    });
                    if (!local) {
                        failed += 1;
                        errors.push({ listingId, message: 'Listing not found' });
                        continue;
                    }
                    try {
                        const result = await this.syncSingleListing(account, local, channelByOffer, channelByListing);
                        processed += 1;
                        if (result.created)
                            created += 1;
                        else
                            updated += 1;
                        if (local.ebayItemId) {
                            seenKeys.add(`${local.marketplaceId}:${local.ebayItemId}`);
                        }
                    }
                    catch (e) {
                        failed += 1;
                        errors.push({
                            listingId,
                            message: e instanceof Error ? e.message : String(e),
                        });
                    }
                }
                advanceSyncWatermark = false;
            }
            else {
                const useBrowse = (process.env.PUBLISHED_LISTINGS_SOURCE || 'trading').toLowerCase() ===
                    'browse';
                const syncMode = payload.syncMode ?? 'full';
                const modifiedSince = syncMode === 'delta' && account.lastSuccessfulSyncAt
                    ? account.lastSuccessfulSyncAt
                    : undefined;
                if (modifiedSince) {
                    this.logger.log(`Delta sync for ${account.accountDisplayName}: fetching listings modified since ${modifiedSince.toISOString()}`);
                }
                const tradingResult = useBrowse
                    ? await this.syncFromBrowseApi(account, storeId, accountMarketplaceId, seenKeys, channelByListing)
                    : await this.syncFromTradingApi(account, storeId, accountMarketplaceId, seenKeys, channelByListing, modifiedSince);
                processed += tradingResult.processed;
                created += tradingResult.created;
                updated += tradingResult.updated;
                failed += tradingResult.failed;
                warnings.push(...tradingResult.warnings);
                advanceSyncWatermark = tradingResult.liveFetchOk;
                const isDelta = (payload.syncMode ?? 'full') === 'delta';
                advanceSyncWatermark = tradingResult.liveFetchOk && !isDelta;
                if (tradingResult.liveFetchOk && !isDelta) {
                    const endedCount = await this.markUnseenActiveAsEnded(account.id, accountMarketplaceId, seenKeys);
                    if (endedCount > 0) {
                        this.logger.log(`Marked ${endedCount} previously-active listing(s) as ended for ${account.accountDisplayName}`);
                    }
                    const liveCount = seenKeys.size;
                    const remainingActive = await this.listingRepo.count({
                        where: {
                            ebayAccountId: account.id,
                            marketplaceId: accountMarketplaceId,
                            listingStatus: 'active',
                            isTestListing: false,
                        },
                    });
                    if (remainingActive > liveCount) {
                        const extra = await this.markUnseenActiveAsEnded(account.id, accountMarketplaceId, seenKeys);
                        this.logger.warn(`Hard-gate prune for ${account.accountDisplayName}: DB had ${remainingActive} active vs ${liveCount} live; ended ${extra} more`);
                    }
                }
                else if (!tradingResult.liveFetchOk) {
                    failed += 1;
                    errors.push({
                        source: 'trading_api',
                        message: 'Live Trading fetch failed — skipped ActiveList prune and sync watermark update',
                    });
                    this.logger.warn(`Skipping ActiveList prune for ${account.accountDisplayName}: Trading live fetch failed`);
                }
                else if (isDelta) {
                    this.logger.log(`Delta sync for ${account.accountDisplayName}: ${tradingResult.processed} item(s) updated (skipped prune — not a full live set)`);
                }
                if (process.env.PUBLISHED_LISTINGS_INVENTORY_ENRICH === '1') {
                    const limit = 50;
                    let offset = 0;
                    for (;;) {
                        const page = await this.inventoryApi.getItems(storeId, limit, offset);
                        const items = page.inventoryItems ?? [];
                        if (!items.length)
                            break;
                        for (const item of items) {
                            const sku = item.sku?.trim();
                            if (!sku)
                                continue;
                            let offerOffset = 0;
                            for (;;) {
                                const { offers, total } = await this.inventoryApi.getOffersBySku(storeId, sku, 100, offerOffset);
                                if (!offers.length)
                                    break;
                                for (const offer of offers) {
                                    if (!this.isPublishedOffer(offer))
                                        continue;
                                    if (accountMarketplaceId &&
                                        offer.marketplaceId !== accountMarketplaceId) {
                                        continue;
                                    }
                                    processed += 1;
                                    try {
                                        const result = await this.upsertFromOffer(account, offer, item, channelByOffer, channelByListing);
                                        if (result.created)
                                            created += 1;
                                        else
                                            updated += 1;
                                        if (offer.listingId) {
                                            seenKeys.add(`${offer.marketplaceId}:${offer.listingId}`);
                                        }
                                    }
                                    catch (e) {
                                        failed += 1;
                                        errors.push({
                                            sku,
                                            offerId: offer.offerId,
                                            message: e instanceof Error ? e.message : String(e),
                                        });
                                    }
                                }
                                offerOffset += offers.length;
                                if (offerOffset >= total)
                                    break;
                            }
                        }
                        if (!page.next || items.length < limit)
                            break;
                        offset += limit;
                    }
                }
            }
            if (advanceSyncWatermark) {
                await this.accountRepo.update(account.id, {
                    lastSuccessfulSyncAt: new Date(),
                    lastListingsFetchedCount: payload.listingIds?.length
                        ? processed
                        : Math.max(processed, seenKeys.size),
                });
            }
            else {
                this.logger.warn(`Not advancing sync watermark for ${account.accountDisplayName}: no trustworthy live Trading set`);
            }
            if (syncLog) {
                const isDelta = (payload.syncMode ?? 'full') === 'delta';
                syncLog.status =
                    !advanceSyncWatermark && !payload.listingIds?.length && !isDelta
                        ? 'failed'
                        : failed > 0 && processed === 0
                            ? 'failed'
                            : 'completed';
                syncLog.completedAt = new Date();
                syncLog.itemsProcessed = processed;
                syncLog.itemsCreated = created;
                syncLog.itemsUpdated = updated;
                syncLog.itemsFailed = failed;
                syncLog.errors = errors;
                syncLog.warnings = warnings;
                await this.syncLogRepo.save(syncLog);
            }
            return { processed, created, updated, failed };
        }
        catch (e) {
            if (syncLog) {
                syncLog.status = 'failed';
                syncLog.completedAt = new Date();
                syncLog.errors = [
                    ...errors,
                    { message: e instanceof Error ? e.message : String(e) },
                ];
                await this.syncLogRepo.save(syncLog);
            }
            throw e;
        }
    }
    async syncSingleListing(account, local, channelByOffer, channelByListing) {
        const storeId = account.primaryStoreId;
        if (!local.sku) {
            throw new common_1.BadRequestException('Listing has no SKU');
        }
        if (!local.offerId && local.ebayItemId) {
            return this.syncLegacyTradingListing(account, local, channelByListing);
        }
        const item = await this.inventoryApi.getItem(storeId, local.sku);
        let offer = null;
        if (local.offerId) {
            offer = await this.inventoryApi.getOffer(storeId, local.offerId);
        }
        else {
            const { offers } = await this.inventoryApi.getOffersBySku(storeId, local.sku, 100, 0);
            offer =
                offers.find((o) => o.listingId === local.ebayItemId) ??
                    offers.find((o) => this.isPublishedOffer(o)) ??
                    offers[0] ??
                    null;
        }
        if (!offer) {
            throw new common_1.NotFoundException('No eBay offer found for listing');
        }
        return this.upsertFromOffer(account, offer, item, channelByOffer, channelByListing, local);
    }
    async syncLegacyTradingListing(account, local, channelByListing) {
        const itemId = local.ebayItemId;
        const details = await this.tradingApi.getItemDetails(account.primaryStoreId, itemId, local.marketplaceId);
        const quantity = details.quantity == null
            ? local.quantityAvailable
            : Math.max(0, details.quantity - (details.quantitySold ?? 0));
        const status = details.listingStatus && details.listingStatus.toLowerCase() !== 'active'
            ? 'ended'
            : quantity <= 0
                ? 'out_of_stock'
                : 'active';
        const channel = channelByListing.get(itemId);
        local.title = details.title?.trim() || local.title;
        local.description = details.description ?? local.description;
        local.categoryId = details.categoryId ?? local.categoryId;
        local.price = details.price != null ? String(details.price) : local.price;
        local.currency = details.currency ?? local.currency;
        local.quantityAvailable = quantity;
        local.quantitySold = details.quantitySold ?? local.quantitySold;
        local.listingStatus = status;
        local.listingUrl =
            details.listingUrl ??
                this.health.buildListingUrl(itemId, local.marketplaceId, account.environment);
        if (details.imageUrls.length)
            local.imageUrls = details.imageUrls;
        if (Object.keys(details.itemSpecifics).length) {
            local.itemSpecifics = details.itemSpecifics;
        }
        if (details.compatibility) {
            local.compatibility = details.compatibility;
        }
        local.offerId = null;
        local.ebayListingChannelId = channel?.id ?? local.ebayListingChannelId;
        local.rawEbayResponse = {
            syncSource: 'trading_api_get_item',
            item: details,
        };
        local.lastSyncedAt = new Date();
        await this.listingRepo.save(local);
        if (channel) {
            channel.offerId = null;
            channel.listingId = itemId;
            channel.listingUrl = local.listingUrl;
            channel.channelPrice = local.price;
            channel.channelQuantity = quantity;
            channel.listingStatus = status === 'ended' ? 'ended' : 'published';
            await this.channelRepo.save(channel);
        }
        return { created: false };
    }
    async upsertFromOffer(account, offer, item, channelByOffer, channelByListing, existing) {
        const sku = offer.sku ?? item.sku ?? null;
        const extracted = this.health.extractFromInventoryItem(item);
        let compatibility = null;
        if (sku && account.primaryStoreId) {
            try {
                compatibility = (await this.inventoryApi.getCompatibility(account.primaryStoreId, sku));
            }
            catch {
                compatibility = offer.compatibility;
            }
        }
        const channel = (offer.offerId ? channelByOffer.get(offer.offerId) : undefined) ??
            (offer.listingId ? channelByListing.get(offer.listingId) : undefined);
        const mergedImageUrls = (0, ebay_listing_images_util_js_1.preferRicherImageUrls)(extracted.imageUrls, existing?.imageUrls);
        const imageUrls = (0, ebay_listing_images_util_js_1.isSingleImageBrand)(extracted.itemSpecifics?.Brand?.[0] ?? extracted.title)
            ? (0, ebay_listing_images_util_js_1.selectPrimaryImageForBrand)(mergedImageUrls, extracted.itemSpecifics?.Brand?.[0] ?? extracted.title)
            : mergedImageUrls;
        const listingStatus = this.health.mapOfferStatus(offer);
        const healthFlags = this.health.computeHealthFlags({
            title: extracted.title,
            imageUrls,
            itemSpecifics: extracted.itemSpecifics,
            compatibility,
            quantityAvailable: offer.availableQuantity ?? extracted.quantityAvailable,
            quantitySold: 0,
            performanceMetrics: {},
            categoryId: offer.categoryId ?? null,
            price: offer.pricingSummary?.price?.value ?? null,
        });
        const data = {
            organizationId: account.organizationId,
            ebayAccountId: account.id,
            storeId: account.primaryStoreId,
            marketplaceId: offer.marketplaceId,
            ebayItemId: offer.listingId ?? null,
            offerId: offer.offerId ?? null,
            sku,
            title: extracted.title,
            description: offer.listingDescription ?? extracted.description,
            categoryId: offer.categoryId ?? null,
            price: offer.pricingSummary?.price?.value ?? null,
            currency: offer.pricingSummary?.price?.currency ?? 'USD',
            quantityAvailable: offer.availableQuantity ?? extracted.quantityAvailable,
            listingStatus,
            listingFormat: this.health.mapOfferFormat(offer.format),
            condition: extracted.condition,
            listingUrl: this.health.buildListingUrl(offer.listingId, offer.marketplaceId, account.environment),
            imageUrls,
            itemSpecifics: extracted.itemSpecifics,
            listingPolicies: offer.listingPolicies ?? null,
            compatibility,
            healthFlags,
            accountDisplayName: account.accountDisplayName,
            lastSyncedAt: new Date(),
            catalogProductId: channel?.catalogProductId ?? null,
            ebayListingChannelId: channel?.id ?? null,
            rawEbayResponse: { offer, inventoryItem: item },
        };
        if (existing) {
            Object.assign(existing, data);
            await this.listingRepo.save(existing);
            return { created: false };
        }
        let row = offer.listingId
            ? await this.listingRepo.findOne({
                where: {
                    ebayAccountId: account.id,
                    marketplaceId: offer.marketplaceId,
                    ebayItemId: offer.listingId,
                },
            })
            : null;
        if (!row && offer.offerId) {
            row = await this.listingRepo.findOne({
                where: { ebayAccountId: account.id, offerId: offer.offerId },
            });
        }
        if (row) {
            Object.assign(row, data);
            await this.listingRepo.save(row);
            return { created: false };
        }
        const created = this.listingRepo.create(data);
        await this.listingRepo.save(created);
        return { created: true };
    }
    async resolveBrowseSeller(account, storeId) {
        const store = await this.storeRepo.findOneBy({ id: storeId });
        const cfg = store?.config ?? {};
        const fromCfg = cfg?.ebayUserId;
        if (typeof fromCfg === 'string' &&
            fromCfg &&
            !fromCfg.startsWith('unknown_')) {
            return fromCfg;
        }
        const envVal = process.env[`EBAY_BROWSE_SELLER_${account.id}`] ||
            process.env[`EBAY_BROWSE_SELLER_${storeId}`];
        if (envVal)
            return envVal;
        const url = store?.storeUrl ?? '';
        const m = url.match(/ebay\.[a-z0-9.]+\/str\/([^/?#]+)/i);
        if (m?.[1]) {
            this.logger.warn(`Derived eBay seller "${m[1]}" from storeUrl for ${account.accountDisplayName}; set EBAY_BROWSE_SELLER_${account.id} to override`);
            return m[1];
        }
        throw new Error(`No eBay seller username resolved for ${account.accountDisplayName}; set EBAY_BROWSE_SELLER_${account.id}`);
    }
    async getAllLiveListingsViaBrowse(account, storeId, marketplaceId, country) {
        const seller = await this.resolveBrowseSeller(account, storeId);
        const categoryIds = process.env.PUBLISHED_LISTINGS_BROWSE_CATEGORY_IDS || '6001';
        const items = [];
        let offset = 0;
        const limit = 100;
        for (;;) {
            const res = await this.browseApi.searchSellerListings({
                seller,
                marketplaceId,
                country,
                categoryIds,
                limit,
                offset,
            });
            for (const s of res.itemSummaries ?? []) {
                const legacyId = s
                    .legacyItemId;
                const itemId = legacyId ?? s.itemId;
                items.push({
                    itemId,
                    v1ItemId: s.itemId,
                    title: s.title,
                    price: Number(s.price?.value ?? '0') || null,
                    currency: s.price?.currency ?? 'USD',
                    listingStatus: 'active',
                    condition: s.condition ?? null,
                    categoryId: s.categories?.[0]?.categoryId ?? null,
                    imageUrls: s.image?.imageUrl ? [s.image.imageUrl] : [],
                    listingUrl: s.itemWebUrl ?? null,
                });
            }
            if ((res.itemSummaries?.length ?? 0) < limit)
                break;
            offset += limit;
            if (offset > 200_000) {
                this.logger.warn(`Browse seller search capped at offset 200000 for ${seller}`);
                break;
            }
        }
        return items;
    }
    async syncFromBrowseApi(account, storeId, marketplaceId, seenKeys, channelByListing) {
        let processed = 0;
        let created = 0;
        let updated = 0;
        let failed = 0;
        const warnings = [];
        let liveFetchOk = false;
        const mp = marketplaceId ?? 'EBAY_MOTORS_US';
        const country = (process.env.PUBLISHED_LISTINGS_BROWSE_COUNTRY || 'US').toUpperCase();
        try {
            const items = await this.getAllLiveListingsViaBrowse(account, storeId, mp, country);
            liveFetchOk = true;
            const enrichBudget = Math.max(0, Number(process.env.PUBLISHED_LISTINGS_ENRICH_MAX_PER_SYNC ?? '500') ||
                500);
            let enrichUsed = 0;
            for (const item of items) {
                const key = `${mp}:${item.itemId}`;
                if (seenKeys.has(key))
                    continue;
                processed += 1;
                try {
                    const result = await this.upsertFromBrowseItem(account, item, mp, channelByListing, enrichUsed < enrichBudget);
                    if (result.enriched)
                        enrichUsed += 1;
                    if (result.created)
                        created += 1;
                    else
                        updated += 1;
                    seenKeys.add(key);
                }
                catch (e) {
                    failed += 1;
                    warnings.push({
                        itemId: item.itemId,
                        message: e instanceof Error ? e.message : String(e),
                    });
                }
            }
            if (items.length > 0) {
                this.logger.log(`Browse live list for ${account.accountDisplayName}: ${items.length} active, ${created} new, ${updated} updated, enriched=${enrichUsed}/${enrichBudget}`);
            }
        }
        catch (e) {
            warnings.push({
                source: 'browse_api',
                message: e instanceof Error ? e.message : String(e),
            });
            this.logger.warn(`Browse API fetch skipped for ${account.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
        return { processed, created, updated, failed, warnings, liveFetchOk };
    }
    async upsertFromBrowseItem(account, item, marketplaceId, channelByListing, allowEnrichment = true) {
        const channel = channelByListing.get(item.itemId);
        const listingStatus = item.listingStatus.toLowerCase() !== 'active' ? 'ended' : 'active';
        const row = await this.listingRepo.findOne({
            where: {
                ebayAccountId: account.id,
                marketplaceId,
                ebayItemId: item.itemId,
            },
        });
        const imageUrls = [...item.imageUrls];
        let compatibility = row?.compatibility ?? null;
        let description = row?.description ?? null;
        let itemSpecifics = {
            ...(row?.itemSpecifics ?? {}),
        };
        let enriched = false;
        const enrichmentInput = {
            storeId: account.primaryStoreId,
            ebayItemId: item.itemId,
            sku: row?.sku,
            marketplaceId,
            listingUrl: item.listingUrl ?? row?.listingUrl ?? null,
            title: item.title,
            imageUrls,
            compatibility,
            description,
            itemSpecifics,
            skipTrading: true,
        };
        let enrichedTitle = item.title;
        let enrichedListingUrl = item.listingUrl ?? row?.listingUrl ?? null;
        if (allowEnrichment &&
            listingStatus === 'active' &&
            this.enrichment.needsEnrichment(enrichmentInput)) {
            const result = await this.enrichment.enrichListing(enrichmentInput);
            const nextImages = (0, ebay_listing_images_util_js_1.preferRicherImageUrls)(result.imageUrls, imageUrls);
            compatibility = result.compatibility ?? compatibility;
            if (result.description?.trim())
                description = result.description;
            if (result.title?.trim())
                enrichedTitle = result.title.trim();
            if (result.listingUrl?.trim())
                enrichedListingUrl = result.listingUrl.trim();
            if (Object.keys(result.itemSpecifics ?? {}).length > 0) {
                itemSpecifics = result.itemSpecifics;
            }
            enriched =
                result.sources.length > 0 &&
                    (nextImages.length > imageUrls.length ||
                        compatibility != null ||
                        Boolean(result.description?.trim()) ||
                        Boolean(result.title?.trim()) ||
                        Boolean(result.listingUrl?.trim()) ||
                        Object.keys(result.itemSpecifics ?? {}).length > 0);
            imageUrls.length = 0;
            imageUrls.push(...nextImages);
        }
        const storedImageUrls = (0, ebay_listing_images_util_js_1.isSingleImageBrand)(itemSpecifics.Brand?.[0] ?? enrichedTitle)
            ? (0, ebay_listing_images_util_js_1.selectPrimaryImageForBrand)(imageUrls, itemSpecifics.Brand?.[0] ?? enrichedTitle)
            : imageUrls;
        const healthFlags = this.health.computeHealthFlags({
            title: enrichedTitle,
            imageUrls: storedImageUrls,
            itemSpecifics,
            compatibility,
            quantityAvailable: row?.quantityAvailable ?? 0,
            quantitySold: row?.quantitySold ?? 0,
            performanceMetrics: {},
            categoryId: item.categoryId,
            price: item.price != null ? String(item.price) : null,
            description,
            lastSyncedAt: new Date(),
        });
        const data = {
            organizationId: account.organizationId,
            ebayAccountId: account.id,
            storeId: account.primaryStoreId,
            marketplaceId,
            ebayItemId: item.itemId,
            offerId: row?.offerId ?? channel?.offerId ?? null,
            sku: row?.sku ?? null,
            title: enrichedTitle,
            description,
            categoryId: item.categoryId,
            price: item.price != null ? String(item.price) : null,
            currency: item.currency,
            quantityAvailable: row?.quantityAvailable ?? 0,
            quantitySold: row?.quantitySold ?? 0,
            listingStatus,
            listingFormat: 'fixed_price',
            condition: item.condition,
            listingUrl: enrichedListingUrl ??
                this.health.buildListingUrl(item.itemId, marketplaceId, account.environment),
            imageUrls: storedImageUrls,
            itemSpecifics,
            compatibility,
            healthFlags,
            accountDisplayName: account.accountDisplayName,
            ebayStartTime: null,
            ebayEndTime: null,
            lastSyncedAt: new Date(),
            catalogProductId: channel?.catalogProductId ?? null,
            ebayListingChannelId: channel?.id ?? row?.ebayListingChannelId ?? null,
            rawEbayResponse: { syncSource: 'browse_api', item },
        };
        if (row) {
            Object.assign(row, data);
            await this.listingRepo.save(row);
            return { created: false, enriched };
        }
        const created = this.listingRepo.create(data);
        await this.listingRepo.save(created);
        return { created: true, enriched };
    }
    isPublishedOffer(offer) {
        const status = (offer.status ?? '').toUpperCase();
        return status === 'PUBLISHED' || Boolean(offer.listingId);
    }
    async syncFromTradingApi(account, storeId, marketplaceId, seenKeys, channelByListing, modifiedSince) {
        let processed = 0;
        let created = 0;
        let updated = 0;
        let failed = 0;
        const warnings = [];
        let liveFetchOk = false;
        const enrichBudget = Math.max(0, Number(process.env.PUBLISHED_LISTINGS_ENRICH_MAX_PER_SYNC ?? '500') ||
            500);
        let enrichUsed = 0;
        try {
            const items = await this.tradingApi.getAllLiveListings(storeId, marketplaceId, modifiedSince);
            liveFetchOk = true;
            const mp = marketplaceId ?? 'EBAY_US';
            for (const item of items) {
                const key = `${mp}:${item.itemId}`;
                if (seenKeys.has(key))
                    continue;
                processed += 1;
                try {
                    const result = await this.upsertFromTradingItem(account, item, mp, channelByListing, enrichUsed < enrichBudget);
                    if (result.enriched)
                        enrichUsed += 1;
                    if (result.created)
                        created += 1;
                    else
                        updated += 1;
                    seenKeys.add(key);
                }
                catch (e) {
                    failed += 1;
                    warnings.push({
                        itemId: item.itemId,
                        message: e instanceof Error ? e.message : String(e),
                    });
                }
            }
            if (enrichUsed < enrichBudget) {
                const backfilled = await this.enrichSparseImageListings(account, mp, enrichBudget - enrichUsed);
                enrichUsed += backfilled;
                if (backfilled > 0) {
                    this.logger.log(`Backfilled full image galleries for ${backfilled} listing(s) on ${account.accountDisplayName}`);
                }
            }
            if (items.length > 0) {
                this.logger.log(`Trading live list for ${account.accountDisplayName}: ${items.length} active, ${created} new, ${updated} updated, enriched=${enrichUsed}/${enrichBudget}`);
            }
        }
        catch (e) {
            warnings.push({
                source: 'trading_api',
                message: e instanceof Error ? e.message : String(e),
            });
            this.logger.warn(`Trading API fallback skipped for ${account.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
        return { processed, created, updated, failed, warnings, liveFetchOk };
    }
    async upsertFromTradingItem(account, item, marketplaceId, channelByListing, allowEnrichment = true) {
        const channel = channelByListing.get(item.itemId);
        const listingStatus = item.listingStatus.toLowerCase() !== 'active'
            ? 'ended'
            : item.quantityAvailable <= 0
                ? 'out_of_stock'
                : 'active';
        const row = await this.listingRepo.findOne({
            where: {
                ebayAccountId: account.id,
                marketplaceId,
                ebayItemId: item.itemId,
            },
        });
        const tradingImages = item.imageUrls?.length > 0
            ? item.imageUrls
            : item.imageUrl
                ? [item.imageUrl]
                : [];
        let imageUrls = (0, ebay_listing_images_util_js_1.preferRicherImageUrls)(row?.imageUrls, tradingImages);
        let compatibility = row?.compatibility ?? null;
        let description = row?.description ?? null;
        let itemSpecifics = {
            ...(row?.itemSpecifics ?? {}),
        };
        let enriched = false;
        let rawGetItem;
        const enrichmentInput = {
            storeId: account.primaryStoreId,
            ebayItemId: item.itemId,
            sku: item.sku,
            marketplaceId,
            listingUrl: item.listingUrl ?? row?.listingUrl ?? null,
            title: item.title ?? row?.title ?? null,
            imageUrls,
            compatibility,
            description,
            itemSpecifics,
            skipTrading: (process.env.PUBLISHED_LISTINGS_SKIP_TRADING_ENRICH ?? '').toLowerCase() === '1' ||
                (process.env.PUBLISHED_LISTINGS_SKIP_TRADING_ENRICH ?? '').toLowerCase() === 'true',
        };
        let enrichedTitle = item.title;
        let enrichedListingUrl = item.listingUrl ?? row?.listingUrl ?? null;
        if (allowEnrichment &&
            listingStatus === 'active' &&
            this.enrichment.needsEnrichment(enrichmentInput)) {
            const result = await this.enrichment.enrichListing(enrichmentInput);
            imageUrls = (0, ebay_listing_images_util_js_1.preferRicherImageUrls)(result.imageUrls, imageUrls);
            compatibility = result.compatibility ?? compatibility;
            if (result.description?.trim())
                description = result.description;
            if (result.title?.trim())
                enrichedTitle = result.title.trim();
            if (result.listingUrl?.trim())
                enrichedListingUrl = result.listingUrl.trim();
            if (Object.keys(result.itemSpecifics ?? {}).length > 0) {
                itemSpecifics = result.itemSpecifics;
            }
            if (result.rawGetItem) {
                rawGetItem = result.rawGetItem;
            }
            enriched =
                result.sources.length > 0 &&
                    (result.imageUrls.length > tradingImages.length ||
                        result.compatibility != null ||
                        Boolean(result.description?.trim()) ||
                        Boolean(result.title?.trim()) ||
                        Boolean(result.listingUrl?.trim()) ||
                        Object.keys(result.itemSpecifics ?? {}).length > 0);
        }
        const performanceMetrics = {};
        if (item.viewCount != null)
            performanceMetrics.viewCount = item.viewCount;
        if (item.watchCount != null)
            performanceMetrics.watchCount = item.watchCount;
        imageUrls = (0, ebay_listing_images_util_js_1.isSingleImageBrand)(itemSpecifics.Brand?.[0] ?? enrichedTitle)
            ? (0, ebay_listing_images_util_js_1.selectPrimaryImageForBrand)(imageUrls, itemSpecifics.Brand?.[0] ?? enrichedTitle)
            : imageUrls;
        const healthFlags = this.health.computeHealthFlags({
            title: enrichedTitle,
            imageUrls,
            itemSpecifics,
            compatibility,
            quantityAvailable: item.quantityAvailable,
            quantitySold: item.quantitySold,
            performanceMetrics,
            categoryId: item.categoryId,
            price: item.price != null ? String(item.price) : null,
            description,
            lastSyncedAt: new Date(),
        });
        const data = {
            organizationId: account.organizationId,
            ebayAccountId: account.id,
            storeId: account.primaryStoreId,
            marketplaceId,
            ebayItemId: item.itemId,
            offerId: row?.offerId ?? channel?.offerId ?? null,
            sku: item.sku,
            title: enrichedTitle,
            description,
            categoryId: item.categoryId,
            price: item.price != null ? String(item.price) : null,
            currency: item.currency,
            quantityAvailable: item.quantityAvailable,
            quantitySold: item.quantitySold,
            listingStatus,
            listingFormat: item.listingFormat === 'auction' ? 'auction' : 'fixed_price',
            condition: item.condition,
            listingUrl: enrichedListingUrl ??
                this.health.buildListingUrl(item.itemId, marketplaceId, account.environment),
            imageUrls,
            itemSpecifics,
            compatibility,
            performanceMetrics,
            healthFlags,
            accountDisplayName: account.accountDisplayName,
            ebayStartTime: item.startTime ? new Date(item.startTime) : null,
            ebayEndTime: item.endTime ? new Date(item.endTime) : null,
            lastSyncedAt: new Date(),
            catalogProductId: channel?.catalogProductId ?? null,
            ebayListingChannelId: channel?.id ?? row?.ebayListingChannelId ?? null,
            rawEbayResponse: {
                syncSource: 'trading_api',
                item,
                ...(rawGetItem ? { getItem: rawGetItem } : {}),
            },
        };
        if (row) {
            Object.assign(row, data);
            await this.listingRepo.save(row);
            return { created: false, enriched };
        }
        const created = this.listingRepo.create(data);
        await this.listingRepo.save(created);
        return { created: true, enriched };
    }
    async enrichSparseImageListings(account, marketplaceId, budget) {
        if (budget <= 0)
            return 0;
        const sparse = await this.listingRepo
            .createQueryBuilder('l')
            .where('l.ebayAccountId = :ebayAccountId', {
            ebayAccountId: account.id,
        })
            .andWhere('l.marketplaceId = :marketplaceId', { marketplaceId })
            .andWhere("l.listingStatus = 'active'")
            .andWhere('l.ebayItemId IS NOT NULL')
            .andWhere(new typeorm_2.Brackets((sub) => {
            sub
                .where(`jsonb_array_length(COALESCE(l.image_urls, '[]'::jsonb)) <= 1`)
                .orWhere(`COALESCE(l.description, '') = ''`)
                .orWhere(`COALESCE(l.item_specifics, '{}'::jsonb) = '{}'::jsonb`)
                .orWhere('l.compatibility IS NULL')
                .orWhere(`l.listing_url ~* 'ebay\\.(de|fr|it|es|nl|be|at|ch|pl|ie|com\\.br)'`);
        }))
            .orderBy('l.lastSyncedAt', 'ASC')
            .take(budget)
            .getMany();
        let enriched = 0;
        for (const row of sparse) {
            if (!row.ebayItemId)
                continue;
            try {
                const result = await this.enrichment.enrichListing({
                    storeId: account.primaryStoreId,
                    ebayItemId: row.ebayItemId,
                    sku: row.sku,
                    marketplaceId,
                    listingUrl: row.listingUrl,
                    title: row.title,
                    imageUrls: row.imageUrls ?? [],
                    compatibility: row.compatibility,
                    description: row.description,
                    itemSpecifics: row.itemSpecifics ?? {},
                    skipTrading: (process.env.PUBLISHED_LISTINGS_SKIP_TRADING_ENRICH ?? '').toLowerCase() === '1' ||
                        (process.env.PUBLISHED_LISTINGS_SKIP_TRADING_ENRICH ?? '').toLowerCase() === 'true',
                });
                const nextImages = (0, ebay_listing_images_util_js_1.preferRicherImageUrls)(result.imageUrls, row.imageUrls);
                const imagesImproved = nextImages.length > (row.imageUrls?.length ?? 0);
                const compatImproved = result.compatibility != null &&
                    Array.isArray(result.compatibility
                        .compatibleProducts) &&
                    !(row.compatibility != null &&
                        Array.isArray(row.compatibility
                            .compatibleProducts));
                const descriptionImproved = Boolean(result.description?.trim()) &&
                    result.description?.trim() !== row.description?.trim();
                const titleImproved = Boolean(result.title?.trim()) &&
                    result.title?.trim() !== row.title?.trim();
                const listingUrlImproved = Boolean(result.listingUrl?.trim()) &&
                    result.listingUrl?.trim() !== row.listingUrl?.trim();
                const specificsImproved = Object.keys(result.itemSpecifics ?? {}).length >
                    Object.keys(row.itemSpecifics ?? {}).length;
                if (!imagesImproved &&
                    !compatImproved &&
                    !descriptionImproved &&
                    !titleImproved &&
                    !listingUrlImproved &&
                    !specificsImproved &&
                    result.sources.length === 0) {
                    continue;
                }
                row.imageUrls = nextImages;
                if (result.title?.trim()) {
                    row.title = result.title.trim();
                }
                if (result.listingUrl?.trim()) {
                    row.listingUrl = result.listingUrl.trim();
                }
                if (result.compatibility != null) {
                    row.compatibility = result.compatibility;
                }
                if (result.description?.trim()) {
                    row.description = result.description;
                }
                if (Object.keys(result.itemSpecifics ?? {}).length > 0) {
                    row.itemSpecifics = result.itemSpecifics;
                }
                if (result.rawGetItem) {
                    row.rawEbayResponse = {
                        ...(row.rawEbayResponse ?? {}),
                        getItem: result.rawGetItem,
                    };
                }
                row.healthFlags = this.health.computeHealthFlags({
                    title: row.title,
                    imageUrls: nextImages,
                    itemSpecifics: row.itemSpecifics ?? {},
                    compatibility: row.compatibility,
                    quantityAvailable: row.quantityAvailable,
                    quantitySold: row.quantitySold,
                    performanceMetrics: row.performanceMetrics ?? {},
                    categoryId: row.categoryId,
                    price: row.price,
                    description: row.description,
                    lastSyncedAt: row.lastSyncedAt,
                });
                await this.listingRepo.save(row);
                enriched += 1;
            }
            catch (e) {
                this.logger.debug(`Sparse enrich skipped for ${row.ebayItemId}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        return enriched;
    }
    async markUnseenActiveAsEnded(ebayAccountId, marketplaceId, seenKeys) {
        const prefix = marketplaceId + ':';
        const queryRunner = this.listingRepo.manager.connection.createQueryRunner();
        await queryRunner.connect();
        try {
            await queryRunner.startTransaction();
            await queryRunner.query(`SET LOCAL statement_timeout = '300s'`);
            await queryRunner.query(`SET LOCAL work_mem = '64MB'`);
            const activeRows = (await queryRunner.query(`SELECT "ebay_item_id" FROM "ebay_published_listings"
         WHERE "ebay_account_id" = $1 AND "marketplace_id" = $2
           AND "listing_status" = 'active' AND "ebay_item_id" IS NOT NULL`, [ebayAccountId, marketplaceId]));
            const syntheticRows = (await queryRunner.query(`SELECT "ebay_item_id" FROM "ebay_published_listings"
         WHERE "ebay_account_id" = $1 AND "marketplace_id" = $2
           AND "listing_status" = 'active' AND "is_test_listing" = true
           AND "ebay_item_id" IS NOT NULL`, [ebayAccountId, marketplaceId]));
            const syntheticItemIds = new Set(syntheticRows.map((row) => row.ebay_item_id));
            const toEnd = [];
            for (const row of activeRows) {
                if (row.ebay_item_id &&
                    !syntheticItemIds.has(row.ebay_item_id) &&
                    !seenKeys.has(prefix + row.ebay_item_id)) {
                    toEnd.push(row.ebay_item_id);
                }
            }
            if (toEnd.length === 0) {
                await queryRunner.commitTransaction();
                return 0;
            }
            const BATCH_SIZE = 2000;
            const endedAt = new Date();
            for (let i = 0; i < toEnd.length; i += BATCH_SIZE) {
                const batch = toEnd.slice(i, i + BATCH_SIZE);
                await queryRunner.query(`UPDATE "ebay_published_listings"
             SET "listing_status" = 'ended', "last_synced_at" = $3, "updated_at" = $3
           WHERE "ebay_account_id" = $1 AND "marketplace_id" = $2
             AND "ebay_item_id" = ANY($4::text[])
             AND "is_test_listing" = false`, [ebayAccountId, marketplaceId, endedAt, batch]);
            }
            await queryRunner.commitTransaction();
            return toEnd.length;
        }
        catch (e) {
            try {
                await queryRunner.rollbackTransaction();
            }
            catch {
            }
            throw e;
        }
        finally {
            await queryRunner.release();
        }
    }
    async resolveAccounts(organizationId, ebayAccountId) {
        if (ebayAccountId) {
            const account = await this.accountRepo.findOne({
                where: { id: ebayAccountId, organizationId },
            });
            if (!account)
                throw new common_1.NotFoundException('eBay account not found');
            return [account];
        }
        return this.accountRepo.find({
            where: { organizationId, connectionStatus: 'active' },
            order: { accountDisplayName: 'ASC' },
        });
    }
    async getSyncLogs(organizationId, ebayAccountId, limit = 20) {
        const where = { organizationId };
        if (ebayAccountId)
            where.ebayAccountId = ebayAccountId;
        return this.syncLogRepo.find({
            where,
            order: { startedAt: 'DESC' },
            take: Math.min(limit, 100),
        });
    }
};
exports.PublishedListingsSyncService = PublishedListingsSyncService;
exports.PublishedListingsSyncService = PublishedListingsSyncService = PublishedListingsSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_published_listing_entity_js_1.EbayPublishedListing)),
    __param(2, (0, typeorm_1.InjectRepository)(ebay_published_listing_sync_log_entity_js_1.EbayPublishedListingSyncLog)),
    __param(3, (0, typeorm_1.InjectRepository)(ebay_listing_channel_entity_js_1.EbayListingChannel)),
    __param(4, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(10, (0, bullmq_1.InjectQueue)('published-listings-sync')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_inventory_api_service_js_1.EbayInventoryApiService,
        ebay_trading_api_service_js_1.EbayTradingApiService,
        ebay_browse_api_service_js_1.EbayBrowseApiService,
        published_listings_health_service_js_1.PublishedListingsHealthService,
        published_listings_enrichment_service_js_1.PublishedListingsEnrichmentService, Function])
], PublishedListingsSyncService);
//# sourceMappingURL=published-listings-sync.service.js.map