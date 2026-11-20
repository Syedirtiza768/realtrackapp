"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EbayAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
const ebay_listing_condition_util_js_1 = require("../../ebay/ebay-listing-condition.util.js");
const ebay_publish_quantity_util_js_1 = require("../../ebay/ebay-publish-quantity.util.js");
const ebay_marketplace_headers_util_js_1 = require("../../ebay/ebay-marketplace-headers.util.js");
const ebay_inventory_location_util_js_1 = require("../../ebay/ebay-inventory-location.util.js");
const ebay_api_error_util_js_1 = require("../../ebay/ebay-api-error.util.js");
let EbayAdapter = EbayAdapter_1 = class EbayAdapter {
    config;
    channelName = 'ebay';
    logger = new common_1.Logger(EbayAdapter_1.name);
    clientId;
    clientSecret;
    redirectUri;
    sandbox;
    baseUrl;
    authUrl;
    http;
    constructor(config) {
        this.config = config;
        this.clientId = this.config.get('EBAY_CLIENT_ID', '');
        this.clientSecret = this.config.get('EBAY_CLIENT_SECRET', '');
        this.redirectUri = this.config.get('EBAY_REDIRECT_URI', '');
        this.sandbox = this.config.get('EBAY_SANDBOX', 'true') === 'true';
        this.baseUrl = this.sandbox
            ? 'https://api.sandbox.ebay.com'
            : 'https://api.ebay.com';
        this.authUrl = this.sandbox
            ? 'https://auth.sandbox.ebay.com'
            : 'https://auth.ebay.com';
        this.http = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: 30_000,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    getAuthUrl(state) {
        const scopes = [
            'https://api.ebay.com/oauth/api_scope',
            'https://api.ebay.com/oauth/api_scope/sell.inventory',
            'https://api.ebay.com/oauth/api_scope/sell.account',
            'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
        ].join('%20');
        return (`${this.authUrl}/oauth2/authorize?` +
            `client_id=${this.clientId}` +
            `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
            `&response_type=code` +
            `&scope=${scopes}` +
            `&state=${state}`);
    }
    exchangeLegacyToken(legacyToken) {
        return {
            accessToken: legacyToken,
            refreshToken: undefined,
            expiresAt: new Date(Date.now() + 548 * 24 * 60 * 60 * 1000),
            scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.fulfillment',
            tokenType: 'legacy',
            legacyToken,
        };
    }
    async exchangeCode(code) {
        const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
        const { data } = await this.http.post('/identity/v1/oauth2/token', new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: this.redirectUri,
        }).toString(), {
            headers: {
                Authorization: `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
            scope: data.scope,
            tokenType: data.token_type,
        };
    }
    async refreshTokens(refreshToken) {
        const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
        const { data } = await this.http.post('/identity/v1/oauth2/token', new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory',
        }).toString(), {
            headers: {
                Authorization: `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? refreshToken,
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
            scope: data.scope,
            tokenType: data.token_type,
        };
    }
    async publishListing(tokens, listingData, _storeContext) {
        try {
            const sku = listingData['sku'] || `SKU-${Date.now()}`;
            const condition = (0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(listingData['condition'], 'USED_EXCELLENT');
            const requestedQuantity = Number(listingData['quantity'] ?? 1);
            const quantity = Number.isFinite(requestedQuantity)
                ? (0, ebay_publish_quantity_util_js_1.capEbayPublishQuantity)(requestedQuantity)
                : 1;
            const marketplaceRaw = listingData['marketplaceId'] || 'EBAY_MOTORS_US';
            const marketplaceId = (0, ebay_marketplace_headers_util_js_1.toEbayInventoryApiMarketplaceId)(marketplaceRaw);
            const authHeaders = { Authorization: `Bearer ${tokens.accessToken}` };
            const requestedLocationKey = typeof listingData['locationKey'] === 'string'
                ? listingData['locationKey'].trim()
                : '';
            const merchantLocationKey = requestedLocationKey &&
                !(0, ebay_inventory_location_util_js_1.isLegacyDefaultMerchantLocationKey)(requestedLocationKey)
                ? requestedLocationKey
                : ebay_inventory_location_util_js_1.DEFAULT_MERCHANT_LOCATION_KEY;
            await this.http.put(`/sell/inventory/v1/inventory_item/${sku}`, {
                availability: {
                    shipToLocationAvailability: {
                        quantity,
                    },
                },
                condition,
                product: {
                    title: listingData['title'],
                    description: listingData['description'],
                    imageUrls: listingData['imageUrls'] ?? [],
                    aspects: listingData['aspects'] ?? {},
                },
            }, { headers: authHeaders });
            const offerPayload = {
                sku,
                marketplaceId,
                format: 'FIXED_PRICE',
                listingDescription: listingData['description'],
                pricingSummary: {
                    price: {
                        value: String(listingData['price']),
                        currency: 'USD',
                    },
                },
                categoryId: listingData['categoryId'],
                merchantLocationKey,
                listingDuration: 'GTC',
            };
            if (listingData['fulfillmentPolicyId']) {
                offerPayload.listingPolicies = {
                    fulfillmentPolicyId: listingData['fulfillmentPolicyId'],
                    paymentPolicyId: listingData['paymentPolicyId'],
                    returnPolicyId: listingData['returnPolicyId'],
                };
            }
            let offerId;
            try {
                const { data: offerData } = await this.http.post('/sell/inventory/v1/offer', offerPayload, { headers: authHeaders });
                offerId = offerData.offerId;
            }
            catch (offerErr) {
                if (!(0, ebay_api_error_util_js_1.isEbayOfferAlreadyExistsError)(offerErr))
                    throw offerErr;
                const existingOfferId = (0, ebay_api_error_util_js_1.extractEbayErrorParameter)(offerErr, 'offerId');
                if (!existingOfferId)
                    throw offerErr;
                offerId = existingOfferId;
                await this.http.put(`/sell/inventory/v1/offer/${offerId}`, offerPayload, { headers: authHeaders });
            }
            const { data: publishData } = await this.http.post(`/sell/inventory/v1/offer/${offerId}/publish`, {}, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
            const itemUrl = this.sandbox
                ? `https://www.sandbox.ebay.com/itm/${publishData.listingId}`
                : `https://www.ebay.com/itm/${publishData.listingId}`;
            return {
                externalId: publishData.listingId,
                externalUrl: itemUrl,
                status: 'active',
            };
        }
        catch (error) {
            this.logger.error(`eBay publish failed: ${error.message}`);
            return {
                externalId: '',
                status: 'error',
                error: error?.response?.data?.errors?.[0]?.message ?? error.message,
            };
        }
    }
    async updateListing(tokens, externalId, listingData, _storeContext) {
        try {
            const sku = listingData['sku'] || externalId;
            await this.http.put(`/sell/inventory/v1/inventory_item/${sku}`, {
                product: {
                    title: listingData['title'],
                    description: listingData['description'],
                    imageUrls: listingData['imageUrls'] ?? [],
                },
            }, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
            return { externalId, status: 'active' };
        }
        catch (error) {
            return {
                externalId,
                status: 'error',
                error: error?.response?.data?.errors?.[0]?.message ?? error.message,
            };
        }
    }
    async endListing(tokens, externalId, _storeContext) {
        await this.http.post(`/sell/inventory/v1/offer/${externalId}/withdraw`, {}, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    }
    async syncInventory(tokens, items, _storeContext) {
        let succeeded = 0;
        let failed = 0;
        for (const item of items) {
            try {
                await this.http.put(`/sell/inventory/v1/inventory_item/${item.externalId}`, {
                    availability: {
                        shipToLocationAvailability: { quantity: item.quantity },
                    },
                }, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
                succeeded++;
            }
            catch {
                failed++;
            }
        }
        return { succeeded, failed };
    }
    async getRecentOrders(tokens, since, _storeContext) {
        const { data } = await this.http.get('/sell/fulfillment/v1/order', {
            params: {
                filter: `creationdate:[${since.toISOString()}..${new Date().toISOString()}]`,
                limit: 50,
            },
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        return (data.orders ?? []).map((o) => ({
            externalOrderId: o.orderId,
            externalListingId: o.lineItems?.[0]?.legacyItemId ?? '',
            buyerUsername: o.buyer?.username ?? '',
            quantity: o.lineItems?.reduce((sum, li) => sum + li.quantity, 0) ??
                1,
            totalPrice: parseFloat(o.pricingSummary?.total?.value ?? '0'),
            currency: o.pricingSummary?.total?.currency ?? 'USD',
            shippingAddress: o.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo ?? {},
            orderedAt: new Date(o.creationDate),
            rawPayload: o,
        }));
    }
    verifyWebhookSignature(rawBody, signature, secret) {
        const hash = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('base64');
        return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
    }
};
exports.EbayAdapter = EbayAdapter;
exports.EbayAdapter = EbayAdapter = EbayAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EbayAdapter);
//# sourceMappingURL=ebay.adapter.js.map