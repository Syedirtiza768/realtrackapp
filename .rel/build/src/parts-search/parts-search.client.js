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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartsSearchClient = exports.PartsSearchUpstreamError = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
class PartsSearchUpstreamError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'PartsSearchUpstreamError';
    }
}
exports.PartsSearchUpstreamError = PartsSearchUpstreamError;
const DEFAULT_API_URL = 'https://partsbazar360.com/api';
const RETRYABLE_STATUSES = new Set([502, 503, 504]);
let PartsSearchClient = class PartsSearchClient {
    config;
    constructor(config) {
        this.config = config;
    }
    get baseUrl() {
        return this.config
            .get('PARTSBAZAR360_API_URL', DEFAULT_API_URL)
            .trim()
            .replace(/\/+$/, '');
    }
    get internalKey() {
        return this.config.get('PARTSBAZAR360_SEARCH_API_KEY')?.trim() || null;
    }
    get timeoutMs() {
        const value = Number(this.config.get('PARTS_SEARCH_TIMEOUT_MS', '8000'));
        return Number.isFinite(value) && value > 0 ? value : 8000;
    }
    async get(path, params = [], options = {}) {
        const query = new URLSearchParams(params).toString();
        const url = `${this.baseUrl}${path}${query ? `?${query}` : ''}`;
        const headers = { Accept: 'application/json' };
        if (options.internal) {
            const key = this.internalKey;
            if (!key) {
                throw new PartsSearchUpstreamError('PARTSBAZAR360_SEARCH_API_KEY is not configured', null);
            }
            headers.Authorization = `Bearer ${key}`;
        }
        const attempts = Math.max(1, options.attempts ?? 1);
        let lastError = null;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                const response = await fetch(url, {
                    headers,
                    signal: AbortSignal.timeout(this.timeoutMs),
                });
                if (response.ok)
                    return (await response.json());
                lastError = new PartsSearchUpstreamError(await this.errorMessage(response), response.status);
                if (!RETRYABLE_STATUSES.has(response.status))
                    throw lastError;
            }
            catch (error) {
                if (error instanceof PartsSearchUpstreamError && error.status !== null && !RETRYABLE_STATUSES.has(error.status)) {
                    throw error;
                }
                lastError =
                    error instanceof PartsSearchUpstreamError
                        ? error
                        : new PartsSearchUpstreamError(error?.name === 'TimeoutError'
                            ? `PartsBazar360 did not answer within ${this.timeoutMs} ms`
                            : `PartsBazar360 is unreachable: ${error?.message ?? error}`, null);
            }
        }
        throw lastError ?? new PartsSearchUpstreamError('PartsBazar360 request failed', null);
    }
    async errorMessage(response) {
        try {
            const body = (await response.json());
            const message = Array.isArray(body?.message)
                ? body.message.join('; ')
                : typeof body?.message === 'string'
                    ? body.message
                    : null;
            if (message)
                return message.slice(0, 300);
        }
        catch {
        }
        return `PartsBazar360 returned HTTP ${response.status}`;
    }
};
exports.PartsSearchClient = PartsSearchClient;
exports.PartsSearchClient = PartsSearchClient = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PartsSearchClient);
//# sourceMappingURL=parts-search.client.js.map