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
var PartsSearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartsSearchService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_redis_constants_js_1 = require("../common/redis/app-redis.constants.js");
const parts_search_query_dto_js_1 = require("./dto/parts-search-query.dto.js");
const parts_search_client_js_1 = require("./parts-search.client.js");
const PUBLIC_SEARCH_PATH = '/v1/search';
const INTERNAL_SEARCH_PATH = '/integrations/realtrack/search';
const SUGGEST_PATH = '/search/suggest';
const PUBLIC_PART_PATH = '/search/parts';
const INTERNAL_FALLBACK_STATUSES = new Set([401, 403, 404, 503]);
const EMPTY_SUGGEST = {
    parts: [],
    categories: [],
    categoryGroups: [],
    brands: [],
    makes: [],
};
let PartsSearchService = PartsSearchService_1 = class PartsSearchService {
    client;
    config;
    redis;
    logger = new common_1.Logger(PartsSearchService_1.name);
    constructor(client, config, redis) {
        this.client = client;
        this.config = config;
        this.redis = redis;
    }
    get audience() {
        return this.client.internalKey ? 'internal' : 'public';
    }
    get cacheTtlSeconds() {
        const value = Number(this.config.get('PARTS_SEARCH_CACHE_TTL_SECONDS', '30'));
        return Number.isFinite(value) && value >= 0 ? value : 30;
    }
    async search(dto, userId) {
        const audience = this.audience;
        const cacheKey = this.cacheKey('query', audience, (0, parts_search_query_dto_js_1.toUpstreamParams)(dto, audience));
        const cached = await this.cacheGet(cacheKey);
        if (cached) {
            this.logQuery(dto, cached, userId, true);
            return { ...cached, meta: { ...cached.meta, cached: true } };
        }
        let response;
        if (audience === 'internal') {
            try {
                response = await this.client.get(INTERNAL_SEARCH_PATH, (0, parts_search_query_dto_js_1.toUpstreamParams)(dto, 'internal'), { internal: true, attempts: 2 });
                response.meta = { ...response.meta, audience: 'internal' };
            }
            catch (error) {
                if (!this.isInternalFallback(error))
                    throw this.toHttpError(error);
                const reason = error.message;
                this.logger.warn(`Internal parts search unavailable, using public search: ${reason}`);
                response = await this.publicSearch(dto);
                response.meta = { ...response.meta, internalUnavailableReason: reason };
            }
        }
        else {
            response = await this.publicSearch(dto);
        }
        if (!response.meta?.degraded)
            await this.cacheSet(cacheKey, response, this.cacheTtlSeconds);
        this.logQuery(dto, response, userId, false);
        return response;
    }
    async publicSearch(dto) {
        try {
            const response = await this.client.get(PUBLIC_SEARCH_PATH, (0, parts_search_query_dto_js_1.toUpstreamParams)(dto, 'public'), { attempts: 2 });
            return { ...response, meta: { ...response.meta, audience: 'public' } };
        }
        catch (error) {
            throw this.toHttpError(error);
        }
    }
    async suggest(q) {
        const query = (q ?? '').trim();
        if (query.length < 2)
            return EMPTY_SUGGEST;
        const cacheKey = this.cacheKey('suggest', 'public', [['q', query.toLowerCase()]]);
        const cached = await this.cacheGet(cacheKey);
        if (cached)
            return cached;
        try {
            const raw = await this.client.get(SUGGEST_PATH, [['q', query]]);
            const response = {
                parts: (raw.parts ?? []).slice(0, 8),
                categories: (raw.categories ?? []).slice(0, 6),
                categoryGroups: (raw.categoryGroups ?? []).slice(0, 6),
                brands: (raw.brands ?? []).slice(0, 6),
                makes: (raw.makes ?? []).slice(0, 6),
            };
            await this.cacheSet(cacheKey, response, this.cacheTtlSeconds);
            return response;
        }
        catch (error) {
            this.logger.debug(`suggest failed: ${error?.message}`);
            return EMPTY_SUGGEST;
        }
    }
    async part(id) {
        const audience = this.audience;
        const cacheKey = this.cacheKey('part', audience, [['id', id]]);
        const cached = await this.cacheGet(cacheKey);
        if (cached)
            return cached;
        const path = `/${encodeURIComponent(id)}`;
        let part;
        if (audience === 'internal') {
            try {
                part = await this.client.get(`${INTERNAL_SEARCH_PATH}/parts${path}`, [], {
                    internal: true,
                    attempts: 2,
                });
                part = { ...part, audience: 'internal' };
            }
            catch (error) {
                if (!this.isInternalFallback(error))
                    throw this.toHttpError(error);
                const reason = error.message;
                part = { ...(await this.publicPart(path)), internalUnavailableReason: reason };
            }
        }
        else {
            part = await this.publicPart(path);
        }
        await this.cacheSet(cacheKey, part, Math.max(this.cacheTtlSeconds, 120));
        return part;
    }
    async publicPart(path) {
        try {
            const part = await this.client.get(`${PUBLIC_PART_PATH}${path}`, [], { attempts: 2 });
            return { ...part, audience: 'public' };
        }
        catch (error) {
            throw this.toHttpError(error);
        }
    }
    async status() {
        const internalConfigured = Boolean(this.client.internalKey);
        const status = {
            apiUrl: this.client.baseUrl,
            internalConfigured,
            audience: this.audience,
            upstream: { ok: false },
            internal: null,
        };
        try {
            const probe = await this.client.get(PUBLIC_SEARCH_PATH, [
                ['pageSize', '24'],
            ]);
            status.upstream = {
                ok: !probe.meta?.degraded,
                index: probe.meta?.index,
                degraded: probe.meta?.degraded,
            };
        }
        catch (error) {
            status.upstream = { ok: false, message: error.message };
        }
        if (internalConfigured) {
            try {
                await this.client.get(`${INTERNAL_SEARCH_PATH}/health`, [], { internal: true });
                status.internal = { ok: true };
            }
            catch (error) {
                status.internal = { ok: false, message: error.message };
            }
        }
        return status;
    }
    isInternalFallback(error) {
        return (error instanceof parts_search_client_js_1.PartsSearchUpstreamError &&
            error.status !== null &&
            INTERNAL_FALLBACK_STATUSES.has(error.status));
    }
    toHttpError(error) {
        if (error instanceof parts_search_client_js_1.PartsSearchUpstreamError) {
            if (error.status === 400)
                return new common_1.BadRequestException(error.message);
            if (error.status === 404)
                return new common_1.NotFoundException(error.message || 'Part not found on PartsBazar360');
            this.logger.warn(`PartsBazar360 search failed: ${error.message}`);
            return new common_1.ServiceUnavailableException({
                message: 'PartsBazar360 search is unavailable. Please retry.',
                degraded: true,
            });
        }
        return error;
    }
    cacheKey(kind, audience, params) {
        const normalized = [...params]
            .map(([key, value]) => `${key}=${value}`)
            .sort()
            .join('&');
        const digest = (0, node_crypto_1.createHash)('sha1').update(normalized).digest('hex');
        return `parts-search:v1:${kind}:${audience}:${digest}`;
    }
    async cacheGet(key) {
        if (this.cacheTtlSeconds === 0)
            return null;
        try {
            const raw = await this.redis.get(key);
            return raw ? JSON.parse(raw) : null;
        }
        catch {
            return null;
        }
    }
    async cacheSet(key, value, ttlSeconds) {
        if (ttlSeconds <= 0)
            return;
        try {
            await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        }
        catch {
        }
    }
    logQuery(dto, response, userId, cached) {
        this.logger.log(JSON.stringify({
            event: 'parts_search.query',
            userId: userId ?? null,
            q: dto.q ?? '',
            filters: Object.keys(dto).filter((key) => key !== 'q' && dto[key] !== undefined),
            total: response.pagination?.totalResults ?? 0,
            audience: response.meta?.audience,
            tookMs: response.meta?.tookMs,
            degraded: response.meta?.degraded ?? false,
            cached,
        }));
    }
};
exports.PartsSearchService = PartsSearchService;
exports.PartsSearchService = PartsSearchService = PartsSearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(app_redis_constants_js_1.APP_REDIS)),
    __metadata("design:paramtypes", [parts_search_client_js_1.PartsSearchClient,
        config_1.ConfigService, Function])
], PartsSearchService);
//# sourceMappingURL=parts-search.service.js.map