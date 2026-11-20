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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EbayCompatibilityReconciliationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayCompatibilityReconciliationService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const ebay_inventory_api_service_js_1 = require("./ebay-inventory-api.service.js");
const ebay_trading_api_service_js_1 = require("./ebay-trading-api.service.js");
const ebay_auth_service_js_1 = require("./ebay-auth.service.js");
const ebay_sell_account_api_service_js_1 = require("../../integrations/ebay/services/ebay-sell-account-api.service.js");
const ebay_sku_util_js_1 = require("./ebay-sku.util.js");
function normalizeDescription(value) {
    return String(value ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}
let EbayCompatibilityReconciliationService = EbayCompatibilityReconciliationService_1 = class EbayCompatibilityReconciliationService {
    inventoryApi;
    tradingApi;
    auth;
    sellAccount;
    logger = new common_1.Logger(EbayCompatibilityReconciliationService_1.name);
    constructor(inventoryApi, tradingApi, auth, sellAccount) {
        this.inventoryApi = inventoryApi;
        this.tradingApi = tradingApi;
        this.auth = auth;
        this.sellAccount = sellAccount;
    }
    emptyPayload() {
        return { compatibleProducts: [] };
    }
    normalize(payload) {
        return {
            compatibleProducts: Array.isArray(payload?.compatibleProducts)
                ? payload.compatibleProducts
                : [],
        };
    }
    rowKey(row) {
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
    assertExactRows(sku, expected, actual, source) {
        const expectedKeys = new Set(expected.compatibleProducts
            .map((row) => this.rowKey(row))
            .filter(Boolean));
        const actualKeys = new Set((actual?.compatibleProducts ?? [])
            .map((row) => this.rowKey(row))
            .filter(Boolean));
        const missing = [...expectedKeys].filter((key) => !actualKeys.has(key));
        const unexpected = [...actualKeys].filter((key) => !expectedKeys.has(key));
        if (missing.length > 0 || unexpected.length > 0) {
            throw new common_1.BadRequestException(`eBay compatibility verification failed for SKU ${sku} (${source}): ` +
                `${missing.length} expected row(s) missing and ${unexpected.length} stale row(s) present.`);
        }
    }
    async syncInventory(storeId, sku, payload) {
        const expected = this.normalize(payload);
        if (expected.compatibleProducts.length > 0) {
            await this.inventoryApi.setCompatibility(storeId, sku, expected);
        }
        else {
            try {
                await this.inventoryApi.deleteCompatibility(storeId, sku);
            }
            catch (err) {
                if (!this.isNotFound(err))
                    throw err;
                this.logger.debug(`No Inventory API compatibility existed for ${sku}`);
            }
        }
        let actual;
        try {
            actual = await this.inventoryApi.getCompatibility(storeId, sku);
        }
        catch (err) {
            if (!this.isNotFound(err))
                throw err;
            actual = this.emptyPayload();
        }
        this.assertExactRows(sku, expected, actual, 'Inventory API');
        this.logger.log(`Verified ${expected.compatibleProducts.length} Inventory API compatibility row(s) for SKU ${sku}`);
        return expected;
    }
    async refreshPublishedOffer(storeId, offerId, sku, payload) {
        const offer = await this.inventoryApi.getOffer(storeId, offerId);
        await this.inventoryApi.updateOffer(storeId, offerId, {
            ...offer,
            includeCatalogProductDetails: false,
            ...(payload ? { compatibility: this.normalize(payload) } : {}),
        });
        this.logger.log(`Refreshed published Inventory API offer ${offerId} for SKU ${sku}`);
        return offer.listingId ?? null;
    }
    async recreatePublishedOffer(storeId, offerId, sku, payload, canonicalSource) {
        if (!canonicalSource?.item) {
            throw new common_1.BadRequestException(`Cannot recreate SKU ${sku} without a canonical source inventory item.`);
        }
        const [offer, offerPage] = await Promise.all([
            this.inventoryApi.getOffer(storeId, offerId),
            this.inventoryApi.getOffersBySku(storeId, sku, 100, 0),
        ]);
        const otherOffers = offerPage.offers.filter((candidate) => candidate.offerId && candidate.offerId !== offerId);
        if (offerPage.total > offerPage.offers.length || otherOffers.length > 0) {
            throw new common_1.BadRequestException(`Refusing to recreate SKU ${sku}: another Inventory API offer exists; ` +
                'manual account-level reconciliation is required.');
        }
        const expected = this.normalize(payload);
        const listingPolicies = await this.resolveCurrentListingPolicies(storeId, offer.marketplaceId);
        const canonicalOffer = canonicalSource.offer ?? {};
        if (offer.status === 'PUBLISHED') {
            await this.inventoryApi.withdrawOffer(storeId, offerId);
        }
        await this.inventoryApi.deleteOffer(storeId, offerId);
        await this.inventoryApi.deleteItem(storeId, sku);
        let createdOfferId = null;
        let createdItem = false;
        try {
            await this.inventoryApi.createOrReplaceItem(storeId, sku, this.inventoryItemPayloadForWrite(canonicalSource.item));
            createdItem = true;
            await this.syncInventory(storeId, sku, payload);
            const offerPayload = {
                sku,
                marketplaceId: canonicalOffer.marketplaceId ?? offer.marketplaceId,
                format: canonicalOffer.format ?? offer.format,
                listingDescription: canonicalOffer.listingDescription ?? offer.listingDescription,
                availableQuantity: canonicalOffer.availableQuantity ?? offer.availableQuantity,
                categoryId: canonicalOffer.categoryId ?? offer.categoryId,
                merchantLocationKey: canonicalOffer.merchantLocationKey ?? offer.merchantLocationKey,
                pricingSummary: canonicalOffer.pricingSummary ?? offer.pricingSummary,
                listingPolicies,
                tax: canonicalOffer.tax ?? offer.tax,
                listingDuration: canonicalOffer.listingDuration ?? offer.listingDuration,
                includeCatalogProductDetails: false,
                compatibility: expected,
            };
            if (canonicalOffer.listingPolicies) {
                offerPayload.listingPolicies = canonicalOffer.listingPolicies;
            }
            const created = await this.inventoryApi.createOffer(storeId, {
                ...offerPayload,
            });
            createdOfferId = created.offerId;
            const result = await this.inventoryApi.publishOffer(storeId, created.offerId);
            if (!result.listingId) {
                throw new common_1.BadRequestException(`eBay did not return a listing ID while recreating SKU ${sku}.`);
            }
            await this.verifyLiveListing(storeId, result.listingId, offer.marketplaceId, sku, expected);
            await this.verifyFreshProjection(storeId, sku, created.offerId, this.inventoryItemPayloadForWrite(canonicalSource.item), offerPayload);
            this.logger.log(`Recreated Inventory API offer ${created.offerId} as listing ${result.listingId} for SKU ${sku}`);
            return result.listingId;
        }
        catch (error) {
            try {
                if (createdOfferId) {
                    const createdOffer = await this.inventoryApi
                        .getOffer(storeId, createdOfferId)
                        .catch(() => null);
                    if (createdOffer?.status === 'PUBLISHED') {
                        await this.inventoryApi.withdrawOffer(storeId, createdOfferId);
                    }
                    await this.inventoryApi.deleteOffer(storeId, createdOfferId);
                }
                if (createdItem) {
                    const remaining = await this.inventoryApi.getOffersBySku(storeId, sku, 100, 0);
                    if (remaining.total === 0) {
                        await this.inventoryApi.deleteItem(storeId, sku);
                    }
                }
            }
            catch (cleanupError) {
                this.logger.error(`Failed to clean up failed same-SKU recreation for ${sku}: ${cleanupError instanceof Error
                    ? cleanupError.message
                    : String(cleanupError)}`);
            }
            throw error;
        }
    }
    async recreatePublishedOfferWithFreshSku(storeId, offerId, sku, payload, canonicalSource, replacementSku) {
        const expected = this.normalize(payload);
        if (!canonicalSource?.item) {
            throw new common_1.BadRequestException(`Cannot recover SKU ${sku} with a fresh eBay SKU without a canonical ` +
                'source inventory item. The remote item is not trusted after a SKU collision.');
        }
        const item = this.inventoryItemPayloadForWrite(canonicalSource.item);
        let sourceOffer;
        let sourceOfferId = offerId;
        try {
            sourceOffer = await this.inventoryApi.getOffer(storeId, offerId);
        }
        catch (err) {
            if (!this.isNotFound(err))
                throw err;
            const page = await this.inventoryApi.getOffersBySku(storeId, sku, 100, 0);
            const published = page.offers.filter((candidate) => candidate.offerId && candidate.status === 'PUBLISHED');
            if (page.total > page.offers.length || published.length !== 1) {
                throw new common_1.BadRequestException(`Cannot recover SKU ${sku} with a fresh eBay SKU: the original offer ` +
                    `is missing and ${page.total} replacement offer(s) are visible.`);
            }
            sourceOffer = published[0];
            sourceOfferId = sourceOffer.offerId;
        }
        const listingPolicies = await this.resolveCurrentListingPolicies(storeId, sourceOffer.marketplaceId);
        const freshSku = this.freshInventorySku(sku, replacementSku);
        await this.assertFreshSkuAvailable(storeId, freshSku);
        const finalItem = {
            ...this.inventoryItemPayloadForWrite(item),
            sku: freshSku,
        };
        const neutralItem = this.neutralizeCatalogIdentifiers(finalItem);
        const canonicalOffer = canonicalSource.offer ?? {};
        const offerPayload = {
            sku: freshSku,
            marketplaceId: canonicalOffer.marketplaceId ?? sourceOffer.marketplaceId,
            format: canonicalOffer.format ?? sourceOffer.format,
            listingDescription: canonicalOffer.listingDescription ?? sourceOffer.listingDescription,
            availableQuantity: canonicalOffer.availableQuantity ?? sourceOffer.availableQuantity ?? 1,
            categoryId: canonicalOffer.categoryId ?? sourceOffer.categoryId,
            merchantLocationKey: canonicalOffer.merchantLocationKey ?? sourceOffer.merchantLocationKey,
            pricingSummary: canonicalOffer.pricingSummary ?? sourceOffer.pricingSummary,
            listingPolicies,
            tax: canonicalOffer.tax ?? sourceOffer.tax,
            listingDuration: canonicalOffer.listingDuration ?? sourceOffer.listingDuration,
            includeCatalogProductDetails: false,
            compatibility: expected,
        };
        if (canonicalOffer.listingPolicies) {
            offerPayload.listingPolicies = canonicalOffer.listingPolicies;
        }
        let createdFreshOfferId = null;
        let createdFreshItem = false;
        try {
            await this.inventoryApi.createOrReplaceItem(storeId, freshSku, neutralItem);
            createdFreshItem = true;
            await this.syncInventory(storeId, freshSku, expected);
            const created = await this.inventoryApi.createOffer(storeId, offerPayload);
            createdFreshOfferId = created.offerId;
            const published = await this.inventoryApi.publishOffer(storeId, created.offerId);
            if (!published.listingId) {
                throw new common_1.BadRequestException(`eBay did not return a listing ID for fresh SKU ${freshSku}.`);
            }
            await this.verifyLiveListing(storeId, published.listingId, sourceOffer.marketplaceId, freshSku, expected);
            await this.inventoryApi.createOrReplaceItem(storeId, freshSku, finalItem);
            await this.inventoryApi.updateOffer(storeId, created.offerId, {
                ...offerPayload,
                compatibility: expected,
                includeCatalogProductDetails: false,
            });
            await this.verifyLiveListing(storeId, published.listingId, sourceOffer.marketplaceId, freshSku, expected);
            await this.verifyFreshProjection(storeId, freshSku, created.offerId, finalItem, offerPayload);
            if (sourceOffer.status === 'PUBLISHED') {
                await this.inventoryApi.withdrawOffer(storeId, sourceOfferId);
            }
            await this.inventoryApi.deleteOffer(storeId, sourceOfferId);
            try {
                const remaining = await this.inventoryApi.getOffersBySku(storeId, sku, 100, 0);
                if (remaining.total === 0) {
                    await this.inventoryApi.deleteItem(storeId, sku);
                }
            }
            catch (err) {
                if (!this.isNotFound(err))
                    throw err;
            }
            this.logger.log(`Recovered stale eBay projection with fresh SKU ${freshSku}, ` +
                `offer ${created.offerId}, listing ${published.listingId}`);
            return {
                sku: freshSku,
                offerId: created.offerId,
                listingId: published.listingId,
            };
        }
        catch (err) {
            try {
                const freshOffers = await this.inventoryApi.getOffersBySku(storeId, freshSku, 100, 0);
                const ownedOffer = createdFreshOfferId
                    ? freshOffers.offers.find((candidate) => candidate.offerId === createdFreshOfferId)
                    : null;
                if (ownedOffer?.offerId) {
                    if (ownedOffer.status === 'PUBLISHED') {
                        await this.inventoryApi.withdrawOffer(storeId, ownedOffer.offerId);
                    }
                    await this.inventoryApi.deleteOffer(storeId, ownedOffer.offerId);
                }
                if (createdFreshItem && freshOffers.total === 0) {
                    await this.inventoryApi.deleteItem(storeId, freshSku);
                }
            }
            catch (cleanupErr) {
                this.logger.warn(`Fresh SKU cleanup failed for ${freshSku}: ${cleanupErr instanceof Error
                    ? cleanupErr.message
                    : String(cleanupErr)}`);
            }
            throw err;
        }
    }
    async verifyFreshProjection(storeId, sku, offerId, expectedItem, expectedOffer) {
        const [actualItem, actualOffer] = await Promise.all([
            this.inventoryApi.getItem(storeId, sku),
            this.inventoryApi.getOffer(storeId, offerId),
        ]);
        if (actualItem.product.title?.trim() !== expectedItem.product.title?.trim()) {
            throw new common_1.BadRequestException(`Fresh-SKU title verification failed for ${sku}.`);
        }
        if ((actualItem.product.imageUrls ?? []).length !==
            (expectedItem.product.imageUrls ?? []).length) {
            throw new common_1.BadRequestException(`Fresh-SKU image verification failed for ${sku}.`);
        }
        if (normalizeDescription(actualItem.product.description) !==
            normalizeDescription(expectedItem.product.description)) {
            throw new common_1.BadRequestException(`Fresh-SKU description verification failed for ${sku}.`);
        }
        for (const key of [
            'fulfillmentPolicyId',
            'paymentPolicyId',
            'returnPolicyId',
        ]) {
            const expectedId = expectedOffer.listingPolicies?.[key];
            if (expectedId && actualOffer.listingPolicies?.[key] !== expectedId) {
                throw new common_1.BadRequestException(`Fresh-SKU ${key} verification failed for ${sku}.`);
            }
        }
        if (expectedOffer.merchantLocationKey &&
            actualOffer.merchantLocationKey !== expectedOffer.merchantLocationKey) {
            throw new common_1.BadRequestException(`Fresh-SKU location verification failed for ${sku}.`);
        }
    }
    async verifyLiveListing(storeId, itemId, marketplaceId, sku, payload) {
        const expected = this.normalize(payload);
        const actual = await this.tradingApi.getItemDetails(storeId, itemId, marketplaceId);
        this.assertExactRows(sku, expected, actual.compatibility, 'Trading API');
        this.logger.log(`Verified ${expected.compatibleProducts.length} buyer-facing compatibility row(s) for SKU ${sku}, item ${itemId}`);
    }
    async syncLiveListing(storeId, itemId, marketplaceId, sku, payload) {
        const expected = this.normalize(payload);
        const current = await this.tradingApi.getItemDetails(storeId, itemId, marketplaceId);
        if (this.sameRows(expected, current.compatibility))
            return;
        await this.tradingApi.replaceItemCompatibility(storeId, itemId, expected, marketplaceId, current.listingDetails);
        const verified = await this.tradingApi.getItemDetails(storeId, itemId, marketplaceId);
        this.assertExactRows(sku, expected, verified.compatibility, 'Trading API');
        this.logger.log(`Reconciled ${expected.compatibleProducts.length} Trading API compatibility row(s) for SKU ${sku}, item ${itemId}`);
    }
    sameRows(expected, actual) {
        try {
            this.assertExactRows('', expected, actual, 'comparison');
            return true;
        }
        catch {
            return false;
        }
    }
    inventoryItemPayloadForWrite(item) {
        const { packageWeightAndSize, ...base } = item;
        const packagePayload = {};
        const weight = packageWeightAndSize?.weight;
        if (weight && Number.isFinite(weight.value) && weight.value > 0) {
            packagePayload.weight = weight;
        }
        const dimensions = packageWeightAndSize?.dimensions;
        if (dimensions &&
            dimensions.length.value > 0 &&
            dimensions.width.value > 0 &&
            dimensions.height.value > 0) {
            packagePayload.dimensions = dimensions;
        }
        return Object.keys(packagePayload).length > 0
            ? { ...base, packageWeightAndSize: packagePayload }
            : base;
    }
    async assertFreshSkuAvailable(storeId, sku) {
        const [offers, itemExists] = await Promise.all([
            this.inventoryApi.getOffersBySku(storeId, sku, 100, 0),
            this.inventoryApi
                .getItem(storeId, sku)
                .then(() => true)
                .catch((error) => {
                if (this.isNotFound(error))
                    return false;
                throw error;
            }),
        ]);
        if (offers.total > 0 || offers.offers.length > 0 || itemExists) {
            const offerIds = offers.offers
                .map((offer) => offer.offerId)
                .filter(Boolean)
                .join(',') || 'none';
            throw new common_1.BadRequestException(`Cannot recover with eBay SKU ${sku}: an inventory item or offer already exists; ` +
                `the replacement was not attempted (item=${itemExists}, offers=${offers.total}, offerIds=${offerIds}).`);
        }
    }
    freshInventorySku(sourceSku, requestedSku) {
        const requested = requestedSku?.trim();
        if (requested) {
            if (!/^[A-Za-z0-9._-]{1,50}$/.test(requested)) {
                throw new common_1.BadRequestException(`Replacement eBay SKU ${requested} is invalid; use 1-50 letters, numbers, dot, underscore, or hyphen.`);
            }
            if (requested === sourceSku) {
                throw new common_1.BadRequestException(`Replacement eBay SKU ${requested} is the same as the source SKU; a fresh recovery requires a different SKU.`);
            }
            return requested;
        }
        const deterministic = (0, ebay_sku_util_js_1.conflictSafeSkuFor)(sourceSku);
        if (deterministic)
            return deterministic;
        const base = sourceSku.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 34);
        return `${base || 'EBAY-FITMENT'}-FF-${Date.now().toString(36)}`.slice(0, 50);
    }
    neutralizeCatalogIdentifiers(item) {
        const { brand: _brand, mpn: _mpn, upc: _upc, ean: _ean, epid: _epid, ...productBase } = item.product;
        const aspects = Object.fromEntries(Object.entries(item.product.aspects ?? {}).filter(([name]) => {
            const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return ![
                'mpn',
                'oempartnumber',
                'oeoempartnumber',
                'manufacturerpartnumber',
                'partnumber',
                'epid',
            ].includes(key);
        }));
        return {
            ...item,
            product: {
                ...productBase,
                title: 'Used automotive replacement part',
                ...(Object.keys(aspects).length > 0 ? { aspects } : {}),
            },
        };
    }
    async resolveCurrentListingPolicies(storeId, marketplaceId) {
        if (!this.auth || !this.sellAccount) {
            throw new common_1.BadRequestException('Cannot safely recreate an eBay offer: live seller-policy services are unavailable.');
        }
        const token = await this.auth.getAccessToken(storeId);
        const baseUrl = await this.auth.getApiBaseUrlForStore(storeId);
        const accountMarketplace = marketplaceId === 'EBAY_MOTORS' ? 'EBAY_MOTORS_US' : marketplaceId;
        const [fulfillment, payment, returns] = await Promise.all([
            this.sellAccount.listFulfillmentPolicies(token, baseUrl, accountMarketplace),
            this.sellAccount.listPaymentPolicies(token, baseUrl, accountMarketplace),
            this.sellAccount.listReturnPolicies(token, baseUrl, accountMarketplace),
        ]);
        const pick = (rows) => rows.find((row) => row.isDefault)?.ebayPolicyId ?? rows[0]?.ebayPolicyId;
        const listingPolicies = {
            fulfillmentPolicyId: pick(fulfillment),
            paymentPolicyId: pick(payment),
            returnPolicyId: pick(returns),
        };
        if (!listingPolicies.fulfillmentPolicyId ||
            !listingPolicies.paymentPolicyId ||
            !listingPolicies.returnPolicyId) {
            throw new common_1.BadRequestException(`Cannot safely recreate SKU ${storeId}: eBay returned an incomplete seller-policy set.`);
        }
        return listingPolicies;
    }
    isNotFound(err) {
        if (axios_1.default.isAxiosError(err))
            return err.response?.status === 404;
        return Boolean(err &&
            typeof err === 'object' &&
            'response' in err &&
            err.response?.status === 404);
    }
};
exports.EbayCompatibilityReconciliationService = EbayCompatibilityReconciliationService;
exports.EbayCompatibilityReconciliationService = EbayCompatibilityReconciliationService = EbayCompatibilityReconciliationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [ebay_inventory_api_service_js_1.EbayInventoryApiService,
        ebay_trading_api_service_js_1.EbayTradingApiService,
        ebay_auth_service_js_1.EbayAuthService,
        ebay_sell_account_api_service_js_1.EbaySellAccountApiService])
], EbayCompatibilityReconciliationService);
//# sourceMappingURL=ebay-compatibility-reconciliation.service.js.map