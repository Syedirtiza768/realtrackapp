"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EbaySellAccountApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbaySellAccountApiService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
let EbaySellAccountApiService = EbaySellAccountApiService_1 = class EbaySellAccountApiService {
    logger = new common_1.Logger(EbaySellAccountApiService_1.name);
    client(baseUrl) {
        return axios_1.default.create({
            baseURL: baseUrl.replace(/\/$/, ''),
            timeout: 45_000,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });
    }
    async listFulfillmentPolicies(accessToken, baseUrl, marketplaceId, signal) {
        return this.listPaged(accessToken, baseUrl, '/sell/account/v1/fulfillment_policy', marketplaceId, (data) => {
            const policies = data.fulfillmentPolicies ??
                [];
            return policies.map((p) => {
                const row = p;
                const id = String(row.fulfillmentPolicyId ?? row.fulfillment_policy_id ?? '');
                const name = String(row.name ?? id);
                const isDefault = this.readDefaultFlag(row);
                return {
                    ebayPolicyId: id,
                    name,
                    isDefault,
                    raw: row,
                };
            });
        }, signal);
    }
    async listPaymentPolicies(accessToken, baseUrl, marketplaceId, signal) {
        return this.listPaged(accessToken, baseUrl, '/sell/account/v1/payment_policy', marketplaceId, (data) => {
            const policies = data.paymentPolicies ?? [];
            return policies.map((p) => {
                const row = p;
                const id = String(row.paymentPolicyId ?? row.payment_policy_id ?? '');
                const name = String(row.name ?? id);
                const isDefault = this.readDefaultFlag(row);
                return {
                    ebayPolicyId: id,
                    name,
                    isDefault,
                    raw: row,
                };
            });
        }, signal);
    }
    async createReturnPolicy(accessToken, baseUrl, marketplaceId, body) {
        const http = this.client(baseUrl);
        const { data, headers } = await http.post('/sell/account/v1/return_policy', body, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
            },
        });
        const row = (data ?? {});
        const fromBody = String(row.returnPolicyId ?? row.return_policy_id ?? '');
        const location = String(headers.location ?? headers.Location ?? '');
        const fromLocation = location.match(/return_policy\/(\d+)/i)?.[1] ?? '';
        const returnPolicyId = fromBody || fromLocation;
        if (!returnPolicyId) {
            throw new Error('eBay createReturnPolicy did not return returnPolicyId');
        }
        return { returnPolicyId, raw: row };
    }
    async updateReturnPolicy(accessToken, baseUrl, marketplaceId, returnPolicyId, body) {
        const http = this.client(baseUrl);
        const { data } = await http.put(`/sell/account/v1/return_policy/${encodeURIComponent(returnPolicyId)}`, body, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
            },
        });
        return (data ?? {});
    }
    async listReturnPolicies(accessToken, baseUrl, marketplaceId, signal) {
        return this.listPaged(accessToken, baseUrl, '/sell/account/v1/return_policy', marketplaceId, (data) => {
            const policies = data.returnPolicies ?? [];
            return policies.map((p) => {
                const row = p;
                const id = String(row.returnPolicyId ?? row.return_policy_id ?? '');
                const name = String(row.name ?? id);
                const isDefault = this.readDefaultFlag(row);
                return {
                    ebayPolicyId: id,
                    name,
                    isDefault,
                    raw: row,
                };
            });
        }, signal);
    }
    async listInventoryLocations(accessToken, baseUrl, marketplaceId) {
        const http = this.client(baseUrl);
        const out = [];
        let offset = 0;
        const limit = 50;
        const MAX_PAGES = 20;
        for (let page = 0; page < MAX_PAGES; page++) {
            const { data } = await http.get('/sell/inventory/v1/location', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
                },
                params: { limit, offset },
            });
            const locs = data.locations ?? [];
            const total = data.total ?? Number.MAX_SAFE_INTEGER;
            for (const l of locs) {
                const row = l;
                const key = String(row.merchantLocationKey ?? '');
                if (!key)
                    continue;
                const name = String(row.name ?? key);
                out.push({
                    merchantLocationKey: key,
                    name,
                    raw: row,
                });
            }
            if (offset + locs.length >= total || locs.length !== limit)
                break;
            offset += limit;
        }
        return out;
    }
    readDefaultFlag(row) {
        const labels = row.label;
        if (Array.isArray(labels)) {
            return labels.some((l) => String(l).toUpperCase().includes('DEFAULT'));
        }
        return false;
    }
    async listPaged(accessToken, baseUrl, path, marketplaceId, mapPage, signal) {
        const http = this.client(baseUrl);
        const out = [];
        let offset = 0;
        const limit = 20;
        const MAX_PAGES = 50;
        for (let page = 0; page < MAX_PAGES; page++) {
            try {
                const { data } = await http.get(path, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
                    },
                    params: {
                        marketplace_id: marketplaceId,
                        limit,
                        offset,
                    },
                    signal,
                });
                const batch = mapPage(data).filter((p) => p.ebayPolicyId);
                out.push(...batch);
                const total = data.total ?? Number.MAX_SAFE_INTEGER;
                if (offset + batch.length >= total || batch.length !== limit)
                    break;
                offset += limit;
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.warn(`eBay policy list failed ${path} mp=${marketplaceId} offset=${offset}: ${msg}`);
                throw err;
            }
        }
        return out;
    }
};
exports.EbaySellAccountApiService = EbaySellAccountApiService;
exports.EbaySellAccountApiService = EbaySellAccountApiService = EbaySellAccountApiService_1 = __decorate([
    (0, common_1.Injectable)()
], EbaySellAccountApiService);
//# sourceMappingURL=ebay-sell-account-api.service.js.map