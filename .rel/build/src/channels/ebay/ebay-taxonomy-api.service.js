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
var EbayTaxonomyApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayTaxonomyApiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
const ebay_auth_service_js_1 = require("./ebay-auth.service.js");
const ebay_taxonomy_cache_service_js_1 = require("./ebay-taxonomy-cache.service.js");
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
let EbayTaxonomyApiService = class EbayTaxonomyApiService {
    static { EbayTaxonomyApiService_1 = this; }
    auth;
    config;
    taxonomyCache;
    logger = new common_1.Logger(EbayTaxonomyApiService_1.name);
    http;
    rateLimiter;
    consecutiveRateLimitExhaustions = 0;
    circuitOpenUntil = 0;
    static CIRCUIT_TRIP_THRESHOLD = 2;
    static CIRCUIT_COOLDOWN_MS = 60_000;
    static EBAY_US_TREE_ID = '0';
    static EBAY_MOTORS_TREE_ID = '100';
    static EBAY_US_MARKETPLACE = 'EBAY_US';
    constructor(auth, config, taxonomyCache) {
        this.auth = auth;
        this.config = config;
        this.taxonomyCache = taxonomyCache;
        const rps = Number(this.config.get('EBAY_TAXONOMY_RPS')) ||
            Number(this.config.get('PIPELINE_TAXONOMY_RPS')) ||
            2;
        this.rateLimiter = new TokenBucketRateLimiter(rps);
        const apiConfig = this.auth.getApiConfig();
        this.http = axios_1.default.create({
            baseURL: `${apiConfig.baseUrl}/commerce/taxonomy/v1`,
            timeout: 30_000,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });
    }
    async appHeaders() {
        const token = await this.auth.getApplicationToken();
        return { headers: { Authorization: `Bearer ${token}` } };
    }
    async withRateLimitRetry(label, fn, maxAttempts = 5) {
        const now = Date.now();
        if (now < this.circuitOpenUntil) {
            throw new Error(`eBay Taxonomy circuit open (sustained 429s) — skipping ${label} for ${this.circuitOpenUntil - now}ms`);
        }
        const delaysMs = [2000, 5000, 12_000, 30_000, 60_000];
        let lastErr;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const result = await fn();
                this.consecutiveRateLimitExhaustions = 0;
                return result;
            }
            catch (err) {
                lastErr = err;
                const response = err?.response;
                const status = response?.status;
                if (status !== 429) {
                    this.consecutiveRateLimitExhaustions = 0;
                    throw err;
                }
                if (attempt >= maxAttempts - 1)
                    break;
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
                this.logger.warn(`eBay Taxonomy ${label} rate-limited (429) — retry ${attempt + 1}/${maxAttempts - 1} in ${wait}ms`);
                await new Promise((r) => setTimeout(r, wait));
            }
        }
        this.consecutiveRateLimitExhaustions++;
        if (this.consecutiveRateLimitExhaustions >=
            EbayTaxonomyApiService_1.CIRCUIT_TRIP_THRESHOLD) {
            this.circuitOpenUntil =
                Date.now() + EbayTaxonomyApiService_1.CIRCUIT_COOLDOWN_MS;
            this.logger.warn(`eBay Taxonomy circuit opened for ${EbayTaxonomyApiService_1.CIRCUIT_COOLDOWN_MS}ms after ${this.consecutiveRateLimitExhaustions} consecutive rate-limit exhaustions`);
        }
        throw lastErr;
    }
    async getDefaultCategoryTreeId(marketplace = EbayTaxonomyApiService_1.EBAY_US_MARKETPLACE) {
        await this.rateLimiter.acquire();
        const cfg = await this.appHeaders();
        const { data } = await this.http.get(`/get_default_category_tree_id`, {
            ...cfg,
            params: { marketplace_id: marketplace },
        });
        return data.categoryTreeId;
    }
    async getCategoryTree(treeId) {
        const id = treeId ?? EbayTaxonomyApiService_1.EBAY_US_TREE_ID;
        await this.rateLimiter.acquire();
        const cfg = await this.appHeaders();
        const { data } = await this.http.get(`/category_tree/${id}`, cfg);
        return data;
    }
    async getCategorySubtree(categoryId, treeId) {
        const id = treeId ?? EbayTaxonomyApiService_1.EBAY_US_TREE_ID;
        await this.rateLimiter.acquire();
        const cfg = await this.appHeaders();
        const { data } = await this.http.get(`/category_tree/${id}/get_category_subtree`, { ...cfg, params: { category_id: categoryId } });
        return data;
    }
    async getCategorySuggestions(query, treeId) {
        const id = treeId ?? EbayTaxonomyApiService_1.EBAY_US_TREE_ID;
        const trimmed = query.trim();
        if (!trimmed)
            return [];
        const cached = this.taxonomyCache.getSuggestion(id, trimmed);
        if (cached !== undefined) {
            if (!cached?.categoryId)
                return [];
            return [
                {
                    category: {
                        categoryId: cached.categoryId,
                        categoryName: cached.categoryName,
                    },
                    categoryTreeNodeLevel: 0,
                    relevancy: 'RELEVANT',
                    categoryTreeNodeAncestors: [],
                },
            ];
        }
        if (!this.taxonomyCache.hasDailyQuota()) {
            this.logger.warn(`Taxonomy daily quota exhausted (${this.taxonomyCache.getDailyUsage()}) — skipping suggest for "${trimmed.slice(0, 40)}"`);
            return [];
        }
        await this.rateLimiter.acquire();
        const suggestions = await this.withRateLimitRetry(`getCategorySuggestions(tree=${id}, q="${trimmed.slice(0, 40)}")`, async () => {
            const cfg = await this.appHeaders();
            const { data } = await this.http.get(`/category_tree/${id}/get_category_suggestions`, { ...cfg, params: { q: trimmed } });
            return (data.categorySuggestions ?? []);
        });
        this.taxonomyCache.incrementDailyUsage();
        const best = suggestions[0];
        if (best?.category?.categoryId) {
            this.taxonomyCache.setSuggestion(id, trimmed, {
                categoryId: best.category.categoryId,
                categoryName: best.category.categoryName,
            });
        }
        else {
            this.taxonomyCache.setSuggestion(id, trimmed, null);
        }
        return suggestions;
    }
    async getItemAspectsForCategory(categoryId, treeId) {
        const id = treeId ?? EbayTaxonomyApiService_1.EBAY_US_TREE_ID;
        await this.rateLimiter.acquire();
        const cfg = await this.appHeaders();
        const { data } = await this.http.get(`/category_tree/${id}/get_item_aspects_for_category`, { ...cfg, params: { category_id: categoryId } });
        return data.aspects ?? [];
    }
    async getCompatibilityProperties(categoryTreeId, categoryId) {
        return this.withRateLimitRetry(`getCompatibilityProperties(${categoryId})`, async () => {
            await this.rateLimiter.acquire();
            const cfg = await this.appHeaders();
            const { data } = await this.http.get(`/category_tree/${categoryTreeId}/get_compatibility_properties`, { ...cfg, params: { category_id: categoryId } });
            return data.compatibilityProperties ?? [];
        });
    }
    async getCompatibilityPropertyValues(categoryTreeId, categoryId, compatibilityPropertyName, filter) {
        return this.withRateLimitRetry(`getCompatibilityPropertyValues(${categoryId}/${compatibilityPropertyName})`, async () => {
            await this.rateLimiter.acquire();
            const cfg = await this.appHeaders();
            const params = {
                category_id: categoryId,
                compatibility_property: compatibilityPropertyName,
            };
            if (filter && Object.keys(filter).length > 0) {
                params.filter = Object.entries(filter)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(',');
            }
            const { data } = await this.http.get(`/category_tree/${categoryTreeId}/get_compatibility_property_values`, { ...cfg, params });
            return data.compatibilityPropertyValues ?? [];
        });
    }
    async getVehicleValues(level, categoryId, parentSelections, treeId) {
        const id = treeId ?? EbayTaxonomyApiService_1.EBAY_US_TREE_ID;
        const values = await this.getCompatibilityPropertyValues(id, categoryId, level, parentSelections);
        return values.map((v) => v.value).sort();
    }
};
exports.EbayTaxonomyApiService = EbayTaxonomyApiService;
exports.EbayTaxonomyApiService = EbayTaxonomyApiService = EbayTaxonomyApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ebay_auth_service_js_1.EbayAuthService,
        config_1.ConfigService,
        ebay_taxonomy_cache_service_js_1.EbayTaxonomyCacheService])
], EbayTaxonomyApiService);
//# sourceMappingURL=ebay-taxonomy-api.service.js.map