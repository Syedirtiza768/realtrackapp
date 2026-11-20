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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EbayBrowseApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayBrowseApiService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const ebay_auth_service_js_1 = require("./ebay-auth.service.js");
class TokenBucketRateLimiter {
    tokens;
    lastRefill;
    maxTokens;
    refillRate;
    constructor(maxPerSecond) {
        this.maxTokens = maxPerSecond;
        this.tokens = maxPerSecond;
        this.refillRate = maxPerSecond / 1000;
        this.lastRefill = Date.now();
    }
    async acquire() {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }
        const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
        await new Promise((r) => setTimeout(r, waitMs));
        this.refill();
        this.tokens -= 1;
    }
    refill() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }
}
let EbayBrowseApiService = EbayBrowseApiService_1 = class EbayBrowseApiService {
    auth;
    logger = new common_1.Logger(EbayBrowseApiService_1.name);
    http;
    rateLimiter;
    constructor(auth) {
        this.auth = auth;
        const config = this.auth.getApiConfig();
        this.http = axios_1.default.create({
            baseURL: `${config.baseUrl}/buy/browse/v1`,
            timeout: 30_000,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });
        this.rateLimiter = new TokenBucketRateLimiter(2);
    }
    async withRateLimitRetry(label, fn, maxAttempts = 5) {
        const delaysMs = [2000, 5000, 12_000, 30_000, 60_000];
        let lastErr;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await fn();
            }
            catch (err) {
                lastErr = err;
                const response = err?.response;
                const status = response?.status;
                if (status !== 429 || attempt >= maxAttempts - 1)
                    throw err;
                const retryAfterHeader = response?.headers?.['retry-after'];
                let wait = delaysMs[attempt] ?? 25_000;
                if (retryAfterHeader) {
                    const seconds = Number(retryAfterHeader);
                    if (Number.isFinite(seconds) && seconds > 0) {
                        wait = seconds * 1000;
                    }
                    else {
                        const date = Date.parse(retryAfterHeader);
                        if (Number.isFinite(date))
                            wait = Math.max(0, date - Date.now());
                    }
                }
                this.logger.warn(`eBay Browse ${label} rate-limited (429) — retry ${attempt + 1}/${maxAttempts - 1} in ${wait}ms`);
                await new Promise((r) => setTimeout(r, wait));
            }
        }
        throw lastErr;
    }
    async appHeaders(marketplaceId) {
        const token = await this.auth.getApplicationToken();
        return {
            headers: {
                Authorization: `Bearer ${token}`,
                'X-EBAY-C-MARKETPLACE-ID': marketplaceId || 'EBAY_US',
            },
        };
    }
    async search(options) {
        const cfg = await this.appHeaders(options.marketplaceId);
        const params = {};
        if (options.q)
            params.q = options.q;
        if (options.categoryIds)
            params.category_ids = options.categoryIds;
        if (options.filter)
            params.filter = options.filter;
        if (options.sort)
            params.sort = options.sort;
        if (options.limit)
            params.limit = options.limit;
        if (options.offset)
            params.offset = options.offset;
        if (options.aspectFilter)
            params.aspect_filter = options.aspectFilter;
        if (options.seller)
            params.seller = options.seller;
        const { data } = await this.withRateLimitRetry(`search(${options.q || options.categoryIds || ''})`, async () => {
            await this.rateLimiter.acquire();
            return this.http.get('/item_summary/search', {
                ...cfg,
                params,
            });
        }, options.retryOnRateLimit === false ? 1 : undefined);
        return data;
    }
    async getItem(itemId, marketplaceId, retryOnRateLimit = true) {
        const cfg = await this.appHeaders(marketplaceId);
        const { data } = await this.withRateLimitRetry(`getItem(${itemId})`, async () => {
            await this.rateLimiter.acquire();
            return this.http.get(`/item/${itemId}`, cfg);
        }, retryOnRateLimit ? undefined : 1);
        return data;
    }
    async getItemByLegacyId(legacyItemId, marketplaceId) {
        const cfg = await this.appHeaders(marketplaceId);
        const { data } = await this.withRateLimitRetry(`getItemByLegacyId(${legacyItemId})`, async () => {
            await this.rateLimiter.acquire();
            return this.http.get(`/item/get_item_by_legacy_id`, {
                ...cfg,
                params: { legacy_item_id: legacyItemId },
            });
        });
        return data;
    }
    async searchSellerListings(options) {
        const limit = Math.min(options.limit ?? 100, 100);
        const filterParts = [];
        if (options.country)
            filterParts.push(`itemLocationCountry:${options.country}`);
        return this.search({
            seller: options.seller,
            marketplaceId: options.marketplaceId,
            categoryIds: options.categoryIds,
            limit,
            offset: options.offset ?? 0,
            filter: filterParts.length ? filterParts.join(',') : undefined,
        });
    }
    async getCompetitorPricing(partNumber, condition, limit = 25) {
        const filter = condition
            ? `conditionIds:{${condition === 'NEW' ? '1000' : '3000'}}`
            : undefined;
        const result = await this.search({
            q: partNumber,
            filter,
            sort: 'price',
            limit,
        });
        const items = result.itemSummaries ?? [];
        const prices = items
            .map((i) => parseFloat(i.price?.value ?? '0'))
            .filter((p) => p > 0)
            .sort((a, b) => a - b);
        const avgPrice = prices.length > 0
            ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
            : null;
        const medianPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : null;
        const minPrice = prices.length > 0 ? prices[0] : null;
        const maxPrice = prices.length > 0 ? prices[prices.length - 1] : null;
        return {
            items,
            total: result.total ?? 0,
            avgPrice,
            medianPrice,
            minPrice,
            maxPrice,
        };
    }
    async searchByMpn(brand, mpn, options) {
        if (!mpn?.trim()) {
            return { found: false, items: [] };
        }
        const query = [brand?.trim(), mpn.trim()].filter(Boolean).join(' ');
        const limit = options?.limit ?? 10;
        try {
            const result = await this.search({
                q: query,
                limit,
                categoryIds: options?.categoryIds,
                marketplaceId: options?.marketplaceId,
                ...(options?.retryOnRateLimit === undefined
                    ? {}
                    : { retryOnRateLimit: options.retryOnRateLimit }),
            });
            const summaries = result.itemSummaries ?? [];
            if (summaries.length === 0) {
                this.logger.debug(`eBay catalog lookup: no results for "${query}"`);
                return { found: false, items: [] };
            }
            const detailSummaries = summaries.slice(0, Math.min(3, summaries.length));
            const detailResults = await Promise.allSettled(detailSummaries.map((s) => (options?.retryOnRateLimit === false
                ? this.getItem(s.itemId, options.marketplaceId, false)
                : this.getItem(s.itemId, options?.marketplaceId)).catch(() => null)));
            const items = [];
            for (let index = 0; index < detailResults.length; index++) {
                const settled = detailResults[index];
                const item = settled.status === 'fulfilled' ? settled.value : null;
                if (!item)
                    continue;
                const aspects = {};
                if (Array.isArray(item.localizedAspects)) {
                    for (const a of item.localizedAspects) {
                        const values = aspects[a.name] ?? [];
                        if (!values.includes(a.value))
                            values.push(a.value);
                        aspects[a.name] = values;
                    }
                }
                const fitmentHints = this.extractFitmentFromAspects(aspects);
                items.push({
                    itemId: item.itemId,
                    title: item.title,
                    itemWebUrl: item.itemWebUrl ?? null,
                    brand: item.brand ??
                        this.firstAspectValue(aspects, ['Brand', 'Manufacturer']) ??
                        null,
                    mpn: item.mpn ??
                        this.firstAspectValue(aspects, [
                            'Manufacturer Part Number',
                            'MPN',
                            'Part Number',
                            'OE/OEM Part Number',
                        ]) ??
                        null,
                    epid: item.epid ?? null,
                    categoryId: item.categories?.[0]?.categoryId ?? null,
                    categoryName: item.categories?.[0]?.categoryName ?? null,
                    aspects,
                    fitmentHints,
                });
            }
            for (const s of summaries.slice(detailSummaries.length)) {
                items.push({
                    itemId: s.itemId,
                    title: s.title,
                    itemWebUrl: s.itemWebUrl ?? null,
                    brand: null,
                    mpn: null,
                    epid: null,
                    categoryId: s.categories?.[0]?.categoryId ?? null,
                    categoryName: s.categories?.[0]?.categoryName ?? null,
                    aspects: {},
                    fitmentHints: [],
                });
            }
            this.logger.log(`eBay catalog lookup: found ${items.length} items for "${query}" — ` +
                `EPIDs: ${items
                    .filter((i) => i.epid)
                    .map((i) => i.epid)
                    .join(', ') || 'none'}`);
            return { found: items.length > 0, items };
        }
        catch (err) {
            this.logger.warn(`eBay catalog lookup failed for "${query}": ${err instanceof Error ? err.message : err}`);
            return { found: false, items: [] };
        }
    }
    extractFitmentFromAspects(aspects) {
        const hints = [];
        const yearValues = this.aspectValues(aspects, [
            'Year',
            'Model Year',
            'Vehicle Year',
            'Compatible Year',
        ]);
        const makeValues = this.aspectValues(aspects, [
            'Compatible Make',
            'Vehicle Make',
            'Make',
            'Manufacturer',
        ]);
        const modelValues = this.aspectValues(aspects, [
            'Compatible Model',
            'Vehicle Model',
            'Model',
        ]);
        if (yearValues.length > 0 ||
            makeValues.length > 0 ||
            modelValues.length > 0) {
            const maxLen = Math.max(yearValues.length, makeValues.length, modelValues.length);
            const valueAt = (values, index) => values.length === 1 ? values[0] : values[index];
            for (let i = 0; i < maxLen; i++) {
                const hint = {};
                const year = valueAt(yearValues, i);
                const make = valueAt(makeValues, i);
                const model = valueAt(modelValues, i);
                if (year)
                    hint.year = year;
                if (make)
                    hint.make = make;
                if (model)
                    hint.model = model;
                if (hint.year || hint.make || hint.model)
                    hints.push(hint);
            }
        }
        const compatVehicles = this.aspectValues(aspects, [
            'Compatible Vehicles',
            'Vehicle Type',
        ]);
        for (const cv of compatVehicles) {
            const parsed = this.parseVehicleString(cv);
            if (parsed)
                hints.push(parsed);
        }
        return hints;
    }
    aspectValues(aspects, names) {
        const wanted = new Set(names.map((name) => this.normalizeAspectName(name)));
        const values = [];
        for (const [name, candidates] of Object.entries(aspects)) {
            if (!wanted.has(this.normalizeAspectName(name)))
                continue;
            for (const candidate of candidates) {
                const value = candidate.trim();
                if (value && !values.includes(value))
                    values.push(value);
            }
        }
        return values;
    }
    firstAspectValue(aspects, names) {
        return this.aspectValues(aspects, names)[0] ?? null;
    }
    normalizeAspectName(name) {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    parseVehicleString(text) {
        if (!text?.trim())
            return null;
        const trimmed = text.trim();
        const yearPattern = '(?:19|20)\\d{2}(?:\\s*[-–—]\\s*(?:19|20)\\d{2})?';
        const yearFirst = trimmed.match(new RegExp(`^(${yearPattern})\\s+([A-Za-z-]+)\\s+(.+)$`));
        if (yearFirst) {
            return {
                year: yearFirst[1],
                make: yearFirst[2],
                model: yearFirst[3].trim(),
            };
        }
        const yearLast = trimmed.match(new RegExp(`^([A-Za-z-]+)\\s+(.+)\\s+(${yearPattern})$`));
        if (yearLast) {
            return {
                year: yearLast[3],
                make: yearLast[1],
                model: yearLast[2].trim(),
            };
        }
        const noYear = trimmed.match(/^([A-Za-z-]+)\s+(.+)$/);
        if (noYear) {
            return { make: noYear[1], model: noYear[2].trim() };
        }
        return null;
    }
};
exports.EbayBrowseApiService = EbayBrowseApiService;
exports.EbayBrowseApiService = EbayBrowseApiService = EbayBrowseApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ebay_auth_service_js_1.EbayAuthService])
], EbayBrowseApiService);
//# sourceMappingURL=ebay-browse-api.service.js.map