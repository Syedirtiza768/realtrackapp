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
var PartsBazar360Client_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartsBazar360Client = exports.PartsBazarApiError = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
class PartsBazarApiError extends Error {
    status;
    retryable;
    constructor(message, status, retryable) {
        super(message);
        this.status = status;
        this.retryable = retryable;
        this.name = 'PartsBazarApiError';
    }
}
exports.PartsBazarApiError = PartsBazarApiError;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const DEFAULT_API_URL = 'https://partsbazar360.com/api';
let PartsBazar360Client = PartsBazar360Client_1 = class PartsBazar360Client {
    config;
    logger = new common_1.Logger(PartsBazar360Client_1.name);
    constructor(config) {
        this.config = config;
    }
    get baseUrl() {
        return this.config
            .get('PARTSBAZAR360_API_URL', DEFAULT_API_URL)
            .trim()
            .replace(/\/+$/, '');
    }
    get apiKey() {
        return this.config.get('PARTSBAZAR360_API_KEY')?.trim() || null;
    }
    isConfigured() {
        return this.apiKey !== null;
    }
    health(storeId) {
        const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
        return this.request('GET', `/health${query}`);
    }
    async push(storeId, items) {
        const response = await this.request('POST', '', { storeId, listings: items });
        return response.results;
    }
    async end(storeId, sourceListingIds) {
        const response = await this.request('POST', '/end', { storeId, sourceListingIds });
        return response.results;
    }
    status(storeId, sourceListingId) {
        return this.request('GET', `/${encodeURIComponent(storeId)}/${encodeURIComponent(sourceListingId)}`);
    }
    async request(method, path, body) {
        const apiKey = this.apiKey;
        if (!apiKey) {
            throw new PartsBazarApiError('PARTSBAZAR360_API_KEY is not configured', null, false);
        }
        const url = `${this.baseUrl}/integrations/realtrack/listings${path}`;
        const maxAttempts = this.number('PARTSBAZAR360_MAX_ATTEMPTS', 3);
        const timeoutMs = this.number('PARTSBAZAR360_TIMEOUT_MS', 30_000);
        const baseDelay = this.number('PARTSBAZAR360_RETRY_BASE_MS', 1_000);
        let lastError = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch(url, {
                    method,
                    headers: {
                        authorization: `Bearer ${apiKey}`,
                        accept: 'application/json',
                        ...(body !== undefined
                            ? { 'content-type': 'application/json' }
                            : {}),
                    },
                    body: body !== undefined ? JSON.stringify(body) : undefined,
                    signal: AbortSignal.timeout(timeoutMs),
                });
                if (response.ok)
                    return (await response.json());
                const detail = await this.errorDetail(response);
                lastError = new PartsBazarApiError(`PartsBazar360 responded ${response.status}: ${detail}`, response.status, RETRYABLE_STATUSES.has(response.status));
                if (!lastError.retryable || attempt === maxAttempts)
                    throw lastError;
                await this.sleep(this.retryDelay(response, attempt, baseDelay));
            }
            catch (error) {
                if (error instanceof PartsBazarApiError) {
                    if (!error.retryable || attempt === maxAttempts)
                        throw error;
                    lastError = error;
                    continue;
                }
                lastError = new PartsBazarApiError(`PartsBazar360 request failed: ${error instanceof Error ? error.message : String(error)}`, null, true);
                if (attempt === maxAttempts)
                    throw lastError;
                this.logger.warn(`${method} ${path || '/'} attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);
                await this.sleep(baseDelay * 2 ** (attempt - 1));
            }
        }
        throw lastError ?? new PartsBazarApiError('Request failed', null, false);
    }
    retryDelay(response, attempt, baseDelay) {
        const retryAfter = Number(response.headers.get('retry-after'));
        if (Number.isFinite(retryAfter) && retryAfter >= 0) {
            return Math.min(retryAfter * 1_000, 30_000);
        }
        return Math.min(baseDelay * 2 ** (attempt - 1), 30_000);
    }
    async errorDetail(response) {
        try {
            const data = (await response.json());
            const message = Array.isArray(data.message)
                ? data.message.join('; ')
                : data.message;
            return (message ?? response.statusText).slice(0, 500);
        }
        catch {
            return response.statusText || 'no detail';
        }
    }
    number(name, fallback) {
        const value = Number(this.config.get(name));
        return Number.isFinite(value) && value >= 0 ? value : fallback;
    }
    sleep(ms) {
        return ms > 0
            ? new Promise((resolve) => setTimeout(resolve, ms))
            : Promise.resolve();
    }
};
exports.PartsBazar360Client = PartsBazar360Client;
exports.PartsBazar360Client = PartsBazar360Client = PartsBazar360Client_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PartsBazar360Client);
//# sourceMappingURL=partsbazar360.client.js.map