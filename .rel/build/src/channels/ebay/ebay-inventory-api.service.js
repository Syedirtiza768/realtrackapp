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
var EbayInventoryApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayInventoryApiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const axios_1 = __importDefault(require("axios"));
const vertical_config_js_1 = require("../../verticals/vertical.config.js");
const ebay_inventory_location_util_js_1 = require("./ebay-inventory-location.util.js");
const store_entity_js_1 = require("../entities/store.entity.js");
const ebay_marketplace_config_service_js_1 = require("../../integrations/ebay/services/ebay-marketplace-config.service.js");
const ebay_auth_service_js_1 = require("./ebay-auth.service.js");
const ebay_marketplace_headers_util_js_1 = require("./ebay-marketplace-headers.util.js");
let EbayInventoryApiService = EbayInventoryApiService_1 = class EbayInventoryApiService {
    auth;
    marketplaceConfig;
    configService;
    storeRepo;
    logger = new common_1.Logger(EbayInventoryApiService_1.name);
    http;
    verifiedLocationCache = new Map();
    verifiedLocationCacheTtlMs = 5 * 60 * 1000;
    constructor(auth, marketplaceConfig, configService, storeRepo) {
        this.auth = auth;
        this.marketplaceConfig = marketplaceConfig;
        this.configService = configService;
        this.storeRepo = storeRepo;
        const config = this.auth.getApiConfig();
        this.http = axios_1.default.create({
            baseURL: `${config.baseUrl}/sell/inventory/v1`,
            timeout: 30_000,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });
    }
    async authHeaders(storeId) {
        const token = await this.auth.getAccessToken(storeId);
        const baseUrl = await this.auth.getApiBaseUrlForStore(storeId);
        const store = await this.storeRepo.findOneBy({ id: storeId });
        const marketplaceId = store
            ? (0, ebay_marketplace_headers_util_js_1.resolveMarketplaceId)(store)
            : 'EBAY_MOTORS_US';
        const mpHeaders = (0, ebay_marketplace_headers_util_js_1.marketplaceRequestHeaders)(marketplaceId, this.marketplaceConfig.get(marketplaceId));
        return {
            baseURL: `${baseUrl}/sell/inventory/v1`,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...mpHeaders,
            },
        };
    }
    async createOrReplaceItem(storeId, sku, item) {
        const cfg = await this.authHeaders(storeId);
        await this.http.put(`/inventory_item/${encodeURIComponent(sku)}`, item, cfg);
        this.logger.debug(`Upserted inventory item ${sku} for store ${storeId}`);
    }
    async createOrReplaceInventoryItemGroup(storeId, inventoryItemGroupKey, group) {
        const cfg = await this.authHeaders(storeId);
        await this.http.put(`/inventory_item_group/${encodeURIComponent(inventoryItemGroupKey)}`, group, cfg);
        this.logger.debug(`Upserted inventory item group ${inventoryItemGroupKey} for store ${storeId}`);
    }
    async getInventoryItemGroup(storeId, inventoryItemGroupKey) {
        const cfg = await this.authHeaders(storeId);
        const { data } = await this.http.get(`/inventory_item_group/${encodeURIComponent(inventoryItemGroupKey)}`, cfg);
        return data;
    }
    async deleteInventoryItemGroup(storeId, inventoryItemGroupKey) {
        const cfg = await this.authHeaders(storeId);
        await this.http.delete(`/inventory_item_group/${encodeURIComponent(inventoryItemGroupKey)}`, cfg);
    }
    async getItem(storeId, sku) {
        const cfg = await this.authHeaders(storeId);
        const { data } = await this.http.get(`/inventory_item/${encodeURIComponent(sku)}`, cfg);
        return data;
    }
    async getItems(storeId, limit = 25, offset = 0) {
        const cfg = await this.authHeaders(storeId);
        const { data } = await this.http.get(`/inventory_item`, { ...cfg, params: { limit, offset } });
        return data;
    }
    async withdrawOffer(storeId, offerId) {
        const cfg = await this.authHeaders(storeId);
        await this.http.post(`/offer/${offerId}/withdraw`, {}, cfg);
        this.logger.log(`Withdrew offer ${offerId} for store ${storeId}`);
    }
    async deleteOffer(storeId, offerId) {
        const cfg = await this.authHeaders(storeId);
        await this.http.delete(`/offer/${offerId}`, cfg);
        this.logger.log(`Deleted offer ${offerId} for store ${storeId}`);
    }
    async deleteItem(storeId, sku) {
        const cfg = await this.authHeaders(storeId);
        await this.http.delete(`/inventory_item/${encodeURIComponent(sku)}`, cfg);
        this.logger.log(`Deleted inventory item ${sku} for store ${storeId}`);
    }
    async bulkUpdatePriceQuantity(storeId, updates) {
        const cfg = await this.authHeaders(storeId);
        const { data } = await this.http.post(`/bulk_update_price_quantity`, { requests: updates }, cfg);
        this.logger.log(`Bulk updated ${updates.length} items for store ${storeId}`);
        return data;
    }
    async createOffer(storeId, offer) {
        const cfg = await this.authHeaders(storeId);
        const payload = {
            ...offer,
            marketplaceId: (0, ebay_marketplace_headers_util_js_1.toEbayInventoryApiMarketplaceId)(offer.marketplaceId),
        };
        const { data } = await this.http.post(`/offer`, payload, cfg);
        this.logger.debug(`Created offer ${data.offerId} for SKU ${offer.sku} on store ${storeId}`);
        return data;
    }
    async updateOffer(storeId, offerId, offer) {
        const cfg = await this.authHeaders(storeId);
        const payload = offer.marketplaceId != null
            ? {
                ...offer,
                marketplaceId: (0, ebay_marketplace_headers_util_js_1.toEbayInventoryApiMarketplaceId)(offer.marketplaceId),
            }
            : offer;
        await this.http.put(`/offer/${offerId}`, payload, cfg);
        this.logger.debug(`Updated offer ${offerId} for store ${storeId}`);
    }
    async getOffer(storeId, offerId) {
        const cfg = await this.authHeaders(storeId);
        const { data } = await this.http.get(`/offer/${offerId}`, cfg);
        return data;
    }
    async getOffersBySku(storeId, sku, limit = 25, offset = 0) {
        return this.getOffers(storeId, { sku, limit, offset });
    }
    async getOffers(storeId, params = {}) {
        const cfg = await this.authHeaders(storeId);
        try {
            const { data } = await this.http.get(`/offer`, {
                ...cfg,
                params: {
                    limit: params.limit ?? 25,
                    offset: params.offset ?? 0,
                    ...(params.sku ? { sku: params.sku } : {}),
                    ...(params.marketplaceId
                        ? {
                            marketplace_id: (0, ebay_marketplace_headers_util_js_1.toEbayInventoryApiMarketplaceId)(params.marketplaceId),
                        }
                        : {}),
                },
            });
            return { offers: data.offers ?? [], total: data.total ?? 0 };
        }
        catch (err) {
            if (axios_1.default.isAxiosError(err) && err.response?.status === 404) {
                return { offers: [], total: 0 };
            }
            throw err;
        }
    }
    async publishOffer(storeId, offerId) {
        const cfg = await this.authHeaders(storeId);
        const { data } = await this.http.post(`/offer/${offerId}/publish`, {}, cfg);
        this.logger.log(`Published offer ${offerId} → listingId=${data.listingId} for store ${storeId}`);
        return data;
    }
    async publishOfferByInventoryItemGroup(storeId, inventoryItemGroupKey) {
        const cfg = await this.authHeaders(storeId);
        const { data } = await this.http.post(`/offer/publish_by_inventory_item_group`, { inventoryItemGroupKey }, cfg);
        this.logger.log(`Published inventory item group ${inventoryItemGroupKey} for store ${storeId}`);
        return data;
    }
    async withdrawOfferByInventoryItemGroup(storeId, inventoryItemGroupKey) {
        const cfg = await this.authHeaders(storeId);
        await this.http.post(`/offer/withdraw_by_inventory_item_group`, { inventoryItemGroupKey }, cfg);
    }
    async setCompatibility(storeId, sku, payload) {
        const cfg = await this.authHeaders(storeId);
        await this.http.put(`/inventory_item/${encodeURIComponent(sku)}/product_compatibility`, payload, cfg);
        this.logger.debug(`Set compatibility for ${sku} with ${payload.compatibleProducts.length} vehicles`);
    }
    async getCompatibility(storeId, sku) {
        const cfg = await this.authHeaders(storeId);
        const { data } = await this.http.get(`/inventory_item/${encodeURIComponent(sku)}/product_compatibility`, cfg);
        return data;
    }
    async deleteCompatibility(storeId, sku) {
        const cfg = await this.authHeaders(storeId);
        await this.http.delete(`/inventory_item/${encodeURIComponent(sku)}/product_compatibility`, cfg);
        this.logger.debug(`Deleted compatibility for ${sku}`);
    }
    async createLocation(storeId, merchantLocationKey, location) {
        const cfg = await this.authHeaders(storeId);
        await this.http.post(`/location/${encodeURIComponent(merchantLocationKey)}`, location, cfg);
        this.logger.log(`Created inventory location ${merchantLocationKey} for store ${storeId}`);
    }
    async getLocation(storeId, merchantLocationKey) {
        const cfg = await this.authHeaders(storeId);
        try {
            const { data } = await this.http.get(`/location/${encodeURIComponent(merchantLocationKey)}`, cfg);
            return data?.merchantLocationKey ? data : null;
        }
        catch (err) {
            if (axios_1.default.isAxiosError(err) && err.response?.status === 404) {
                return null;
            }
            throw err;
        }
    }
    async getLocations(storeId, limit = 25, offset = 0) {
        const cfg = await this.authHeaders(storeId);
        const { data } = await this.http.get(`/location`, {
            ...cfg,
            params: { limit, offset },
        });
        return { locations: data.locations ?? [], total: data.total ?? 0 };
    }
    async ensureMerchantLocation(storeId, preferredKey) {
        const store = await this.storeRepo.findOneBy({ id: storeId });
        const isFashion = (0, vertical_config_js_1.isDedicatedFashionStore)(store?.verticalConfig);
        const keyHint = isFashion
            ? preferredKey?.trim() || store?.locationKey?.trim()
            : (0, ebay_inventory_location_util_js_1.resolvePreferredMerchantLocationKey)(this.configService, store, preferredKey);
        if (!keyHint)
            return null;
        const cacheKey = `${storeId}:${keyHint}`;
        const cached = this.verifiedLocationCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.merchantLocationKey;
        }
        try {
            const preferred = await this.getLocation(storeId, keyHint);
            if (isFashion) {
                if (preferred?.merchantLocationKey !== keyHint ||
                    preferred.merchantLocationStatus !== 'ENABLED') {
                    throw new common_1.BadRequestException(`Fashion inventory location "${keyHint}" is missing or disabled on eBay.`);
                }
                this.rememberVerifiedLocation(cacheKey, keyHint);
                return keyHint;
            }
            if (preferred?.merchantLocationKey &&
                preferred.merchantLocationStatus !== 'DISABLED' &&
                (0, ebay_inventory_location_util_js_1.isUaeInventoryLocation)(preferred)) {
                this.rememberVerifiedLocation(cacheKey, preferred.merchantLocationKey);
                return preferred.merchantLocationKey;
            }
            if (preferred?.merchantLocationKey) {
                this.logger.warn(`Ignored non-UAE or disabled inventory location "${preferred.merchantLocationKey}" for store ${storeId}; resolving the Dubai location instead`);
            }
            const { locations } = await this.getLocations(storeId);
            if (locations.length) {
                const preferred = (0, ebay_inventory_location_util_js_1.pickPreferredInventoryLocationKey)(locations.filter((location) => location.merchantLocationStatus !== 'DISABLED'), keyHint);
                if (preferred) {
                    if (preferred !== keyHint) {
                        this.logger.warn(`Configured inventory location "${keyHint}" was not usable for store ${storeId}; using existing eBay location "${preferred}"`);
                    }
                    this.rememberVerifiedLocation(cacheKey, preferred);
                    return preferred;
                }
            }
            const payload = (0, ebay_inventory_location_util_js_1.buildDefaultInventoryLocationPayload)(this.configService, store);
            await this.createLocation(storeId, keyHint, payload);
            this.rememberVerifiedLocation(cacheKey, keyHint);
            if (store &&
                (!store.locationKey ||
                    (0, ebay_inventory_location_util_js_1.isLegacyDefaultMerchantLocationKey)(store.locationKey))) {
                store.locationKey = keyHint;
                await this.storeRepo.save(store);
            }
            this.logger.log(`Provisioned default inventory location "${keyHint}" for store ${store?.storeName ?? storeId}`);
            return keyHint;
        }
        catch (err) {
            if (isFashion)
                throw err;
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Could not ensure inventory location for store ${storeId}: ${message}`);
            return null;
        }
    }
    rememberVerifiedLocation(cacheKey, merchantLocationKey) {
        this.verifiedLocationCache.set(cacheKey, {
            merchantLocationKey,
            expiresAt: Date.now() + this.verifiedLocationCacheTtlMs,
        });
    }
};
exports.EbayInventoryApiService = EbayInventoryApiService;
exports.EbayInventoryApiService = EbayInventoryApiService = EbayInventoryApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __metadata("design:paramtypes", [ebay_auth_service_js_1.EbayAuthService,
        ebay_marketplace_config_service_js_1.EbayMarketplaceConfigService,
        config_1.ConfigService,
        typeorm_2.Repository])
], EbayInventoryApiService);
//# sourceMappingURL=ebay-inventory-api.service.js.map