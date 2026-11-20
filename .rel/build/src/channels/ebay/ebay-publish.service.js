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
var EbayPublishService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayPublishService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const store_entity_js_1 = require("../entities/store.entity.js");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
const ebay_category_entity_js_1 = require("../../listings/entities/ebay-category.entity.js");
const ebay_inventory_api_service_js_1 = require("./ebay-inventory-api.service.js");
const ebay_media_api_service_js_1 = require("./ebay-media-api.service.js");
const ebay_compatibility_reconciliation_service_js_1 = require("./ebay-compatibility-reconciliation.service.js");
const ebay_taxonomy_api_service_js_1 = require("./ebay-taxonomy-api.service.js");
const ebay_taxonomy_cache_service_js_1 = require("./ebay-taxonomy-cache.service.js");
const ebay_auth_service_js_1 = require("./ebay-auth.service.js");
const ebay_trading_api_service_js_1 = require("./ebay-trading-api.service.js");
const ebay_publish_quantity_util_js_1 = require("./ebay-publish-quantity.util.js");
const ebay_sell_account_api_service_js_1 = require("../../integrations/ebay/services/ebay-sell-account-api.service.js");
const ebay_pa_return_policy_service_js_1 = require("../../integrations/ebay/services/ebay-pa-return-policy.service.js");
const ebay_marketplace_headers_util_js_1 = require("./ebay-marketplace-headers.util.js");
const connected_ebay_account_entity_js_1 = require("../../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_account_marketplace_entity_js_1 = require("../../integrations/ebay/entities/ebay-account-marketplace.entity.js");
const ebay_listing_channel_entity_js_1 = require("../../integrations/ebay/entities/ebay-listing-channel.entity.js");
const sellerpundit_listing_adapter_js_1 = require("../../integrations/sellerpundit/sellerpundit-listing.adapter.js");
const sellerpundit_policy_sync_service_js_1 = require("../../integrations/sellerpundit/sellerpundit-policy-sync.service.js");
const sellerpundit_publish_util_js_1 = require("../../integrations/sellerpundit/sellerpundit-publish.util.js");
const ebay_listing_text_util_js_1 = require("./ebay-listing-text.util.js");
const ebay_listing_images_util_js_1 = require("./ebay-listing-images.util.js");
const ebay_listing_condition_util_js_1 = require("./ebay-listing-condition.util.js");
const ebay_api_error_util_js_1 = require("./ebay-api-error.util.js");
const ebay_business_policy_entity_js_1 = require("../../integrations/ebay/entities/ebay-business-policy.entity.js");
const ebay_business_policy_util_js_1 = require("../../integrations/ebay/services/ebay-business-policy.util.js");
const sellerpundit_token_sync_service_js_1 = require("../../integrations/sellerpundit/sellerpundit-token-sync.service.js");
const sellerpundit_marketplace_registry_js_1 = require("../../integrations/sellerpundit/sellerpundit-marketplace.registry.js");
const ebay_marketplace_config_service_js_1 = require("../../integrations/ebay/services/ebay-marketplace-config.service.js");
const ebay_listing_aspects_util_js_1 = require("./ebay-listing-aspects.util.js");
const fitment_mvl_util_js_1 = require("../../fitment/fitment-mvl.util.js");
const ebay_mvl_service_js_1 = require("../../fitment/ebay-mvl.service.js");
const ebay_sku_util_js_1 = require("./ebay-sku.util.js");
function filterTempS3Urls(urls) {
    const tempPattern = /\/temp\//;
    const durable = urls.filter((u) => !tempPattern.test(u));
    return durable.length > 0 ? durable : urls;
}
function normalizePublishedDescription(value) {
    return String(value ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}
function isEndedTradingRevisionFailure(error) {
    const message = error instanceof Error ? error.message : String(error);
    return /ReviseFixedPriceItem failed \(291\)/i.test(message);
}
function appendImageUrlsAtEnd(imageUrls, trailingImageUrls, maxImages = ebay_listing_images_util_js_1.EBAY_MAX_LISTING_IMAGES) {
    const trailing = [];
    const trailingKeys = new Set();
    for (const raw of trailingImageUrls) {
        const url = raw.trim();
        const key = url.toLowerCase();
        if (!url || trailingKeys.has(key))
            continue;
        trailingKeys.add(key);
        trailing.push(url);
    }
    const required = trailing.slice(-maxImages);
    const seen = new Set(required.map((url) => url.toLowerCase()));
    const retained = [];
    const retainedLimit = Math.max(0, maxImages - required.length);
    for (const raw of imageUrls) {
        const url = raw.trim();
        const key = url.toLowerCase();
        if (!url || seen.has(key))
            continue;
        seen.add(key);
        if (retained.length >= retainedLimit)
            continue;
        retained.push(url);
    }
    return [...retained, ...required];
}
const FALLBACK_MOTORS_CATEGORY = {
    id: '9886',
    name: 'Other Car & Truck Parts & Accessories',
};
let EbayPublishService = EbayPublishService_1 = class EbayPublishService {
    config;
    inventoryApi;
    tradingApi;
    taxonomyApi;
    taxonomyCache;
    auth;
    sellAccount;
    paReturnPolicy;
    sellerpunditListing;
    sellerpunditPolicies;
    sellerpunditTokens;
    sellerpunditRegistry;
    mpConfig;
    mvlService;
    storeRepo;
    connectedAccountRepo;
    mpRepo;
    policyRepo;
    channelRepo;
    listingRepo;
    catalogRepo;
    ebayCategoryRepo;
    ebayMedia;
    compatibilityReconciler;
    logger = new common_1.Logger(EbayPublishService_1.name);
    compatibilityCategoryCache = new Map();
    leafCategoryCache = new Map();
    constructor(config, inventoryApi, tradingApi, taxonomyApi, taxonomyCache, auth, sellAccount, paReturnPolicy, sellerpunditListing, sellerpunditPolicies, sellerpunditTokens, sellerpunditRegistry, mpConfig, mvlService, storeRepo, connectedAccountRepo, mpRepo, policyRepo, channelRepo, listingRepo, catalogRepo, ebayCategoryRepo, ebayMedia, compatibilityReconciler) {
        this.config = config;
        this.inventoryApi = inventoryApi;
        this.tradingApi = tradingApi;
        this.taxonomyApi = taxonomyApi;
        this.taxonomyCache = taxonomyCache;
        this.auth = auth;
        this.sellAccount = sellAccount;
        this.paReturnPolicy = paReturnPolicy;
        this.sellerpunditListing = sellerpunditListing;
        this.sellerpunditPolicies = sellerpunditPolicies;
        this.sellerpunditTokens = sellerpunditTokens;
        this.sellerpunditRegistry = sellerpunditRegistry;
        this.mpConfig = mpConfig;
        this.mvlService = mvlService;
        this.storeRepo = storeRepo;
        this.connectedAccountRepo = connectedAccountRepo;
        this.mpRepo = mpRepo;
        this.policyRepo = policyRepo;
        this.channelRepo = channelRepo;
        this.listingRepo = listingRepo;
        this.catalogRepo = catalogRepo;
        this.ebayCategoryRepo = ebayCategoryRepo;
        this.ebayMedia = ebayMedia;
        this.compatibilityReconciler = compatibilityReconciler;
    }
    async ensureLeafCategoryId(categoryId, sku) {
        const normalizedCategoryId = categoryId?.trim() ?? '';
        if (!/^\d{1,10}$/.test(normalizedCategoryId)) {
            const fallback = {
                id: FALLBACK_MOTORS_CATEGORY.id,
                name: FALLBACK_MOTORS_CATEGORY.name,
                usedFallback: true,
            };
            this.logger.warn(`${normalizedCategoryId ? `Invalid` : `Missing`} eBay Motors category ID${normalizedCategoryId ? ` "${normalizedCategoryId}"` : ''}${sku ? ` for SKU ${sku}` : ''}; using fallback leaf ${fallback.id}`);
            return fallback;
        }
        const cached = this.leafCategoryCache.get(normalizedCategoryId);
        if (cached !== undefined)
            return cached;
        if (normalizedCategoryId === FALLBACK_MOTORS_CATEGORY.id) {
            const fallback = {
                id: FALLBACK_MOTORS_CATEGORY.id,
                name: FALLBACK_MOTORS_CATEGORY.name,
                usedFallback: true,
            };
            this.leafCategoryCache.set(normalizedCategoryId, fallback);
            return fallback;
        }
        try {
            const local = await this.ebayCategoryRepo.findOne({
                where: {
                    ebayCategoryId: normalizedCategoryId,
                    treeId: ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService.EBAY_MOTORS_TREE_ID,
                },
            });
            if (local?.isLeaf) {
                const resolved = {
                    id: normalizedCategoryId,
                    name: local.categoryName,
                    usedFallback: false,
                };
                this.leafCategoryCache.set(normalizedCategoryId, resolved);
                return resolved;
            }
            if (local && !local.isLeaf) {
                const leafChild = await this.findFirstLeafDescendant(normalizedCategoryId);
                if (leafChild && leafChild.id !== normalizedCategoryId) {
                    this.logger.log(`Category ${normalizedCategoryId} is not a leaf — resolved to leaf child ${leafChild.id}${sku ? ` for SKU ${sku}` : ''}`);
                    this.leafCategoryCache.set(normalizedCategoryId, {
                        ...leafChild,
                        usedFallback: false,
                    });
                    return { ...leafChild, usedFallback: false };
                }
            }
        }
        catch {
        }
        try {
            const subtree = await this.taxonomyApi.getCategorySubtree(normalizedCategoryId, ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService.EBAY_MOTORS_TREE_ID);
            const node = subtree.categorySubtreeNode;
            if (node?.leafCategoryTreeNode) {
                const resolved = {
                    id: node.category.categoryId,
                    name: node.category.categoryName,
                    usedFallback: false,
                };
                this.leafCategoryCache.set(normalizedCategoryId, resolved);
                return resolved;
            }
            const leafDescendant = this.walkToFirstLeaf(node);
            if (leafDescendant && leafDescendant.id !== normalizedCategoryId) {
                this.logger.log(`Category ${normalizedCategoryId} is not a leaf (API) — resolved to leaf descendant ${leafDescendant.id}${sku ? ` for SKU ${sku}` : ''}`);
                this.leafCategoryCache.set(normalizedCategoryId, {
                    ...leafDescendant,
                    usedFallback: false,
                });
                return { ...leafDescendant, usedFallback: false };
            }
        }
        catch (err) {
            this.logger.warn(`Could not verify leaf status for category ${normalizedCategoryId}: ${err instanceof Error ? err.message : err}`);
        }
        const fallback = {
            id: FALLBACK_MOTORS_CATEGORY.id,
            name: FALLBACK_MOTORS_CATEGORY.name,
            usedFallback: true,
        };
        this.logger.warn(`Category ${normalizedCategoryId} could not be verified as an eBay Motors leaf${sku ? ` for SKU ${sku}` : ''}; using fallback leaf ${fallback.id}`);
        this.leafCategoryCache.set(normalizedCategoryId, fallback);
        return fallback;
    }
    walkToFirstLeaf(node) {
        if (!node)
            return undefined;
        if (node.leafCategoryTreeNode && node.category?.categoryId) {
            return {
                id: node.category.categoryId,
                name: node.category.categoryName,
            };
        }
        for (const child of node.childCategoryTreeNodes ?? []) {
            const leaf = this.walkToFirstLeaf(child);
            if (leaf)
                return leaf;
        }
        return undefined;
    }
    async findFirstLeafDescendant(parentCategoryId) {
        const visited = new Set();
        const queue = [parentCategoryId];
        let depth = 0;
        while (queue.length > 0 && depth < 10) {
            const currentBatch = queue.splice(0);
            const children = await this.ebayCategoryRepo.find({
                where: {
                    parentCategoryId: (0, typeorm_2.In)(currentBatch),
                    treeId: ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService.EBAY_MOTORS_TREE_ID,
                },
            });
            for (const child of children) {
                if (visited.has(child.ebayCategoryId))
                    continue;
                visited.add(child.ebayCategoryId);
                if (child.isLeaf) {
                    return { id: child.ebayCategoryId, name: child.categoryName };
                }
                queue.push(child.ebayCategoryId);
            }
            depth++;
        }
        return undefined;
    }
    async resolvePublishImages(listingId, provided) {
        const initial = (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)(provided);
        if (initial.imageUrls.length)
            return initial;
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        const catalog = await this.resolveCatalogProductForPublish(listingId, listing?.customLabelSku);
        if (catalog?.imageUrls?.length) {
            const filtered = filterTempS3Urls(catalog.imageUrls);
            const fromCatalog = (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)(filtered);
            if (fromCatalog.imageUrls.length)
                return fromCatalog;
        }
        if (listing?.itemPhotoUrl) {
            const filtered = filterTempS3Urls([listing.itemPhotoUrl]);
            const fromListing = (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)(filtered);
            if (fromListing.imageUrls.length)
                return fromListing;
        }
        return initial;
    }
    publishRequestLooksLikeStub(req) {
        return (!req.title?.trim() &&
            !req.description?.trim() &&
            !req.categoryId?.trim() &&
            req.price === 0 &&
            req.quantity === 0 &&
            !req.imageUrls?.length &&
            (req.sku === req.listingId || !req.sku?.trim()));
    }
    async resolveCatalogProductForPublish(listingId, sku) {
        const byId = await this.catalogRepo.findOne({ where: { id: listingId } });
        if (byId)
            return byId;
        const normalizedSku = sku?.trim();
        if (!normalizedSku)
            return null;
        return this.catalogRepo.findOne({ where: { sku: normalizedSku } });
    }
    async compatibilityFromCatalog(catalog) {
        if (!catalog)
            return undefined;
        const source = (0, fitment_mvl_util_js_1.selectPublishFitmentSource)(catalog.fitmentData, catalog.fitmentRows);
        const compatibility = (0, fitment_mvl_util_js_1.fitmentDataToCompatibilityPayload)(source);
        if (compatibility)
            return compatibility;
        const rows = Array.isArray(catalog.fitmentRows) ? catalog.fitmentRows : [];
        const needsReviewRows = rows.filter((r) => typeof r === 'object' &&
            r !== null &&
            (0, fitment_mvl_util_js_1.getFitmentValidationStatus)(r) === 'needs_review');
        if (needsReviewRows.length === 0)
            return undefined;
        return this.promoteAndBuildCompatibility(catalog, needsReviewRows);
    }
    async resolveCatalogCompatibility(catalog) {
        return this.compatibilityFromCatalog(catalog);
    }
    async buildCanonicalRecoveryProjection(listingRecordId, storeId) {
        const store = await this.storeRepo.findOneBy({ id: storeId });
        if (!store)
            throw new common_1.BadRequestException(`Store ${storeId} not found`);
        const base = this.stubPublishRequest(listingRecordId, [storeId]);
        const enriched = await this.enrichPublishRequest(base);
        const images = await this.resolvePublishImages(listingRecordId, enriched.imageUrls);
        if (!images.imageUrls.length) {
            throw new common_1.BadRequestException(`Canonical recovery source ${listingRecordId} has no valid image URLs.`);
        }
        const account = await this.connectedAccountRepo.findOne({
            where: { primaryStoreId: storeId },
        });
        const request = account
            ? await this.enrichPoliciesFromMarketplace(account, store, {
                ...enriched,
                imageUrls: await this.ebayMedia.hostImages(storeId, images.imageUrls),
            })
            : await this.enrichPoliciesFromStoreOnly(store, {
                ...enriched,
                imageUrls: await this.ebayMedia.hostImages(storeId, images.imageUrls),
            });
        return {
            sku: request.sku,
            item: this.buildInventoryItem(request, store),
            offer: this.buildOffer(request, store),
            compatibility: request.compatibility,
        };
    }
    async promoteAndBuildCompatibility(catalog, needsReviewRows) {
        try {
            const expanded = [];
            for (const row of needsReviewRows) {
                const make = row.make ?? row.Make;
                const model = row.model ?? row.Model;
                if (!make || !model)
                    continue;
                const yearStart = row.yearStart ?? row.YearStart;
                const yearEnd = row.yearEnd ?? row.YearEnd;
                const singleYear = row.year ?? row.Year;
                if (singleYear) {
                    expanded.push({ ...row, Year: singleYear, year: singleYear });
                }
                else if (yearStart != null && yearEnd != null) {
                    const start = Number(yearStart);
                    const end = Number(yearEnd);
                    if (Number.isFinite(start) && Number.isFinite(end)) {
                        for (let y = start; y <= end; y++) {
                            expanded.push({
                                ...row,
                                Year: String(y),
                                year: String(y),
                                yearStart: undefined,
                                yearEnd: undefined,
                            });
                        }
                    }
                }
            }
            if (expanded.length === 0)
                return undefined;
            const result = await this.mvlService.validateFitmentData(expanded, catalog.categoryId ?? '', { keepNeedsReview: false });
            if (result.validCount === 0) {
                this.logger.debug(`MVL re-validation for SKU ${catalog.sku}: 0/${expanded.length} rows promoted`);
                return undefined;
            }
            const promoted = (0, fitment_mvl_util_js_1.fitmentDataToCompatibilityPayload)(result.accepted);
            const existingRows = Array.isArray(catalog.fitmentRows)
                ? [...catalog.fitmentRows]
                : [];
            for (const row of existingRows) {
                const r = row;
                const rMake = r.make ?? r.Make;
                const rModel = r.model ?? r.Model;
                if (!rMake || !rModel)
                    continue;
                const matchingAccepted = result.accepted.filter((a) => (a.Make ?? a.make) === rMake && (a.Model ?? a.model) === rModel);
                if (matchingAccepted.length > 0) {
                    r.MvlStatus = 'valid';
                    r.fitmentValidationStatus = 'valid';
                }
            }
            await this.catalogRepo.update(catalog.id, {
                fitmentRows: existingRows,
                fitmentData: result.accepted,
                fitmentStatus: 'valid',
            });
            this.logger.log(`MVL re-validation for SKU ${catalog.sku}: promoted ${result.validCount}/${expanded.length} year-rows — compatibility data ready`);
            return promoted ?? undefined;
        }
        catch (err) {
            this.logger.warn(`MVL re-validation for SKU ${catalog.sku} failed: ${err instanceof Error ? err.message : err}`);
            return undefined;
        }
    }
    async categoryRequiresCompatibility(store, categoryId, account) {
        const marketplaceId = account
            ? this.resolvePublishMarketplaceId(account, store)
            : (0, ebay_marketplace_headers_util_js_1.resolveMarketplaceId)(store);
        const marketplace = this.mpConfig.require(marketplaceId);
        if (!marketplace.supportsMotorsFitment)
            return false;
        return true;
    }
    compatibilityRowKey(row) {
        return row.compatibilityProperties
            .map((property) => ({
            name: property.name.trim().toLowerCase(),
            value: property.value.trim().toLowerCase(),
        }))
            .filter((property) => property.name && property.value)
            .sort((a, b) => `${a.name}:${a.value}`.localeCompare(`${b.name}:${b.value}`))
            .map((property) => `${property.name}:${property.value}`)
            .join('|');
    }
    assertCompatibilityPersisted(sku, expected, actual) {
        const actualRows = new Set((actual.compatibleProducts ?? [])
            .map((row) => this.compatibilityRowKey(row))
            .filter(Boolean));
        const missingRows = expected.compatibleProducts.filter((row) => !actualRows.has(this.compatibilityRowKey(row)));
        const expectedRows = new Set(expected.compatibleProducts
            .map((row) => this.compatibilityRowKey(row))
            .filter(Boolean));
        const unexpectedRows = [...actualRows].filter((key) => !expectedRows.has(key));
        if (missingRows.length > 0 || unexpectedRows.length > 0) {
            throw new common_1.BadRequestException(`eBay compatibility verification failed for SKU ${sku}: ${missingRows.length} expected row(s) missing and ${unexpectedRows.length} stale row(s) present. The offer was not published.`);
        }
        this.logger.log(`Verified ${expected.compatibleProducts.length} structured eBay compatibility row(s) for SKU ${sku}`);
    }
    async syncInventoryCompatibility(storeId, req) {
        if (this.compatibilityReconciler) {
            await this.compatibilityReconciler.syncInventory(storeId, req.sku, req.compatibility);
            return;
        }
        if (req.compatibility?.compatibleProducts?.length) {
            await this.inventoryApi.setCompatibility(storeId, req.sku, req.compatibility);
            const persistedCompatibility = await this.inventoryApi.getCompatibility(storeId, req.sku);
            this.assertCompatibilityPersisted(req.sku, req.compatibility, persistedCompatibility);
            return;
        }
        await this.inventoryApi.deleteCompatibility(storeId, req.sku);
    }
    async refreshPublishedOfferCompatibility(storeId, offerId, req) {
        if (!this.compatibilityReconciler)
            return;
        await this.compatibilityReconciler.refreshPublishedOffer(storeId, offerId, req.sku, req.compatibility);
    }
    async enrichPublishRequest(req) {
        const listing = await this.listingRepo.findOne({
            where: { id: req.listingId },
        });
        const looksStub = this.publishRequestLooksLikeStub(req);
        const listingCondition = listing?.conditionId?.trim() || undefined;
        const clientSentNewPlaceholder = req.condition === 'NEW' && !!listingCondition;
        const conditionSource = looksStub || clientSentNewPlaceholder
            ? listingCondition
            : (req.condition ?? listingCondition ?? undefined);
        const mappedCondition = (0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(typeof conditionSource === 'string' ? conditionSource : undefined);
        if (!listing) {
            const catalog = await this.resolveCatalogProductForPublish(req.listingId, req.sku);
            const skuLooksLikeListingId = !req.sku?.trim() || req.sku === req.listingId;
            const sku = skuLooksLikeListingId
                ? catalog?.sku?.trim() || req.sku
                : req.sku.trim();
            const desc = (0, ebay_listing_text_util_js_1.buildEbayListingDescription)({
                description: req.description,
                title: req.title,
                sku,
            });
            return {
                ...req,
                sku,
                condition: mappedCondition,
                description: desc.description,
                quantity: (0, ebay_publish_quantity_util_js_1.capEbayPublishQuantity)(req.quantity),
            };
        }
        const skuLooksLikeListingId = !req.sku?.trim() || req.sku === req.listingId || req.sku === listing.id;
        const sku = skuLooksLikeListingId
            ? listing.customLabelSku?.trim() || req.sku
            : req.sku.trim();
        const catalog = await this.resolveCatalogProductForPublish(listing.id, sku);
        const compatibility = req.compatibility?.compatibleProducts?.length
            ? req.compatibility
            : await this.compatibilityFromCatalog(catalog);
        const parsedPrice = parseFloat(listing.startPrice ?? '');
        const parsedQty = parseInt(listing.quantity ?? '', 10);
        const title = req.title?.trim() || listing.title?.trim() || '';
        const desc = (0, ebay_listing_text_util_js_1.buildEbayListingDescription)({
            description: req.description?.trim() || listing.description?.trim() || '',
            title,
            brand: listing.cBrand,
            mpn: listing.cManufacturerPartNumber,
            sku,
            partType: listing.cType,
        });
        const aspects = (0, ebay_listing_aspects_util_js_1.buildListingAspects)({
            brand: listing.cBrand || listing.manufacturerName,
            mpn: listing.cManufacturerPartNumber,
            partType: listing.cType,
            upc: listing.pUpc,
            oeOemPartNumber: listing.cOeOemPartNumber,
            existing: req.aspects,
        });
        if (!aspects.Brand?.length) {
            aspects.Brand = ['Unbranded'];
        }
        const conditionDescription = req.conditionDescription?.trim() ||
            ((0, ebay_listing_aspects_util_js_1.isUsedEbayCondition)(mappedCondition)
                ? listing.cType?.trim() || title || 'Used item'
                : undefined);
        const listingDuration = req.listingDuration?.trim() ||
            (listing.duration?.trim().toUpperCase() === 'GTC' ? 'GTC' : undefined) ||
            'GTC';
        let categoryId = req.categoryId?.trim() || listing.categoryId?.trim() || '';
        if (!categoryId && catalog) {
            const categoryName = catalog.categoryName;
            if (categoryName?.trim()) {
                try {
                    const suggestions = await this.taxonomyApi.getCategorySuggestions(categoryName.trim(), ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService.EBAY_MOTORS_TREE_ID);
                    const motorsMatch = suggestions.find((s) => s.categoryTreeNodeAncestors?.some((a) => a.categoryId === '6000'));
                    const match = motorsMatch ?? suggestions[0];
                    if (match?.category?.categoryId) {
                        categoryId = match.category.categoryId;
                        const underMotors = motorsMatch != null ||
                            match.categoryTreeNodeAncestors?.some((a) => a.categoryId === '6000');
                        this.logger.log(`Resolved eBay category for SKU ${sku}: "${categoryName}" → ${categoryId} (${match.category.categoryName}) [Motors=${underMotors}]`);
                        if (!underMotors) {
                            this.logger.warn(`Category ${categoryId} (${match.category.categoryName}) for SKU ${sku} is NOT under Motors tree 6000 — may be invalid for eBay Motors listings`);
                        }
                        await this.catalogRepo.update(catalog.id, {
                            categoryId,
                            categoryName: match.category.categoryName ?? categoryName,
                        });
                    }
                }
                catch (err) {
                    this.logger.warn(`Failed to resolve eBay category from "${categoryName}" for SKU ${sku}: ${err instanceof Error ? err.message : err}`);
                }
            }
        }
        const resolvedQuantity = !looksStub && Number.isFinite(req.quantity) && req.quantity >= 0
            ? req.quantity
            : Number.isFinite(parsedQty) && parsedQty >= 0
                ? parsedQty
                : Number.isFinite(req.quantity) && req.quantity >= 0
                    ? req.quantity
                    : 1;
        return {
            ...req,
            sku,
            title,
            description: desc.description,
            categoryId,
            condition: mappedCondition,
            conditionDescription,
            listingDuration,
            aspects,
            compatibility,
            price: req.price > 0
                ? req.price
                : Number.isFinite(parsedPrice)
                    ? parsedPrice
                    : req.price,
            quantity: (0, ebay_publish_quantity_util_js_1.capEbayPublishQuantity)(resolvedQuantity),
            requestedFulfillmentPolicyName: req.requestedFulfillmentPolicyName?.trim() ||
                listing.shippingProfileName?.trim() ||
                undefined,
            requestedReturnPolicyName: req.requestedReturnPolicyName?.trim() ||
                listing.returnProfileName?.trim() ||
                undefined,
            requestedPaymentPolicyName: req.requestedPaymentPolicyName?.trim() ||
                listing.paymentProfileName?.trim() ||
                undefined,
        };
    }
    async logPolicyDetails(fulfillmentPolicyId, storeName, sku) {
        if (!fulfillmentPolicyId)
            return;
        try {
            const policy = await this.policyRepo.findOne({
                where: { ebayPolicyId: fulfillmentPolicyId },
            });
            if (!policy) {
                this.logger.warn(`Policy ${fulfillmentPolicyId} not found in database for SKU ${sku} on "${storeName}"`);
                return;
            }
            const raw = policy.rawPayload;
            const shippingOptions = raw?.shippingOptions;
            let shippingCost;
            let serviceCode;
            if (shippingOptions?.[0]?.shippingServices) {
                const services = shippingOptions[0].shippingServices;
                if (services[0]?.shippingCost) {
                    const cost = services[0].shippingCost;
                    shippingCost = cost.value
                        ? `${cost.value} ${cost.currency || 'USD'}`
                        : undefined;
                }
                serviceCode = services[0]?.shippingServiceCode;
            }
            this.logger.log(`Policy details for SKU ${sku} on "${storeName}": ` +
                `ID=${fulfillmentPolicyId}, Name="${policy.name}", ` +
                `ShippingCost=${shippingCost || 'N/A'}, Service=${serviceCode || 'N/A'}`);
        }
        catch (err) {
            this.logger.warn(`Failed to log policy details for ${fulfillmentPolicyId}: ${err}`);
        }
    }
    validateDirectOffer(offer, store) {
        const policies = offer.listingPolicies ?? {};
        if (!policies.fulfillmentPolicyId?.trim()) {
            return `Missing fulfillment policy for "${store.storeName}". Sync eBay policies in Settings → eBay Integrations.`;
        }
        if (!policies.paymentPolicyId?.trim()) {
            return `Missing payment policy for "${store.storeName}". Sync eBay policies in Settings → eBay Integrations.`;
        }
        if (!policies.returnPolicyId?.trim()) {
            return `Missing return policy for "${store.storeName}". Sync eBay policies in Settings → eBay Integrations.`;
        }
        if (!offer.categoryId?.trim()) {
            return 'eBay category is required before publishing.';
        }
        if (!offer.merchantLocationKey?.trim()) {
            return `Missing inventory location for "${store.storeName}". Sync policies from eBay or map a merchant location key.`;
        }
        return null;
    }
    shouldUseTradingApi() {
        return true;
    }
    async publish(req) {
        if (!req.storeIds.length) {
            throw new common_1.BadRequestException('At least one storeId is required');
        }
        const enriched = await this.enrichPublishRequest(req);
        const listing = await this.listingRepo.findOne({
            where: { id: enriched.listingId },
        });
        const listingOem = listing?.cOeOemPartNumber ?? listing?.cManufacturerPartNumber ?? '';
        const catalogForText = await this.resolveCatalogProductForPublish(enriched.listingId, enriched.sku);
        const parsedFitmentRows = (catalogForText?.fitmentData ?? [])
            .map((row) => (0, fitment_mvl_util_js_1.parseFitmentEntry)(row))
            .filter((row) => row !== null);
        const fitmentMake = parsedFitmentRows[0]?.make?.trim() || null;
        const fitmentYears = parsedFitmentRows
            .map((row) => Number(row.year))
            .filter((y) => Number.isFinite(y));
        const fitmentYearRange = fitmentYears.length
            ? (() => {
                const min = Math.min(...fitmentYears);
                const max = Math.max(...fitmentYears);
                return min === max ? String(min) : `${min}-${max}`;
            })()
            : null;
        const rawMake = (listing?.cBrand ?? listing?.extractedMake ?? '').trim();
        const resolvedMake = (rawMake && fitmentMake && (0, fitment_mvl_util_js_1.isSameMakeVariant)(rawMake, fitmentMake)
            ? fitmentMake
            : rawMake) ||
            fitmentMake ||
            null;
        const sanitized = (0, ebay_listing_text_util_js_1.sanitizePublishListingText)({
            title: enriched.title,
            description: enriched.description,
            sku: enriched.sku,
            brand: listing?.cBrand,
            mpn: listing?.cManufacturerPartNumber,
            partType: listing?.cType,
            yearRange: fitmentYearRange,
            make: resolvedMake,
            model: (listing?.extractedModel ?? '').trim() || null,
            position: (listing?.cPlacement ?? '').trim() || null,
            partName: (listing?.cType ?? '').trim() || null,
            oemPartNumber: listingOem.trim() || null,
        });
        if (sanitized.warnings.length) {
            this.logger.debug(`Publish text warnings for "${enriched.sku}": ${sanitized.warnings.join('; ')}`);
        }
        const images = await this.resolvePublishImages(enriched.listingId, enriched.imageUrls);
        if (!images.imageUrls.length) {
            throw new common_1.BadRequestException('At least one valid image URL (http/https) is required to publish');
        }
        const normalizedReq = {
            ...enriched,
            title: sanitized.title,
            description: sanitized.description,
            imageUrls: images.imageUrls,
        };
        const results = [];
        for (const storeId of req.storeIds) {
            const result = await this.publishToStore(storeId, normalizedReq);
            results.push(result);
        }
        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        this.logger.log(`Publish "${req.sku}" complete: ${succeeded} succeeded, ${failed} failed across ${req.storeIds.length} stores`);
        if (succeeded > 0) {
            const firstSuccess = results.find((r) => r.success);
            try {
                await this.listingRepo.update(req.listingId, {
                    status: 'published',
                    publishedAt: new Date(),
                    ...(firstSuccess?.listingId
                        ? { ebayListingId: firstSuccess.listingId }
                        : {}),
                });
            }
            catch (writeErr) {
                this.logger.warn(`Failed to write publish status for listing ${req.listingId}: ${writeErr.message}`);
            }
            try {
                const listing = await this.listingRepo.findOne({
                    where: { id: req.listingId },
                });
                if (listing?.customLabelSku) {
                    const catalog = await this.catalogRepo.findOne({
                        where: { sku: listing.customLabelSku },
                    });
                    if (catalog) {
                        let dirty = false;
                        if (firstSuccess?.listingId &&
                            catalog.ebayItemId !== firstSuccess.listingId) {
                            catalog.ebayItemId = firstSuccess.listingId;
                            dirty = true;
                        }
                        if (listing.shippingProfileName?.trim() &&
                            listing.shippingProfileName.trim() !==
                                (catalog.shippingProfile ?? '')) {
                            catalog.shippingProfile = listing.shippingProfileName.trim();
                            dirty = true;
                        }
                        if (listing.returnProfileName?.trim() &&
                            listing.returnProfileName.trim() !== (catalog.returnProfile ?? '')) {
                            catalog.returnProfile = listing.returnProfileName.trim();
                            dirty = true;
                        }
                        if (listing.paymentProfileName?.trim() &&
                            listing.paymentProfileName.trim() !==
                                (catalog.paymentProfile ?? '')) {
                            catalog.paymentProfile = listing.paymentProfileName.trim();
                            dirty = true;
                        }
                        if (dirty) {
                            await this.catalogRepo.save(catalog);
                        }
                    }
                }
            }
            catch (syncErr) {
                this.logger.warn(`Failed to sync profiles to catalog after publish for listing ${req.listingId}: ${syncErr.message}`);
            }
        }
        return results;
    }
    async publishByListingIds(listingIds, storeIds, options) {
        if (!storeIds.length) {
            throw new common_1.BadRequestException('At least one storeId is required');
        }
        if (options?.shippingProfileName ||
            options?.returnProfileName ||
            options?.paymentProfileName) {
            await this.applyListingProfileNames(listingIds, options);
        }
        const CONCURRENCY = 5;
        const allResults = [];
        for (let i = 0; i < listingIds.length; i += CONCURRENCY) {
            const chunk = listingIds.slice(i, i + CONCURRENCY);
            const chunkResults = await Promise.allSettled(chunk.map((id) => this.publish(this.stubPublishRequest(id, storeIds, options))));
            for (let j = 0; j < chunk.length; j++) {
                const settled = chunkResults[j];
                allResults.push({
                    listingId: chunk[j],
                    results: settled.status === 'fulfilled'
                        ? settled.value
                        : storeIds.map((storeId) => ({
                            storeId,
                            storeName: storeId,
                            success: false,
                            error: settled.reason instanceof Error
                                ? settled.reason.message
                                : 'Unknown error',
                        })),
                });
            }
        }
        return allResults;
    }
    async applyListingProfileNames(listingIds, options) {
        const listings = await this.listingRepo.findBy({ id: (0, typeorm_2.In)(listingIds) });
        for (const listing of listings) {
            if (options.shippingProfileName) {
                listing.shippingProfileName = options.shippingProfileName;
            }
            if (options.returnProfileName) {
                listing.returnProfileName = options.returnProfileName;
            }
            if (options.paymentProfileName) {
                listing.paymentProfileName = options.paymentProfileName;
            }
        }
        if (listings.length) {
            await this.listingRepo.save(listings);
        }
    }
    stubPublishRequest(listingId, storeIds, options) {
        return {
            listingId,
            storeIds,
            sku: listingId,
            title: '',
            description: '',
            categoryId: '',
            condition: 'NEW',
            price: 0,
            quantity: 0,
            imageUrls: [],
            aspects: {},
            fulfillmentPolicyId: options?.fulfillmentPolicyId,
            paymentPolicyId: options?.paymentPolicyId,
            returnPolicyId: options?.returnPolicyId,
            requestedFulfillmentPolicyName: options?.shippingProfileName,
            requestedReturnPolicyName: options?.returnProfileName,
            requestedPaymentPolicyName: options?.paymentProfileName,
        };
    }
    async persistResolvedCategory(req, resolution) {
        try {
            const categoryName = resolution.name || FALLBACK_MOTORS_CATEGORY.name;
            const listing = await this.listingRepo.findOne({
                where: { id: req.listingId },
            });
            const sku = req.sku?.trim() || listing?.customLabelSku?.trim();
            const catalog = await this.resolveCatalogProductForPublish(req.listingId, sku);
            if (catalog) {
                await this.catalogRepo.update(catalog.id, {
                    categoryId: resolution.id,
                    categoryName,
                    optimizationPayload: {
                        ...(catalog.optimizationPayload ?? {}),
                        categoryId: resolution.id,
                        categoryName,
                    },
                });
            }
            if (listing) {
                await this.listingRepo.update(listing.id, {
                    categoryId: resolution.id,
                    categoryName,
                });
            }
            if (sku) {
                await this.listingRepo.update({ customLabelSku: sku }, { categoryId: resolution.id, categoryName });
            }
            this.logger.warn(`Persisted eBay Motors leaf category ${resolution.id} (${categoryName}) for SKU ${sku ?? req.listingId}${resolution.usedFallback ? ' using fallback' : ''}`);
        }
        catch (err) {
            this.logger.error(`Failed to persist resolved eBay category ${resolution.id} for ${req.sku || req.listingId}: ${err instanceof Error ? err.message : err}`);
        }
    }
    async publishToStore(storeId, req) {
        const store = await this.storeRepo.findOneBy({ id: storeId });
        if (!store) {
            return {
                storeId,
                storeName: 'Unknown',
                success: false,
                error: `Store ${storeId} not found`,
            };
        }
        const account = await this.connectedAccountRepo.findOne({
            where: { primaryStoreId: storeId },
        });
        const marketplaceId = account
            ? this.resolvePublishMarketplaceId(account, store)
            : (0, ebay_marketplace_headers_util_js_1.resolveMarketplaceId)(store);
        let hostedImageUrls;
        try {
            const hostedListingImages = await this.ebayMedia.hostImages(storeId, req.imageUrls);
            const appendNewConditionImages = req.condition === 'NEW';
            if (appendNewConditionImages) {
                const requiredSourceImages = await this.ebayMedia.getNewConditionImageUrls();
                const hostedRequiredImages = await this.ebayMedia.hostImages(storeId, requiredSourceImages);
                if (hostedRequiredImages.length !== requiredSourceImages.length) {
                    throw new Error(`Could not host all ${requiredSourceImages.length} required New-condition images; listing was not published`);
                }
                const distinctBaseImages = hostedListingImages.filter((url) => !hostedRequiredImages.some((requiredUrl) => requiredUrl.toLowerCase() === url.toLowerCase()));
                if (distinctBaseImages.length >
                    ebay_listing_images_util_js_1.EBAY_MAX_LISTING_IMAGES - hostedRequiredImages.length) {
                    this.logger.warn(`New-condition listing ${req.sku} exceeds eBay's ${ebay_listing_images_util_js_1.EBAY_MAX_LISTING_IMAGES}-image limit; trimming earlier gallery images to append F1, F2, and F3`);
                }
                hostedImageUrls = appendImageUrlsAtEnd(hostedListingImages, hostedRequiredImages);
            }
            else {
                hostedImageUrls = hostedListingImages;
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`eBay image hosting failed for "${store.storeName}" / SKU ${req.sku}: ${message}`);
            return {
                storeId,
                storeName: store.storeName,
                success: false,
                error: message,
            };
        }
        req = { ...req, imageUrls: hostedImageUrls };
        const marketplace = this.mpConfig.require(marketplaceId);
        if (!marketplace.supportsMotorsFitment &&
            req.compatibility?.compatibleProducts?.length) {
            this.logger.debug(`Omitting structured Motors fitment for ${marketplaceId} on "${store.storeName}"`);
            req = { ...req, compatibility: undefined };
        }
        if (marketplaceId === 'EBAY_MOTORS_US') {
            const currentCategoryId = req.categoryId?.trim() ?? '';
            const resolved = await this.ensureLeafCategoryId(currentCategoryId, req.sku);
            if (resolved.id !== currentCategoryId) {
                await this.persistResolvedCategory(req, resolved);
            }
            if (req.categoryId !== resolved.id) {
                req = { ...req, categoryId: resolved.id };
            }
        }
        if (!req.compatibility?.compatibleProducts?.length) {
            const requiresCompatibility = await this.categoryRequiresCompatibility(store, req.categoryId, account);
            if (requiresCompatibility) {
                this.logger.warn(`SKU ${req.sku}: no structured fitment rows found for Motors category ${req.categoryId} — publishing with description-only fitment. Run optimization to add structured compatibility.`);
            }
        }
        const existingChannel = account
            ? await this.channelRepo.findOne({
                where: {
                    ebayAccountId: account.id,
                    marketplaceId,
                    internalSku: req.sku,
                },
                order: { updatedAt: 'DESC' },
            })
            : null;
        if (existingChannel?.offerId && existingChannel.ebayInventorySku) {
            const inventoryReq = account
                ? await this.enrichPoliciesFromMarketplace(account, store, req)
                : await this.enrichPoliciesFromStoreOnly(store, req);
            return this.reviseExistingInventoryListing(store, storeId, inventoryReq, account, existingChannel);
        }
        if (this.shouldUseTradingApi()) {
            this.logger.log(`Using eBay Trading API for SKU ${req.sku}`);
            const tradingReq = account
                ? await this.enrichPoliciesFromMarketplace(account, store, req)
                : await this.enrichPoliciesFromStoreOnly(store, req);
            if (existingChannel?.listingId) {
                return this.reviseExistingTradingListing(store, storeId, tradingReq, account, marketplaceId, existingChannel);
            }
            return this.publishViaTradingApi(store, storeId, tradingReq, account);
        }
        try {
            await this.assertRemoteSkuOwnership(storeId, store, req, account);
        }
        catch (collisionErr) {
            const canonicalSku = req.sku;
            const alternateSku = (0, ebay_sku_util_js_1.conflictSafeSkuFor)(canonicalSku);
            if (!alternateSku) {
                return this.formatDirectPublishFailure(store, storeId, req, collisionErr, account);
            }
            const alternateReq = { ...req, sku: alternateSku };
            try {
                await this.assertRemoteSkuOwnership(storeId, store, alternateReq, account);
                req = alternateReq;
                this.logger.warn(`Canonical eBay SKU ${canonicalSku} is occupied; ` +
                    `using deterministic conflict-safe SKU ${req.sku}.`);
            }
            catch (alternateErr) {
                return this.formatDirectPublishFailure(store, storeId, alternateReq, alternateErr, account);
            }
        }
        const fallbackMode = (0, sellerpundit_publish_util_js_1.parseSellerpunditPublishFallbackMode)(this.config.get('SELLERPUNDIT_PUBLISH_FALLBACK'));
        if (account?.connectionSource === 'sellerpundit' &&
            !req.compatibility?.compatibleProducts?.length &&
            (0, sellerpundit_publish_util_js_1.shouldAttemptSellerpunditBulkCreate)(fallbackMode, req.forceDirectEbay)) {
            const spResult = await this.publishViaSellerpundit(store, account, req);
            if (spResult.success) {
                try {
                    await this.syncInventoryCompatibility(storeId, req);
                    if (spResult.offerId) {
                        await this.refreshPublishedOfferCompatibility(storeId, spResult.offerId, req);
                    }
                    if (!spResult.offerId || !spResult.listingId) {
                        throw new common_1.BadRequestException(`SellerPundit returned an incomplete eBay publish result for SKU ${req.sku}; ` +
                            'the listing cannot be accepted without both offer and listing IDs.');
                    }
                    const verifiedRequest = await this.enrichPoliciesFromMarketplace(account, store, req);
                    await this.verifyPublishedProjection(storeId, spResult.offerId, spResult.listingId, verifiedRequest, store);
                }
                catch (err) {
                    if (spResult.offerId) {
                        await this.inventoryApi
                            .withdrawOffer(storeId, spResult.offerId)
                            .catch((withdrawErr) => this.logger.error(`Could not withdraw SellerPundit offer ${spResult.offerId} after compatibility verification failed`, withdrawErr));
                    }
                    return this.formatDirectPublishFailure(store, storeId, req, err, account);
                }
                return { ...spResult, effectiveSku: req.sku };
            }
            if ((0, sellerpundit_publish_util_js_1.shouldFallbackFromSellerpunditBulkCreate)(fallbackMode, spResult)) {
                this.logger.warn(`SellerPundit bulk-create unavailable for "${store.storeName}"` +
                    (spResult.error ? ` (${spResult.error})` : '') +
                    ' — falling back to direct eBay Inventory API');
                const enriched = await this.enrichPoliciesFromMarketplace(account, store, req);
                const directResult = await this.publishViaDirectEbay(store, storeId, {
                    ...enriched,
                    forceDirectEbay: true,
                }, account);
                return directResult.success
                    ? { ...directResult, effectiveSku: req.sku }
                    : directResult;
            }
            return spResult;
        }
        const directReq = account
            ? await this.enrichPoliciesFromMarketplace(account, store, req)
            : await this.enrichPoliciesFromStoreOnly(store, req);
        const directResult = await this.publishViaDirectEbay(store, storeId, directReq, account);
        return directResult.success
            ? { ...directResult, effectiveSku: req.sku }
            : directResult;
    }
    tradingConditionId(condition) {
        switch ((0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(condition)) {
            case 'NEW':
                return 1000;
            case 'NEW_OTHER':
                return 1500;
            case 'FOR_PARTS_OR_NOT_WORKING':
                return 7000;
            case 'MANUFACTURER_REFURBISHED':
            case 'CERTIFIED_REFURBISHED':
            case 'EXCELLENT_REFURBISHED':
            case 'VERY_GOOD_REFURBISHED':
            case 'GOOD_REFURBISHED':
            case 'SELLER_REFURBISHED':
                return 2000;
            default:
                return 3000;
        }
    }
    async reviseExistingInventoryListing(store, storeId, req, account, channel) {
        const offerId = channel.offerId;
        const sku = channel.ebayInventorySku?.trim();
        try {
            if (!offerId || !sku) {
                throw new common_1.BadRequestException(`The existing eBay channel for SKU ${req.sku} is missing its Inventory API offer mapping.`);
            }
            const inventoryReq = sku === req.sku ? req : { ...req, sku };
            if (account?.connectionSource === 'sellerpundit') {
                await this.sellerpunditTokens.ensureFreshAccessToken(account.id, {
                    force: true,
                });
            }
            const marketplaceId = this.resolvePublishMarketplaceId(account, store);
            const expectedOffer = this.buildOffer(inventoryReq, store);
            let currentOffer = null;
            let staleOfferConfirmedEnded = false;
            try {
                currentOffer = await this.inventoryApi.getOffer(storeId, offerId);
            }
            catch (error) {
                if (!(0, ebay_api_error_util_js_1.isEbayOfferUnavailableError)(error))
                    throw error;
                if (!channel.listingId) {
                    throw new common_1.BadRequestException(`eBay offer ${offerId} is unavailable and has no mapped listing ID; replacement stopped to avoid creating a duplicate.`);
                }
                const linkedListing = await this.tradingApi.getItemDetails(storeId, channel.listingId, this.resolvePublishMarketplaceId(account, store));
                const linkedStatus = String(linkedListing.listingStatus ?? '').toUpperCase();
                if (linkedStatus !== 'COMPLETED' && linkedStatus !== 'ENDED') {
                    throw new common_1.BadRequestException(`eBay offer ${offerId} is unavailable, but linked listing ${channel.listingId} is ${linkedStatus || 'unknown'}; replacement is allowed only after eBay confirms the listing has ended.`);
                }
                staleOfferConfirmedEnded = true;
                this.logger.warn(`eBay confirmed linked listing ${channel.listingId} ended while Inventory offer ${offerId} is unavailable; creating a replacement offer for SKU ${sku}.`);
            }
            if (!staleOfferConfirmedEnded &&
                (currentOffer?.sku !== sku ||
                    currentOffer?.marketplaceId !== expectedOffer.marketplaceId)) {
                throw new common_1.BadRequestException(`The stored eBay offer ${offerId} no longer matches SKU ${sku} and marketplace ${marketplaceId}; publishing stopped to avoid changing a different listing.`);
            }
            const offerStatus = staleOfferConfirmedEnded
                ? 'UNPUBLISHED'
                : String(currentOffer?.status ?? '').toUpperCase();
            if (offerStatus !== 'PUBLISHED' && offerStatus !== 'UNPUBLISHED') {
                throw new common_1.BadRequestException(`eBay returned an unrecognized status (${offerStatus || 'missing'}) for offer ${offerId}; publishing stopped to avoid creating a duplicate listing.`);
            }
            let listingId = offerStatus === 'PUBLISHED'
                ? currentOffer?.listingId ??
                    currentOffer?.listing?.listingId ??
                    channel.listingId ??
                    ''
                : '';
            if (offerStatus === 'PUBLISHED' && !listingId) {
                throw new common_1.BadRequestException(`eBay reports offer ${offerId} as published but returned no listing ID. Refresh the eBay channel mapping before retrying.`);
            }
            const validationError = this.validateDirectOffer(expectedOffer, store);
            if (validationError)
                throw new common_1.BadRequestException(validationError);
            await this.inventoryApi.createOrReplaceItem(storeId, sku, this.buildInventoryItem(inventoryReq, store));
            await this.syncInventoryCompatibility(storeId, inventoryReq);
            let publishedOfferId = offerId;
            try {
                if (staleOfferConfirmedEnded) {
                    throw new Error('This Offer is not available (25713) after confirming the linked listing ended.');
                }
                await this.inventoryApi.updateOffer(storeId, publishedOfferId, expectedOffer);
                await this.refreshPublishedOfferCompatibility(storeId, publishedOfferId, inventoryReq);
                if (offerStatus === 'UNPUBLISHED') {
                    const published = await this.publishOfferWithRetries(storeId, publishedOfferId, store, account, inventoryReq);
                    listingId = published.listingId;
                }
            }
            catch (error) {
                if (offerStatus !== 'UNPUBLISHED' ||
                    !(0, ebay_api_error_util_js_1.isEbayOfferUnavailableError)(error)) {
                    throw error;
                }
                this.logger.warn(`eBay offer ${publishedOfferId} for SKU ${sku} is unavailable; replacing only that unpublished offer and retaining the Inventory SKU.`);
                await this.inventoryApi
                    .deleteOffer(storeId, publishedOfferId)
                    .catch((deleteError) => {
                    if (!this.isEbayNotFound(deleteError) &&
                        !(0, ebay_api_error_util_js_1.isEbayOfferUnavailableError)(deleteError)) {
                        throw deleteError;
                    }
                    this.logger.warn(`eBay no longer exposes unavailable offer ${publishedOfferId}; trying a fresh offer for SKU ${sku}.`);
                });
                let replacementStatus;
                let replacementListingId;
                try {
                    const replacement = await this.inventoryApi.createOffer(storeId, expectedOffer);
                    publishedOfferId = replacement.offerId;
                    replacementStatus = 'UNPUBLISHED';
                }
                catch (createError) {
                    if (!(0, ebay_api_error_util_js_1.isEbayOfferAlreadyExistsError)(createError))
                        throw createError;
                    const existingId = (0, ebay_api_error_util_js_1.extractEbayErrorParameter)(createError, 'offerId');
                    let existingOffer;
                    if (existingId) {
                        existingOffer = await this.inventoryApi.getOffer(storeId, existingId);
                    }
                    else {
                        const { offers } = await this.inventoryApi.getOffersBySku(storeId, sku);
                        const matches = offers.filter((candidate) => candidate.sku === sku &&
                            candidate.marketplaceId === expectedOffer.marketplaceId);
                        if (matches.length !== 1)
                            throw createError;
                        existingOffer = matches[0];
                    }
                    if (existingOffer.sku !== sku ||
                        existingOffer.marketplaceId !== expectedOffer.marketplaceId) {
                        throw new common_1.BadRequestException(`eBay's existing offer does not match SKU ${sku} and marketplace ${expectedOffer.marketplaceId}; recovery stopped.`);
                    }
                    if (!existingOffer.offerId && !existingId) {
                        throw new common_1.BadRequestException(`eBay returned an existing offer for SKU ${sku} without its offer ID; recovery stopped.`);
                    }
                    publishedOfferId = existingOffer.offerId ?? existingId;
                    replacementStatus = String(existingOffer.status ?? '').toUpperCase();
                    if (replacementStatus !== 'PUBLISHED' &&
                        replacementStatus !== 'UNPUBLISHED') {
                        throw new common_1.BadRequestException(`eBay returned status ${replacementStatus || 'unknown'} for existing offer ${publishedOfferId}; recovery stopped.`);
                    }
                    await this.inventoryApi.updateOffer(storeId, publishedOfferId, expectedOffer);
                    if (replacementStatus === 'PUBLISHED') {
                        replacementListingId =
                            existingOffer.listingId ?? existingOffer.listing?.listingId;
                        if (!replacementListingId) {
                            throw new common_1.BadRequestException(`eBay reports existing offer ${publishedOfferId} as published without a listing ID; recovery stopped.`);
                        }
                    }
                    this.logger.warn(`Reusing verified ${replacementStatus} offer ${publishedOfferId} for SKU ${sku} after eBay rejected a duplicate offer creation.`);
                }
                await this.refreshPublishedOfferCompatibility(storeId, publishedOfferId, inventoryReq);
                if (replacementStatus === 'PUBLISHED') {
                    listingId = replacementListingId;
                }
                else {
                    const published = await this.publishOfferWithRetries(storeId, publishedOfferId, store, account, inventoryReq);
                    listingId = published.listingId;
                }
            }
            await this.verifyPublishedProjection(storeId, publishedOfferId, listingId, inventoryReq, store);
            channel.internalSku = req.sku;
            channel.ebayInventorySku = sku;
            channel.offerId = publishedOfferId;
            channel.listingId = listingId;
            channel.channelPrice = String(req.price);
            channel.channelQuantity = req.quantity;
            channel.listingStatus = 'published';
            channel.lastRevisedAt = new Date();
            channel.lastSyncedAt = new Date();
            channel.lastErrorCode = null;
            channel.lastErrorMessage = null;
            await this.channelRepo.save(channel);
            return {
                storeId,
                storeName: store.storeName,
                success: true,
                offerId: publishedOfferId,
                listingId,
                effectiveSku: sku,
            };
        }
        catch (error) {
            return this.formatDirectPublishFailure(store, storeId, req, error, account);
        }
    }
    async reviseExistingTradingListing(store, storeId, req, account, marketplaceId, channel) {
        if (!channel.listingId) {
            return {
                storeId,
                storeName: store.storeName,
                success: false,
                error: `The existing eBay channel for SKU ${req.sku} has no listing ID.`,
            };
        }
        try {
            if (account?.connectionSource === 'sellerpundit') {
                await this.sellerpunditTokens.ensureFreshAccessToken(account.id, {
                    force: true,
                });
            }
            await this.tradingApi.reviseFixedPriceItem(storeId, channel.listingId, {
                title: req.title,
                description: req.description,
                categoryId: req.categoryId,
                price: req.price,
                quantity: req.quantity,
                currency: req.currency ?? this.mpConfig.require(marketplaceId).currency,
                imageUrls: req.imageUrls,
                itemSpecifics: (0, ebay_listing_aspects_util_js_1.localizeAspectsForMarketplace)(req.aspects, marketplaceId),
                compatibility: req.compatibility,
            }, marketplaceId);
            channel.internalSku = req.sku;
            channel.channelPrice = String(req.price);
            channel.channelQuantity = req.quantity;
            channel.listingStatus = 'published';
            channel.lastRevisedAt = new Date();
            channel.lastSyncedAt = new Date();
            channel.lastErrorCode = null;
            channel.lastErrorMessage = null;
            await this.channelRepo.save(channel);
            return {
                storeId,
                storeName: store.storeName,
                success: true,
                listingId: channel.listingId,
                effectiveSku: req.sku,
            };
        }
        catch (error) {
            return this.formatDirectPublishFailure(store, storeId, req, error, account);
        }
    }
    async publishViaTradingApi(store, storeId, req, account) {
        if ((req.listingFormat ?? 'FIXED_PRICE') !== 'FIXED_PRICE') {
            return {
                storeId,
                storeName: store.storeName,
                success: false,
                error: 'Trading API migration mode currently supports fixed-price listings only',
            };
        }
        try {
            if (account?.connectionSource === 'sellerpundit') {
                await this.sellerpunditTokens.ensureFreshAccessToken(account.id, {
                    force: true,
                });
            }
            const storeConfig = (store.config ?? {});
            const locationKey = req.merchantLocationKey?.trim() ||
                store.locationKey?.trim() ||
                (typeof storeConfig.locationKey === 'string'
                    ? storeConfig.locationKey.trim()
                    : '');
            const liveLocation = locationKey
                ? await this.inventoryApi.getLocation(storeId, locationKey).catch(() => null)
                : null;
            const address = liveLocation?.location?.address;
            const location = liveLocation?.name?.trim() ||
                address?.city?.trim() ||
                (typeof storeConfig.location === 'string'
                    ? storeConfig.location.trim()
                    : '') ||
                store.storeName;
            const marketplaceId = this.resolvePublishMarketplaceId(account, store);
            const country = address?.country?.trim() ||
                (marketplaceId === 'EBAY_GB'
                    ? 'GB'
                    : marketplaceId === 'EBAY_DE'
                        ? 'DE'
                        : marketplaceId === 'EBAY_AU'
                            ? 'AU'
                            : 'US');
            const created = await this.tradingApi.addFixedPriceItem(storeId, {
                title: req.title,
                description: req.description,
                categoryId: req.categoryId,
                conditionId: this.tradingConditionId(req.condition),
                quantity: req.quantity,
                price: req.price,
                currency: req.currency ?? this.mpConfig.require(marketplaceId).currency,
                sku: req.sku,
                imageUrls: req.imageUrls,
                itemSpecifics: (0, ebay_listing_aspects_util_js_1.localizeAspectsForMarketplace)(req.aspects, marketplaceId),
                compatibility: req.compatibility,
                listingDuration: req.listingDuration ?? 'GTC',
                location,
                country,
                postalCode: address?.postalCode?.trim() || null,
                conditionDescription: req.conditionDescription,
                paymentProfileId: req.paymentPolicyId,
                shippingProfileId: req.fulfillmentPolicyId,
                returnProfileId: req.returnPolicyId,
            }, marketplaceId);
            return {
                storeId,
                storeName: store.storeName,
                success: true,
                listingId: created.itemId,
                effectiveSku: req.sku,
            };
        }
        catch (error) {
            return this.formatDirectPublishFailure(store, storeId, req, error, account);
        }
    }
    async publishViaDirectEbay(store, storeId, req, account) {
        const runDirectPublish = async () => {
            const inventoryItem = this.buildInventoryItem(req, store);
            await this.inventoryApi.createOrReplaceItem(storeId, req.sku, inventoryItem);
            await this.syncInventoryCompatibility(storeId, req);
            const offer = this.buildOffer(req, store);
            await this.logPolicyDetails(offer.listingPolicies?.fulfillmentPolicyId, store.storeName, req.sku);
            const offerValidationError = this.validateDirectOffer(offer, store);
            if (offerValidationError) {
                return {
                    storeId,
                    storeName: store.storeName,
                    success: false,
                    error: offerValidationError,
                };
            }
            const offerId = await this.resolveOrCreateOfferId(storeId, offer, store, inventoryItem);
            await this.refreshPublishedOfferCompatibility(storeId, offerId, req);
            let publishResult;
            let publishedOfferId = offerId;
            try {
                publishResult = await this.publishOfferWithRetries(storeId, offerId, store, account, req);
            }
            catch (publishErr) {
                if ((0, ebay_api_error_util_js_1.isEbayInvalidItemConditionError)(publishErr)) {
                    const fallbackCondition = this.fallbackConditionForCategory(req);
                    if (fallbackCondition && fallbackCondition !== req.condition) {
                        this.logger.warn(`Publish rejected condition "${req.condition}" for SKU ${req.sku} — retrying with ${fallbackCondition}`);
                        const retryItem = this.buildInventoryItem({
                            ...req,
                            condition: fallbackCondition,
                        }, store);
                        await this.inventoryApi.createOrReplaceItem(storeId, req.sku, retryItem);
                        publishResult = await this.publishOfferWithRetries(storeId, offerId, store, account, { ...req, condition: fallbackCondition });
                    }
                    else {
                        throw publishErr;
                    }
                }
                else if ((0, ebay_api_error_util_js_1.isEbayInvalidCategoryError)(publishErr)) {
                    const resolvedCategory = await this.ensureLeafCategoryId(req.categoryId, req.sku);
                    const resolvedLeaf = resolvedCategory.id;
                    if (resolvedLeaf && resolvedLeaf !== req.categoryId) {
                        this.logger.warn(`SKU ${req.sku}: category ${req.categoryId} rejected as non-leaf — re-resolved to leaf ${resolvedLeaf}, purging and retrying`);
                        await this.persistResolvedCategory(req, resolvedCategory);
                        const correctedReq = { ...req, categoryId: resolvedLeaf };
                        await this.purgeStaleEbayInventory(storeId, req.sku, offerId, inventoryItem);
                        const correctedItem = this.buildInventoryItem(correctedReq, store);
                        await this.inventoryApi.createOrReplaceItem(storeId, correctedReq.sku, correctedItem);
                        await this.syncInventoryCompatibility(storeId, correctedReq);
                        const correctedOffer = this.buildOffer(correctedReq, store);
                        const freshOfferId = await this.resolveOrCreateOfferId(storeId, correctedOffer, store, correctedItem);
                        publishedOfferId = freshOfferId;
                        publishResult = await this.publishOfferWithRetries(storeId, freshOfferId, store, account, correctedReq);
                    }
                    else {
                        this.logger.warn(`Publish for SKU ${req.sku} failed with invalid category — purging stale offer ${offerId} and retrying`);
                        await this.purgeStaleEbayInventory(storeId, req.sku, offerId, inventoryItem);
                        const freshOfferId = await this.resolveOrCreateOfferId(storeId, offer, store, inventoryItem);
                        publishedOfferId = freshOfferId;
                        await this.syncInventoryCompatibility(storeId, req);
                        publishResult = await this.publishOfferWithRetries(storeId, freshOfferId, store, account, req);
                    }
                }
                else {
                    throw publishErr;
                }
            }
            try {
                await this.refreshPublishedOfferCompatibility(storeId, publishedOfferId, req);
                await this.verifyPublishedProjection(storeId, publishedOfferId, publishResult.listingId, req, store);
            }
            catch (compatibilityErr) {
                await this.inventoryApi
                    .withdrawOffer(storeId, publishedOfferId)
                    .catch((withdrawErr) => this.logger.error(`Could not withdraw offer ${publishedOfferId} after live compatibility verification failed`, withdrawErr));
                throw compatibilityErr;
            }
            return {
                storeId,
                storeName: store.storeName,
                success: true,
                offerId: publishedOfferId,
                listingId: publishResult.listingId,
            };
        };
        try {
            if (account?.connectionSource === 'sellerpundit') {
                await this.sellerpunditTokens.ensureFreshAccessToken(account.id, {
                    force: true,
                });
            }
            return await runDirectPublish();
        }
        catch (err) {
            if (account?.connectionSource === 'sellerpundit' &&
                (0, ebay_api_error_util_js_1.isEbayInvalidAccessTokenError)(err)) {
                this.logger.warn(`eBay rejected SellerPundit token for "${store.storeName}" — forcing SellerPundit re-fetch and retrying publish`);
                try {
                    await this.sellerpunditTokens.refreshTokenFromSellerpundit(account);
                    return await runDirectPublish();
                }
                catch (retryErr) {
                    return this.formatDirectPublishFailure(store, storeId, req, retryErr, account);
                }
            }
            return this.formatDirectPublishFailure(store, storeId, req, err, account);
        }
    }
    async assertRemoteSkuOwnership(storeId, store, req, account) {
        let existing;
        try {
            existing = await this.inventoryApi.getItem(storeId, req.sku);
        }
        catch (error) {
            if (this.isEbayNotFound(error))
                return;
            throw new common_1.BadRequestException(`Cannot verify eBay SKU ${req.sku} before publishing: ${(0, ebay_api_error_util_js_1.formatEbayApiError)(error, error instanceof Error ? error.message : 'eBay inventory lookup failed')}`);
        }
        const [offersPage, listing, catalog] = await Promise.all([
            this.inventoryApi.getOffersBySku(storeId, req.sku, 100, 0),
            this.listingRepo.findOne({ where: { id: req.listingId } }),
            this.catalogRepo.findOne({ where: { sku: req.sku } }),
        ]);
        const existingListingIds = new Set(offersPage.offers
            .map((offer) => offer.listingId)
            .filter((listingId) => Boolean(listingId)));
        if (listing?.ebayListingId)
            existingListingIds.add(listing.ebayListingId);
        const marketplaceId = this.resolvePublishMarketplaceId(account, store);
        let localChannel = null;
        if (account && catalog) {
            localChannel = await this.channelRepo.findOne({
                where: {
                    catalogProductId: catalog.id,
                    ebayAccountId: account.id,
                    marketplaceId,
                },
            });
            if (localChannel?.listingId && existingListingIds.has(localChannel.listingId)) {
                return;
            }
            if (localChannel?.ebayInventorySku === req.sku &&
                this.remoteItemMatchesCanonicalRequest(existing, req)) {
                this.logger.warn(`Reattaching orphaned eBay SKU ${req.sku} to its local channel by exact canonical identity; ` +
                    'the stored listing ID did not match the current remote offer.');
                return;
            }
        }
        const remoteOfferCount = typeof offersPage.total === 'number'
            ? offersPage.total
            : offersPage.offers.length;
        const remoteOffersAreUnpublished = offersPage.offers.every((offer) => !offer.listingId &&
            String(offer.status ?? '').toUpperCase() !== 'PUBLISHED');
        if (account &&
            catalog &&
            !localChannel &&
            existingListingIds.size === 0 &&
            remoteOfferCount <= offersPage.offers.length &&
            remoteOffersAreUnpublished) {
            this.logger.warn(`Reclaiming orphaned unpublished eBay SKU ${req.sku} for catalog product ${catalog.id}; ` +
                'no local channel or published remote listing owns the SKU.');
            return;
        }
        const remoteTitle = existing.product?.title?.trim() || '<untitled>';
        throw new common_1.BadRequestException(`eBay SKU collision: ${req.sku} is already assigned to a different remote item ` +
            `("${remoteTitle}", listing ${[...existingListingIds][0] ?? 'not published'}). ` +
            'Publishing was stopped; resolve the account-level SKU ownership explicitly.');
    }
    async verifyPublishedProjection(storeId, offerId, listingId, req, store) {
        let lastError;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                const [item, offer] = await Promise.all([
                    this.inventoryApi.getItem(storeId, req.sku),
                    this.inventoryApi.getOffer(storeId, offerId),
                ]);
                const actualTitle = item.product?.title?.trim() ?? '';
                if (actualTitle !== req.title.trim()) {
                    throw new common_1.BadRequestException(`eBay title verification failed for SKU ${req.sku}, listing ${listingId}. ` +
                        `Expected "${req.title}" but eBay returned "${actualTitle}".`);
                }
                const expectedImageCount = req.imageUrls.length;
                const actualImageCount = item.product?.imageUrls?.length ?? 0;
                if (actualImageCount !== expectedImageCount) {
                    throw new common_1.BadRequestException(`eBay image verification failed for SKU ${req.sku}, listing ${listingId}. ` +
                        `Expected ${expectedImageCount} image(s) but eBay returned ${actualImageCount}.`);
                }
                const expectedDescription = normalizePublishedDescription(req.description);
                const actualDescription = normalizePublishedDescription(item.product?.description);
                if (expectedDescription && actualDescription !== expectedDescription) {
                    throw new common_1.BadRequestException(`eBay description verification failed for SKU ${req.sku}, listing ${listingId}.`);
                }
                const expectedCompatibility = req.compatibility ?? {
                    compatibleProducts: [],
                };
                let actualCompatibility;
                try {
                    actualCompatibility = await this.inventoryApi.getCompatibility(storeId, req.sku);
                }
                catch (error) {
                    if (!this.isEbayNotFound(error))
                        throw error;
                    actualCompatibility = { compatibleProducts: [] };
                }
                this.assertCompatibilityPersisted(req.sku, expectedCompatibility, actualCompatibility);
                const expectedOffer = this.buildOffer(req, store);
                const expectedPolicies = expectedOffer.listingPolicies ?? {};
                const actualPolicies = offer.listingPolicies ?? {};
                for (const key of [
                    'fulfillmentPolicyId',
                    'paymentPolicyId',
                    'returnPolicyId',
                ]) {
                    const expectedId = expectedPolicies[key];
                    if (expectedId && actualPolicies[key] !== expectedId) {
                        throw new common_1.BadRequestException(`eBay ${key} verification failed for SKU ${req.sku}, listing ${listingId}. ` +
                            `Expected ${expectedId} but eBay returned ${actualPolicies[key] ?? '<missing>'}.`);
                    }
                }
                const expectedLocation = expectedOffer.merchantLocationKey?.trim();
                if (expectedLocation && offer.merchantLocationKey !== expectedLocation) {
                    throw new common_1.BadRequestException(`eBay location verification failed for SKU ${req.sku}, listing ${listingId}. ` +
                        `Expected ${expectedLocation} but eBay returned ${offer.merchantLocationKey ?? '<missing>'}.`);
                }
                return;
            }
            catch (error) {
                lastError = error;
                if (attempt < 2) {
                    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
                }
            }
        }
        throw lastError;
    }
    isEbayNotFound(error) {
        const status = error && typeof error === 'object' && 'response' in error
            ? error.response?.status
            : undefined;
        return (status === 404 ||
            /status code 404|not found/i.test((0, ebay_api_error_util_js_1.formatEbayApiError)(error, error instanceof Error ? error.message : '')));
    }
    remoteItemMatchesCanonicalRequest(existing, req) {
        if (normalizePublishedDescription(existing.product?.title) ===
            normalizePublishedDescription(req.title)) {
            return true;
        }
        const expectedMpn = Object.entries(req.aspects ?? {})
            .find(([name]) => /^(mpn|manufacturerpartnumber|oempartnumber|oempartnumber)/i.test(name.replace(/[^a-z0-9]/gi, '')))?.[1]?.[0];
        const remoteMpn = existing.product?.mpn ??
            Object.entries(existing.product?.aspects ?? {}).find(([name]) => /^(mpn|manufacturerpartnumber|oempartnumber|oempartnumber)/i.test(name.replace(/[^a-z0-9]/gi, '')))?.[1]?.[0];
        return Boolean(expectedMpn &&
            remoteMpn &&
            normalizePublishedDescription(expectedMpn) ===
                normalizePublishedDescription(remoteMpn));
    }
    formatDirectPublishFailure(store, storeId, req, err, account) {
        let errorMsg = (0, ebay_api_error_util_js_1.formatEbayApiError)(err, err instanceof Error ? err.message : 'Publish failed');
        if ((0, ebay_api_error_util_js_1.isEbayInvalidAccessTokenError)(err)) {
            if (account?.connectionSource === 'sellerpundit') {
                void this.connectedAccountRepo
                    .update(account.id, {
                    connectionStatus: 'reconnect_required',
                    lastErrorMessage: 'eBay rejected the OAuth token supplied by SellerPundit — reconnect eBay for this store in SellerPundit, then Re-sync stores here',
                })
                    .catch((updateErr) => this.logger.warn(`Could not mark SellerPundit account ${account.id} reconnect_required`, updateErr));
                errorMsg =
                    `eBay rejected the OAuth token for "${store.storeName}". ` +
                        "RealTrackApp is connected to SellerPundit, but SellerPundit's eBay authorization for this store is invalid or expired. " +
                        'Reconnect eBay in SellerPundit for this account, then use Settings → eBay Integrations → Re-sync stores.';
            }
            else {
                errorMsg = `eBay authorization failed for "${store.storeName}". Re-sync or reconnect this store in Settings → eBay Integrations.`;
            }
        }
        if ((0, ebay_api_error_util_js_1.isEbaySellingLimitError)(err)) {
            errorMsg =
                `eBay DE selling limit reached for "${store.storeName}". ` +
                    'Your eBay DE account has exceeded its monthly listing value limit (€3,000,000.00). ' +
                    'New listings cannot be created until the limit resets (typically at the start of the next month) ' +
                    'or eBay approves a limit increase. ' +
                    'Request a limit increase at: https://www.ebay.de/help/selling/listings/selling-limits?id=4107';
        }
        const responseData = err?.response
            ?.data;
        if (responseData) {
            this.logger.error(`eBay API error for "${req.sku}" on "${store.storeName}": ${JSON.stringify(responseData)}`);
        }
        this.logger.error(`Failed to publish "${req.sku}" to store ${storeId}: ${errorMsg}`);
        return {
            storeId,
            storeName: store.storeName,
            success: false,
            error: errorMsg,
        };
    }
    async enrichPoliciesFromStoreOnly(store, req) {
        const merchantLocationKey = await this.resolveMerchantLocationKey(store, req);
        return {
            ...req,
            fulfillmentPolicyId: req.fulfillmentPolicyId ?? store.fulfillmentPolicyId ?? undefined,
            paymentPolicyId: req.paymentPolicyId ?? store.paymentPolicyId ?? undefined,
            returnPolicyId: req.returnPolicyId ?? store.returnPolicyId ?? undefined,
            merchantLocationKey,
        };
    }
    resolvePublishMarketplaceId(account, store) {
        const fromStore = (0, ebay_marketplace_headers_util_js_1.resolveMarketplaceId)(store);
        if (!account || account.connectionSource !== 'sellerpundit')
            return fromStore;
        return this.sellerpunditRegistry.resolveMarketplaceForAccount(account.sellerpunditAccountName ??
            account.accountDisplayName ??
            store.storeName ??
            '', fromStore);
    }
    async ensureMarketplaceRow(ebayAccountId, marketplaceId) {
        let mpRow = await this.mpRepo.findOne({
            where: { ebayAccountId, marketplaceId },
        });
        if (!mpRow) {
            const mp = this.mpConfig.require(marketplaceId);
            mpRow = this.mpRepo.create({
                ebayAccountId,
                marketplaceId,
                currency: mp.currency,
                locale: mp.locale,
                enabled: true,
            });
            mpRow = await this.mpRepo.save(mpRow);
        }
        else if (!mpRow.enabled) {
            mpRow.enabled = true;
            mpRow = await this.mpRepo.save(mpRow);
        }
        return mpRow;
    }
    async enrichPoliciesFromMarketplace(account, store, req) {
        const marketplaceId = this.resolvePublishMarketplaceId(account, store);
        if (account.connectionSource === 'sellerpundit' &&
            store.ebayMarketplaceId !== marketplaceId) {
            store.ebayMarketplaceId = marketplaceId;
            store.config = {
                ...(store.config ?? {}),
                marketplace: marketplaceId,
            };
            await this.storeRepo.save(store);
        }
        let mpRow = await this.ensureMarketplaceRow(account.id, marketplaceId);
        if (account.connectionSource === 'sellerpundit') {
            const policyCount = await this.policyRepo.count({
                where: { ebayAccountId: account.id, marketplaceId },
            });
            if (policyCount === 0 || !(0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow)) {
                const policyResult = await this.sellerpunditPolicies.ensurePoliciesFresh(account.id, account.organizationId, marketplaceId);
                if (!policyResult.ok) {
                    throw new common_1.BadRequestException(policyResult.message);
                }
                mpRow = await this.ensureMarketplaceRow(account.id, marketplaceId);
            }
        }
        const merchantLocationKey = await this.resolveMerchantLocationKey(store, req, mpRow?.defaultInventoryLocationKey, account.id);
        const paReturnRequired = req.vertical !== 'fashion' &&
            (0, ebay_business_policy_util_js_1.listingRequiresPartsAccessoriesReturnPolicy)(marketplaceId, req.categoryId, req.condition);
        const synced = await this.resolvePoliciesFromSyncedTable(account.id, marketplaceId, req.categoryId, req.condition);
        const nameResolvedFulfillment = await this.resolvePolicyByName(account.id, marketplaceId, 'fulfillment', req.requestedFulfillmentPolicyName);
        const nameResolvedPayment = await this.resolvePolicyByName(account.id, marketplaceId, 'payment', req.requestedPaymentPolicyName);
        const nameResolvedReturn = await this.resolvePolicyByName(account.id, marketplaceId, 'return', req.requestedReturnPolicyName, req.categoryId, req.condition);
        const resolvedFulfillment = (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(nameResolvedFulfillment, req.fulfillmentPolicyId, synced.fulfillmentPolicyId, (0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow)
            ? mpRow?.defaultFulfillmentPolicyId
            : undefined);
        const resolvedPayment = (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(nameResolvedPayment, req.paymentPolicyId, synced.paymentPolicyId, (0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow)
            ? mpRow?.defaultPaymentPolicyId
            : undefined);
        const resolvedReturn = (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(nameResolvedReturn, req.returnPolicyId, synced.returnPolicyId, (0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow)
            ? mpRow?.defaultReturnPolicyId
            : undefined);
        const needsAccountApiRefresh = !resolvedFulfillment ||
            !resolvedPayment ||
            !resolvedReturn ||
            (paReturnRequired && !resolvedReturn) ||
            Boolean(req.requestedFulfillmentPolicyName && !nameResolvedFulfillment) ||
            Boolean(req.requestedPaymentPolicyName && !nameResolvedPayment) ||
            Boolean(req.requestedReturnPolicyName && !nameResolvedReturn);
        const refreshed = needsAccountApiRefresh
            ? await this.refreshPoliciesFromEbayApi(store, account, {
                persist: true,
                categoryId: req.categoryId,
                condition: req.condition,
                requestedFulfillmentPolicyName: req.requestedFulfillmentPolicyName,
                requestedPaymentPolicyName: req.requestedPaymentPolicyName,
                requestedReturnPolicyName: req.requestedReturnPolicyName,
            })
            : {};
        const effectiveNamedFulfillment = nameResolvedFulfillment ??
            (req.requestedFulfillmentPolicyName
                ? refreshed.fulfillmentPolicyId
                : undefined);
        const effectiveNamedPayment = nameResolvedPayment ??
            (req.requestedPaymentPolicyName ? refreshed.paymentPolicyId : undefined);
        const effectiveNamedReturn = nameResolvedReturn ??
            (req.requestedReturnPolicyName ? refreshed.returnPolicyId : undefined);
        if (req.requestedFulfillmentPolicyName && !effectiveNamedFulfillment) {
            const fallback = (0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow)
                ? mpRow?.defaultFulfillmentPolicyId
                : undefined;
            if (fallback) {
                this.logger.warn(`Shipping profile "${req.requestedFulfillmentPolicyName}" not found on "${store.storeName}" (${marketplaceId}) — falling back to default policy ${fallback}`);
            }
            else {
                throw new common_1.BadRequestException(`Shipping profile "${req.requestedFulfillmentPolicyName}" is not available for "${store.storeName}" on ${marketplaceId} and no default policy is set. Sync or create a matching eBay policy before publishing.`);
            }
        }
        if (req.requestedPaymentPolicyName && !effectiveNamedPayment) {
            const fallback = (0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow)
                ? mpRow?.defaultPaymentPolicyId
                : undefined;
            if (fallback) {
                this.logger.warn(`Payment profile "${req.requestedPaymentPolicyName}" not found on "${store.storeName}" (${marketplaceId}) — falling back to default policy ${fallback}`);
            }
            else {
                throw new common_1.BadRequestException(`Payment profile "${req.requestedPaymentPolicyName}" is not available for "${store.storeName}" on ${marketplaceId} and no default policy is set. Sync or create a matching eBay policy before publishing.`);
            }
        }
        if (req.requestedReturnPolicyName && !effectiveNamedReturn) {
            const fallback = (0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow)
                ? mpRow?.defaultReturnPolicyId
                : undefined;
            if (fallback) {
                this.logger.warn(`Return profile "${req.requestedReturnPolicyName}" not found on "${store.storeName}" (${marketplaceId}) — falling back to default policy ${fallback}`);
            }
            else {
                throw new common_1.BadRequestException(`Return profile "${req.requestedReturnPolicyName}" is unavailable for "${store.storeName}" on ${marketplaceId} and no default policy is set. Sync or correct the matching eBay policy before publishing.`);
            }
        }
        const fulfillmentPolicyId = (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(effectiveNamedFulfillment, req.fulfillmentPolicyId, refreshed.fulfillmentPolicyId, synced.fulfillmentPolicyId, (0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow)
            ? mpRow?.defaultFulfillmentPolicyId
            : undefined, store.fulfillmentPolicyId);
        const paymentPolicyId = (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(effectiveNamedPayment, req.paymentPolicyId, refreshed.paymentPolicyId, synced.paymentPolicyId, (0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow)
            ? mpRow?.defaultPaymentPolicyId
            : undefined, store.paymentPolicyId);
        const returnNameMiss = Boolean(req.requestedReturnPolicyName) && !effectiveNamedReturn;
        const returnMpDefault = (0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow)
            ? mpRow?.defaultReturnPolicyId
            : undefined;
        let returnPolicyId = returnNameMiss
            ? (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(effectiveNamedReturn, refreshed.returnPolicyId, returnMpDefault, synced.returnPolicyId, store.returnPolicyId, req.returnPolicyId)
            : (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(effectiveNamedReturn, req.returnPolicyId, refreshed.returnPolicyId, synced.returnPolicyId, returnMpDefault, store.returnPolicyId);
        if (paReturnRequired) {
            const ensured = await this.paReturnPolicy.ensureCompliantReturnPolicy({
                store,
                account,
                marketplaceId,
                categoryId: req.categoryId,
                condition: req.condition,
                currentReturnPolicyId: returnPolicyId,
            });
            if (ensured.action === 'blocked') {
                throw new common_1.BadRequestException(ensured.blockedMessage ?? (0, ebay_business_policy_util_js_1.partsAccessoriesReturnPolicyGuidance)());
            }
            if (ensured.returnPolicyId) {
                if (ensured.action === 'upgraded' || ensured.action === 'created') {
                    this.logger.log(`P&A return policy ${ensured.action}: ${ensured.returnPolicyId} for store "${store.storeName}"`);
                }
                returnPolicyId = ensured.returnPolicyId;
            }
            else if (paReturnRequired) {
                throw new common_1.BadRequestException((0, ebay_business_policy_util_js_1.partsAccessoriesReturnPolicyGuidance)());
            }
        }
        const fulfillmentSource = this.policyResolutionSource(req.fulfillmentPolicyId, effectiveNamedFulfillment, refreshed.fulfillmentPolicyId, synced.fulfillmentPolicyId, (0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow)
            ? mpRow?.defaultFulfillmentPolicyId
            : undefined, store.fulfillmentPolicyId);
        const paymentSource = this.policyResolutionSource(req.paymentPolicyId, effectiveNamedPayment, refreshed.paymentPolicyId, synced.paymentPolicyId, (0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow)
            ? mpRow?.defaultPaymentPolicyId
            : undefined, store.paymentPolicyId);
        const returnSource = this.policyResolutionSource(req.returnPolicyId, effectiveNamedReturn, refreshed.returnPolicyId, synced.returnPolicyId, (0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow)
            ? mpRow?.defaultReturnPolicyId
            : undefined, store.returnPolicyId);
        this.logger.log(`Policy resolution for "${store.storeName}" (${marketplaceId}): ` +
            `fulfillment=${fulfillmentPolicyId ?? 'NONE'} [${fulfillmentSource}], ` +
            `payment=${paymentPolicyId ?? 'NONE'} [${paymentSource}], ` +
            `return=${returnPolicyId ?? 'NONE'} [${returnSource}]`);
        if (mpRow &&
            merchantLocationKey &&
            mpRow.defaultInventoryLocationKey !== merchantLocationKey &&
            (!mpRow.defaultInventoryLocationKey ||
                req.merchantLocationKey?.trim() ===
                    mpRow.defaultInventoryLocationKey.trim())) {
            mpRow.defaultInventoryLocationKey = merchantLocationKey;
            await this.mpRepo.save(mpRow);
        }
        const currency = this.mpConfig.require(marketplaceId).currency;
        if (!mpRow) {
            return {
                ...req,
                currency,
                fulfillmentPolicyId: fulfillmentPolicyId ?? store.fulfillmentPolicyId ?? undefined,
                paymentPolicyId: paymentPolicyId ?? store.paymentPolicyId ?? undefined,
                returnPolicyId: returnPolicyId ?? store.returnPolicyId ?? undefined,
                merchantLocationKey,
            };
        }
        return {
            ...req,
            currency,
            fulfillmentPolicyId,
            paymentPolicyId,
            returnPolicyId,
            merchantLocationKey,
        };
    }
    async resolvePoliciesFromSyncedTable(ebayAccountId, marketplaceId, categoryId, condition) {
        const rows = await this.policyRepo.find({
            where: { ebayAccountId, marketplaceId },
        });
        const toCandidates = (policyType) => rows
            .filter((r) => r.policyType === policyType)
            .map((r) => ({
            ebayPolicyId: r.ebayPolicyId,
            isDefault: r.isDefault,
            geoSite: (0, ebay_business_policy_util_js_1.readPolicyGeoSite)(r.rawPayload ?? {}),
            rawPayload: r.rawPayload ?? {},
        }));
        return {
            fulfillmentPolicyId: (0, ebay_business_policy_util_js_1.pickPolicyIdForMarketplace)(toCandidates('fulfillment'), marketplaceId) ?? undefined,
            paymentPolicyId: (0, ebay_business_policy_util_js_1.pickPolicyIdForMarketplace)(toCandidates('payment'), marketplaceId) ??
                undefined,
            returnPolicyId: (0, ebay_business_policy_util_js_1.pickReturnPolicyIdForListing)(toCandidates('return'), marketplaceId, categoryId, condition) ?? undefined,
        };
    }
    async resolvePolicyByName(ebayAccountId, marketplaceId, policyType, name, categoryId, condition) {
        const trimmed = name?.trim();
        if (!trimmed)
            return undefined;
        const rows = await this.policyRepo.find({
            where: { ebayAccountId, marketplaceId, policyType },
        });
        const candidates = rows
            .filter((r) => r.name?.trim().toLowerCase() === trimmed.toLowerCase())
            .map((r) => ({
            ebayPolicyId: r.ebayPolicyId,
            isDefault: r.isDefault,
            geoSite: (0, ebay_business_policy_util_js_1.readPolicyGeoSite)(r.rawPayload ?? {}),
            rawPayload: r.rawPayload ?? {},
        }));
        if (!candidates.length) {
            this.logger.warn(`Profile name "${trimmed}" (${policyType}) not found in synced policies ` +
                `for account ${ebayAccountId} / ${marketplaceId}. Publishing will be blocked to prevent a profile mismatch.`);
            return undefined;
        }
        const resolved = policyType === 'return'
            ? (0, ebay_business_policy_util_js_1.pickReturnPolicyIdForListing)(candidates, marketplaceId, categoryId, condition)
            : (0, ebay_business_policy_util_js_1.pickPolicyIdForMarketplace)(candidates, marketplaceId);
        return (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(resolved ?? undefined);
    }
    async pickCompliantReturnPolicyFromStore(ebayAccountId, marketplaceId, categoryId, condition) {
        const synced = await this.resolvePoliciesFromSyncedTable(ebayAccountId, marketplaceId, categoryId, condition);
        return synced.returnPolicyId;
    }
    async refreshPoliciesFromEbayApi(store, account, options) {
        const HARD_TIMEOUT_MS = 60_000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), HARD_TIMEOUT_MS);
        try {
            const token = await this.auth.getAccessToken(store.id);
            const baseUrl = await this.auth.getApiBaseUrlForStore(store.id);
            const marketplaceId = (0, ebay_marketplace_headers_util_js_1.resolveMarketplaceId)(store);
            const [fulfill, payment, ret] = await Promise.all([
                this.sellAccount.listFulfillmentPolicies(token, baseUrl, marketplaceId, controller.signal),
                this.sellAccount.listPaymentPolicies(token, baseUrl, marketplaceId, controller.signal),
                this.sellAccount.listReturnPolicies(token, baseUrl, marketplaceId, controller.signal),
            ]);
            const pick = (items, requestedName) => {
                const wanted = requestedName?.trim().toLowerCase();
                const named = wanted
                    ? items.find((x) => x.name?.trim().toLowerCase() === wanted)
                    : undefined;
                if (wanted)
                    return named?.ebayPolicyId;
                return (items.find((x) => x.isDefault)?.ebayPolicyId ?? items[0]?.ebayPolicyId);
            };
            const fulfillmentPolicyId = (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(pick(fulfill, options?.requestedFulfillmentPolicyName));
            const paymentPolicyId = (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(pick(payment, options?.requestedPaymentPolicyName));
            const returnPolicyId = (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)((0, ebay_business_policy_util_js_1.pickReturnPolicyIdForListing)(ret
                .filter((row) => !options?.requestedReturnPolicyName ||
                row.name?.trim().toLowerCase() ===
                    options.requestedReturnPolicyName.trim().toLowerCase())
                .map((r) => ({
                ebayPolicyId: r.ebayPolicyId,
                isDefault: r.isDefault,
                geoSite: (0, ebay_business_policy_util_js_1.readPolicyGeoSite)(r.raw),
                rawPayload: r.raw,
            })), marketplaceId, options?.categoryId, options?.condition));
            if (options?.persist &&
                (fulfillmentPolicyId || paymentPolicyId || returnPolicyId)) {
                await this.persistAccountApiPolicies(account.id, marketplaceId, { fulfill, payment, ret }, {
                    fulfillmentPolicyId: (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(pick(fulfill)),
                    paymentPolicyId: (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(pick(payment)),
                    returnPolicyId: (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(pick(ret)),
                });
            }
            if (fulfillmentPolicyId || paymentPolicyId || returnPolicyId) {
                this.logger.debug(`Refreshed eBay policies for "${store.storeName}" (${marketplaceId})`);
            }
            return { fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
        }
        catch (err) {
            const aborted = controller.signal.aborted;
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(aborted
                ? `eBay policy refresh timed out for "${store.storeName}" after ${HARD_TIMEOUT_MS / 1000}s`
                : `Could not refresh eBay policies for "${store.storeName}": ${message}`);
            return {};
        }
        finally {
            clearTimeout(timer);
        }
    }
    policyResolutionSource(reqId, nameResolvedId, refreshedId, syncedId, defaultId, storeId) {
        if (nameResolvedId && (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(nameResolvedId))
            return 'profile-name';
        if (reqId && (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(reqId))
            return 'user-selected';
        if (refreshedId && (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(refreshedId))
            return 'ebay-api-refresh';
        if (syncedId && (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(syncedId))
            return 'synced-table';
        if (defaultId && (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(defaultId))
            return 'marketplace-default';
        if (storeId && (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(storeId))
            return 'store-fallback';
        return 'none';
    }
    async persistAccountApiPolicies(ebayAccountId, marketplaceId, lists, defaults) {
        if (!lists.fulfill.length && !lists.payment.length && !lists.ret.length) {
            return;
        }
        await this.policyRepo.manager.transaction(async (trx) => {
            await trx.delete(ebay_business_policy_entity_js_1.EbayBusinessPolicy, { ebayAccountId, marketplaceId });
            for (const p of lists.fulfill) {
                await trx.save(trx.create(ebay_business_policy_entity_js_1.EbayBusinessPolicy, {
                    ebayAccountId,
                    marketplaceId,
                    policyType: 'fulfillment',
                    ebayPolicyId: p.ebayPolicyId,
                    name: p.name,
                    rawPayload: p.raw,
                    isDefault: p.isDefault,
                }));
            }
            for (const p of lists.payment) {
                await trx.save(trx.create(ebay_business_policy_entity_js_1.EbayBusinessPolicy, {
                    ebayAccountId,
                    marketplaceId,
                    policyType: 'payment',
                    ebayPolicyId: p.ebayPolicyId,
                    name: p.name,
                    rawPayload: p.raw,
                    isDefault: p.isDefault,
                }));
            }
            for (const p of lists.ret) {
                await trx.save(trx.create(ebay_business_policy_entity_js_1.EbayBusinessPolicy, {
                    ebayAccountId,
                    marketplaceId,
                    policyType: 'return',
                    ebayPolicyId: p.ebayPolicyId,
                    name: p.name,
                    rawPayload: p.raw,
                    isDefault: p.isDefault,
                }));
            }
        });
        const mpRow = await this.mpRepo.findOne({
            where: { ebayAccountId, marketplaceId },
        });
        if (!mpRow)
            return;
        let dirty = false;
        if (defaults.fulfillmentPolicyId &&
            mpRow.defaultFulfillmentPolicyId !== defaults.fulfillmentPolicyId) {
            mpRow.defaultFulfillmentPolicyId = defaults.fulfillmentPolicyId;
            dirty = true;
        }
        if (defaults.paymentPolicyId &&
            mpRow.defaultPaymentPolicyId !== defaults.paymentPolicyId) {
            mpRow.defaultPaymentPolicyId = defaults.paymentPolicyId;
            dirty = true;
        }
        if (defaults.returnPolicyId &&
            mpRow.defaultReturnPolicyId !== defaults.returnPolicyId) {
            mpRow.defaultReturnPolicyId = defaults.returnPolicyId;
            dirty = true;
        }
        if (dirty)
            await this.mpRepo.save(mpRow);
    }
    async resolveMerchantLocationKey(store, req, mpDefaultKey, ebayAccountId) {
        let merchantLocationKey = req.merchantLocationKey?.trim() ||
            mpDefaultKey?.trim() ||
            store.locationKey?.trim() ||
            undefined;
        const storeConfig = store.config ?? {};
        if (!merchantLocationKey && typeof storeConfig.locationKey === 'string') {
            merchantLocationKey = storeConfig.locationKey.trim() || undefined;
        }
        if (!merchantLocationKey && ebayAccountId) {
            const sibling = await this.mpRepo.findOne({
                where: {
                    ebayAccountId,
                    defaultInventoryLocationKey: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()),
                },
            });
            if (sibling?.defaultInventoryLocationKey?.trim()) {
                merchantLocationKey = sibling.defaultInventoryLocationKey.trim();
            }
        }
        const configuredLocationKey = merchantLocationKey;
        const ensured = await this.inventoryApi.ensureMerchantLocation(store.id, merchantLocationKey ?? req.merchantLocationKey ?? store.locationKey);
        if (ensured) {
            if (configuredLocationKey && configuredLocationKey !== ensured) {
                this.logger.warn(`Reconciled inventory location for "${store.storeName}" from "${configuredLocationKey}" to "${ensured}" before publish`);
            }
            merchantLocationKey = ensured;
        }
        else if (!merchantLocationKey) {
            this.logger.warn(`No inventory location for "${store.storeName}" — map a merchant location key in Settings → eBay Integrations.`);
        }
        return merchantLocationKey;
    }
    async publishViaSellerpundit(store, account, req) {
        const marketplaceId = this.resolvePublishMarketplaceId(account, store);
        let enrichedReq;
        try {
            enrichedReq = await this.enrichPoliciesFromMarketplace(account, store, req);
        }
        catch (err) {
            if (err instanceof common_1.BadRequestException) {
                const response = err.getResponse();
                const message = typeof response === 'string'
                    ? response
                    : typeof response === 'object' &&
                        response !== null &&
                        'message' in response
                        ? String(response.message)
                        : err.message;
                return {
                    storeId: store.id,
                    storeName: store.storeName,
                    success: false,
                    error: message,
                };
            }
            throw err;
        }
        this.logger.log(`SellerPundit publish policies for "${store.storeName}" (${marketplaceId}, category=${enrichedReq.categoryId ?? 'n/a'}): ` +
            `fulfillment=${enrichedReq.fulfillmentPolicyId ?? 'missing'}, ` +
            `payment=${enrichedReq.paymentPolicyId ?? 'missing'}, ` +
            `return=${enrichedReq.returnPolicyId ?? 'missing'}`);
        const built = {
            publishRequest: { ...enrichedReq, storeIds: [store.id] },
            warnings: [],
            blockingErrors: [],
        };
        const spResult = await this.sellerpunditListing.publish(built, account, marketplaceId);
        if (spResult.success) {
            return {
                storeId: store.id,
                storeName: store.storeName,
                success: true,
                offerId: spResult.offerId,
                listingId: spResult.listingId,
            };
        }
        const error = spResult.error ??
            spResult.errors?.join('; ') ??
            'SellerPundit publish failed';
        if (!spResult.platformError) {
            this.logger.error(`SellerPundit publish failed for "${req.sku}" on "${store.storeName}": ${error}`);
        }
        return {
            storeId: store.id,
            storeName: store.storeName,
            success: false,
            error,
            platformError: spResult.platformError,
        };
    }
    async purgeStaleEbayInventory(storeId, sku, offerId, inventoryItem) {
        try {
            if (offerId) {
                try {
                    await this.inventoryApi.withdrawOffer(storeId, offerId);
                    this.logger.log(`Withdrew stale offer ${offerId} for SKU ${sku}`);
                }
                catch {
                }
                try {
                    await this.inventoryApi.deleteOffer(storeId, offerId);
                    this.logger.log(`Deleted stale offer ${offerId} for SKU ${sku}`);
                }
                catch {
                }
            }
            try {
                const { offers } = await this.inventoryApi.getOffersBySku(storeId, sku);
                for (const o of offers) {
                    if (!o.offerId)
                        continue;
                    try {
                        if (o.status === 'PUBLISHED') {
                            await this.inventoryApi.withdrawOffer(storeId, o.offerId);
                        }
                        await this.inventoryApi.deleteOffer(storeId, o.offerId);
                        this.logger.log(`Deleted remaining offer ${o.offerId} for SKU ${sku}`);
                    }
                    catch {
                    }
                }
            }
            catch {
            }
            await this.inventoryApi.deleteItem(storeId, sku);
            this.logger.log(`Purged stale inventory item for SKU ${sku} — ready for fresh publish`);
            if (inventoryItem) {
                await this.inventoryApi.createOrReplaceItem(storeId, sku, inventoryItem);
                this.logger.log(`Recreated inventory item for SKU ${sku}`);
            }
        }
        catch (err) {
            this.logger.warn(`Could not fully purge stale inventory for SKU ${sku}: ${err instanceof Error ? err.message : err}`);
        }
    }
    async resolveOrCreateOfferId(storeId, offer, store, inventoryItem) {
        try {
            const created = await this.inventoryApi.createOffer(storeId, offer);
            return created.offerId;
        }
        catch (err) {
            if (!(0, ebay_api_error_util_js_1.isEbayOfferAlreadyExistsError)(err))
                throw err;
            const existingOfferId = (0, ebay_api_error_util_js_1.extractEbayErrorParameter)(err, 'offerId');
            if (existingOfferId) {
                this.logger.warn(`Offer already exists for SKU ${offer.sku} — updating offer ${existingOfferId}`);
                try {
                    await this.inventoryApi.updateOffer(storeId, existingOfferId, offer);
                    return existingOfferId;
                }
                catch (updateErr) {
                    if (!(0, ebay_api_error_util_js_1.isEbayInvalidCategoryError)(updateErr))
                        throw updateErr;
                    this.logger.warn(`Offer ${existingOfferId} for SKU ${offer.sku} has a stale/invalid category — purging and recreating`);
                    await this.purgeStaleEbayInventory(storeId, offer.sku, existingOfferId, inventoryItem);
                    const recreated = await this.inventoryApi.createOffer(storeId, offer);
                    return recreated.offerId;
                }
            }
            const { offers } = await this.inventoryApi.getOffersBySku(storeId, offer.sku);
            const unpublished = offers.find((o) => o.status !== 'PUBLISHED' && o.offerId);
            if (!unpublished?.offerId)
                throw err;
            this.logger.warn(`Offer already exists for SKU ${offer.sku} — updating offer ${unpublished.offerId}`);
            try {
                await this.inventoryApi.updateOffer(storeId, unpublished.offerId, offer);
                return unpublished.offerId;
            }
            catch (updateErr) {
                if (!(0, ebay_api_error_util_js_1.isEbayInvalidCategoryError)(updateErr))
                    throw updateErr;
                this.logger.warn(`Offer ${unpublished.offerId} for SKU ${offer.sku} has a stale/invalid category — purging and recreating`);
                await this.purgeStaleEbayInventory(storeId, offer.sku, unpublished.offerId, inventoryItem);
                const recreated = await this.inventoryApi.createOffer(storeId, offer);
                return recreated.offerId;
            }
        }
    }
    async publishOfferWithTitlePropagationRetry(storeId, offerId, maxAttempts = 3) {
        const delaysMs = [2000, 4000];
        let lastErr;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await this.inventoryApi.publishOffer(storeId, offerId);
            }
            catch (err) {
                lastErr = err;
                const titleLag = (0, ebay_api_error_util_js_1.isEbayTitleMissingTransientError)(err);
                const availabilityLag = (0, ebay_api_error_util_js_1.isEbayAvailabilityMissingTransientError)(err);
                if ((!titleLag && !availabilityLag) || attempt >= maxAttempts - 1) {
                    throw err;
                }
                const wait = delaysMs[attempt] ?? 4000;
                this.logger.warn(`Publish for offer ${offerId} hit eBay ${availabilityLag ? 'availability' : 'title'}-propagation lag — retry ${attempt + 1}/${maxAttempts - 1} in ${wait}ms`);
                await new Promise((r) => setTimeout(r, wait));
            }
        }
        throw lastErr;
    }
    async publishOfferWithRetries(storeId, offerId, store, account, req) {
        try {
            return await this.publishOfferWithTitlePropagationRetry(storeId, offerId);
        }
        catch (publishErr) {
            if ((0, ebay_api_error_util_js_1.isEbayInvalidCompatibilitiesError)(publishErr)) {
                const coreCompatibility = (0, fitment_mvl_util_js_1.toCoreCompatibilityPayload)(req.compatibility);
                if (coreCompatibility &&
                    (0, fitment_mvl_util_js_1.compatibilityHasOptionalFields)(req.compatibility)) {
                    this.logger.warn(`Publish for offer ${offerId} (SKU ${req.sku}) rejected due to invalid compatibilities — retrying with core Make/Model/Year`);
                    req.compatibility = coreCompatibility;
                    await this.syncInventoryCompatibility(storeId, req);
                    return this.publishOfferWithTitlePropagationRetry(storeId, offerId);
                }
                this.logger.warn(`Publish for offer ${offerId} (SKU ${req.sku}) rejected due to invalid compatibilities — reconciling and retrying`);
                await this.syncInventoryCompatibility(storeId, req);
                return this.publishOfferWithTitlePropagationRetry(storeId, offerId);
            }
            if (!account || !(0, ebay_api_error_util_js_1.isEbayRecoverableBusinessPolicyError)(publishErr)) {
                throw publishErr;
            }
            const marketplaceId = (0, ebay_marketplace_headers_util_js_1.resolveMarketplaceId)(store);
            const paReturnIssue = (0, ebay_api_error_util_js_1.isEbayPartsAccessoriesReturnPolicyError)(publishErr);
            this.logger.warn(paReturnIssue
                ? `Publish rejected P&A return policy for offer ${offerId} — selecting compliant return policy and retrying`
                : `Publish rejected business policies for offer ${offerId} — refreshing from eBay Account API and retrying`);
            const refreshed = await this.refreshPoliciesFromEbayApi(store, account, {
                persist: true,
                categoryId: req.categoryId,
                condition: req.condition,
                requestedFulfillmentPolicyName: req.requestedFulfillmentPolicyName,
                requestedPaymentPolicyName: req.requestedPaymentPolicyName,
                requestedReturnPolicyName: req.requestedReturnPolicyName,
            });
            let returnPolicyId;
            const paReturnRequired = req.vertical !== 'fashion' &&
                (0, ebay_business_policy_util_js_1.listingRequiresPartsAccessoriesReturnPolicy)(marketplaceId, req.categoryId, req.condition);
            if (paReturnIssue && !paReturnRequired) {
                throw new common_1.BadRequestException(`eBay reported a Parts & Accessories return policy error, but this listing condition (${req.condition ?? 'unknown'}) is not New or New Other — seller-paid return shipping is only mandatory for those conditions per eBay Seller Center. Verify the condition sent to eBay (expect 3000 / USED_EXCELLENT for used parts). If the condition is correct, contact eBay support or SellerPundit — the API may be over-enforcing the rule.`);
            }
            if (paReturnRequired) {
                const ensured = await this.paReturnPolicy.ensureCompliantReturnPolicy({
                    store,
                    account,
                    marketplaceId,
                    categoryId: req.categoryId,
                    condition: req.condition,
                    currentReturnPolicyId: refreshed.returnPolicyId ?? req.returnPolicyId,
                });
                if (ensured.action === 'blocked') {
                    throw new common_1.BadRequestException(ensured.blockedMessage ?? (0, ebay_business_policy_util_js_1.partsAccessoriesReturnPolicyGuidance)());
                }
                returnPolicyId = ensured.returnPolicyId ?? undefined;
            }
            else {
                returnPolicyId =
                    refreshed.returnPolicyId ??
                        (await this.pickCompliantReturnPolicyFromStore(account.id, marketplaceId, req.categoryId, req.condition));
            }
            if (!refreshed.fulfillmentPolicyId ||
                !refreshed.paymentPolicyId ||
                !returnPolicyId) {
                if (paReturnIssue) {
                    throw new common_1.BadRequestException((0, ebay_business_policy_util_js_1.partsAccessoriesReturnPolicyGuidance)());
                }
                throw publishErr;
            }
            const existingOffer = await this.inventoryApi.getOffer(storeId, offerId);
            await this.inventoryApi.updateOffer(storeId, offerId, {
                ...existingOffer,
                listingPolicies: {
                    fulfillmentPolicyId: refreshed.fulfillmentPolicyId,
                    paymentPolicyId: refreshed.paymentPolicyId,
                    returnPolicyId,
                },
            });
            return this.inventoryApi.publishOffer(storeId, offerId);
        }
    }
    fallbackConditionForCategory(req) {
        const current = (0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(req.condition);
        const usedLike = new Set([
            'USED_GOOD',
            'USED_VERY_GOOD',
            'USED_ACCEPTABLE',
        ]);
        if (!usedLike.has(current))
            return undefined;
        return 'USED_EXCELLENT';
    }
    buildInventoryItem(req, store) {
        const condition = (0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(req.condition);
        const marketplaceId = (0, ebay_marketplace_headers_util_js_1.resolveMarketplaceId)(store);
        const item = {
            availability: {
                shipToLocationAvailability: {
                    quantity: req.quantity,
                },
            },
            condition,
            conditionDescription: req.conditionDescription,
            product: {
                title: req.title,
                description: req.description,
                aspects: (0, ebay_listing_aspects_util_js_1.localizeAspectsForMarketplace)(req.aspects, marketplaceId),
                imageUrls: req.imageUrls,
            },
        };
        return item;
    }
    buildOffer(req, store) {
        const storeConfig = (store.config ?? {});
        const marketplace = (0, ebay_marketplace_headers_util_js_1.resolveMarketplaceId)(store);
        const format = req.listingFormat ?? 'FIXED_PRICE';
        const offer = {
            sku: req.sku,
            marketplaceId: (0, ebay_marketplace_headers_util_js_1.toEbayInventoryApiMarketplaceId)(marketplace),
            includeCatalogProductDetails: false,
            format,
            listingDescription: req.description,
            pricingSummary: {
                price: {
                    value: req.price.toFixed(2),
                    currency: req.currency ?? this.mpConfig.require(marketplace).currency,
                },
            },
            categoryId: req.categoryId,
            listingPolicies: {
                fulfillmentPolicyId: req.fulfillmentPolicyId ?? storeConfig.fulfillmentPolicyId,
                paymentPolicyId: req.paymentPolicyId ?? storeConfig.paymentPolicyId,
                returnPolicyId: req.returnPolicyId ?? storeConfig.returnPolicyId,
            },
            merchantLocationKey: req.merchantLocationKey ?? storeConfig.locationKey,
        };
        offer.listingDuration =
            req.listingDuration ?? (format === 'FIXED_PRICE' ? 'GTC' : undefined);
        return offer;
    }
    async updatePriceQuantity(storeId, offers) {
        return this.inventoryApi.bulkUpdatePriceQuantity(storeId, offers.map((o) => ({
            offers: [
                {
                    offerId: o.offerId,
                    price: { value: o.price.toFixed(2), currency: o.currency ?? 'USD' },
                    availableQuantity: o.quantity,
                },
            ],
        })));
    }
    async endListing(storeId, offerId) {
        await this.inventoryApi.withdrawOffer(storeId, offerId);
        this.logger.log(`Ended listing (offer ${offerId}) on store ${storeId}`);
    }
};
exports.EbayPublishService = EbayPublishService;
exports.EbayPublishService = EbayPublishService = EbayPublishService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(13, (0, common_1.Optional)()),
    __param(14, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(15, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(16, (0, typeorm_1.InjectRepository)(ebay_account_marketplace_entity_js_1.EbayAccountMarketplace)),
    __param(17, (0, typeorm_1.InjectRepository)(ebay_business_policy_entity_js_1.EbayBusinessPolicy)),
    __param(18, (0, typeorm_1.InjectRepository)(ebay_listing_channel_entity_js_1.EbayListingChannel)),
    __param(19, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(20, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(21, (0, typeorm_1.InjectRepository)(ebay_category_entity_js_1.EbayCategory)),
    __param(23, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [config_1.ConfigService,
        ebay_inventory_api_service_js_1.EbayInventoryApiService,
        ebay_trading_api_service_js_1.EbayTradingApiService,
        ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService,
        ebay_taxonomy_cache_service_js_1.EbayTaxonomyCacheService,
        ebay_auth_service_js_1.EbayAuthService,
        ebay_sell_account_api_service_js_1.EbaySellAccountApiService,
        ebay_pa_return_policy_service_js_1.EbayPaReturnPolicyService,
        sellerpundit_listing_adapter_js_1.SellerpunditListingAdapter,
        sellerpundit_policy_sync_service_js_1.SellerpunditPolicySyncService,
        sellerpundit_token_sync_service_js_1.SellerpunditTokenSyncService,
        sellerpundit_marketplace_registry_js_1.SellerpunditMarketplaceRegistry,
        ebay_marketplace_config_service_js_1.EbayMarketplaceConfigService,
        ebay_mvl_service_js_1.EbayMvlService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_media_api_service_js_1.EbayMediaApiService,
        ebay_compatibility_reconciliation_service_js_1.EbayCompatibilityReconciliationService])
], EbayPublishService);
//# sourceMappingURL=ebay-publish.service.js.map