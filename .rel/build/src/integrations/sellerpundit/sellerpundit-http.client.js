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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerpunditHttpClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
let SellerpunditHttpClient = class SellerpunditHttpClient {
    config;
    constructor(config) {
        this.config = config;
    }
    authBaseUrl() {
        const raw = this.config.get('SELLERPUNDIT_API_BASE_URL', 'https://authentication.sellerpundit.com/api/v1');
        return raw.replace(/\/$/, '');
    }
    marketplacesBaseUrl() {
        return (this.config.get('SELLERPUNDIT_MARKETPLACES_URL', 'https://marketplaces.sellerpundit.com') ?? 'https://marketplaces.sellerpundit.com').replace(/\/$/, '');
    }
    async login(email, password) {
        try {
            const { data } = await axios_1.default.post(`${this.authBaseUrl()}/auth/login`, { email, password }, { headers: { 'Content-Type': 'application/json' }, timeout: 30_000 });
            const token = data.token ??
                data.accessToken ??
                data.data?.token;
            if (!token || typeof token !== 'string') {
                throw this.toError(502, 'SellerPundit login did not return a JWT token');
            }
            return token;
        }
        catch (e) {
            if (e instanceof common_1.HttpException)
                throw e;
            throw this.fromAxios(e);
        }
    }
    async get(jwt, path, query) {
        const url = new URL(`${this.marketplacesBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`);
        if (query) {
            for (const [k, v] of Object.entries(query)) {
                url.searchParams.set(k, v);
            }
        }
        try {
            const { data } = await axios_1.default.get(url.toString(), {
                headers: { Authorization: `Bearer ${jwt}` },
                timeout: 60_000,
            });
            return data;
        }
        catch (e) {
            throw this.fromAxios(e);
        }
    }
    async post(jwt, path, body) {
        return this.requestWithGatewayRetry(() => axios_1.default.post(`${this.marketplacesBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, body, {
            headers: {
                Authorization: `Bearer ${jwt}`,
                'Content-Type': 'application/json',
            },
            timeout: 180_000,
        }));
    }
    async requestWithGatewayRetry(fn, attempts = 2) {
        let lastErr;
        for (let i = 0; i < attempts; i++) {
            try {
                const { data } = await fn();
                return data;
            }
            catch (e) {
                lastErr = e;
                if (!axios_1.default.isAxiosError(e) ||
                    e.response?.status !== 504 ||
                    i === attempts - 1) {
                    throw this.fromAxios(e);
                }
            }
        }
        throw this.fromAxios(lastErr);
    }
    fromAxios(err) {
        if (axios_1.default.isAxiosError(err)) {
            throw this.fromAxiosError(err);
        }
        const msg = err instanceof Error ? err.message : String(err);
        throw new common_1.HttpException({ message: msg, errors: [msg] }, 502);
    }
    fromAxiosError(err) {
        let status = err.response?.status ?? 502;
        if (status === 401 || status === 403) {
            status = 502;
        }
        const body = err.response?.data;
        const errors = [];
        let message = err.message;
        if (body && typeof body === 'object') {
            const b = body;
            if (typeof b.message === 'string')
                message = b.message;
            if (typeof b.error === 'string')
                errors.push(b.error);
            if (Array.isArray(b.errors)) {
                for (const item of b.errors) {
                    if (typeof item === 'string')
                        errors.push(item);
                    else if (item && typeof item === 'object' && 'message' in item) {
                        errors.push(String(item.message));
                    }
                }
            }
            const data = b.data;
            if (data &&
                typeof data === 'object' &&
                Array.isArray(data.errors)) {
                for (const item of data.errors) {
                    if (typeof item === 'string')
                        errors.push(item);
                }
            }
        }
        if (!errors.length)
            errors.push(message);
        if (status === 504) {
            message =
                'SellerPundit API gateway timed out (504). The listing may still be processing — check eBay, retry in a minute, or use direct eBay publish fallback.';
            errors.unshift(message);
        }
        const details = body != null && typeof body === 'object' && !Array.isArray(body)
            ? body
            : undefined;
        throw new common_1.HttpException({ message, errors, details }, status);
    }
    toError(httpStatus, message) {
        return new common_1.HttpException({ message, errors: [message] }, httpStatus);
    }
};
exports.SellerpunditHttpClient = SellerpunditHttpClient;
exports.SellerpunditHttpClient = SellerpunditHttpClient = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SellerpunditHttpClient);
//# sourceMappingURL=sellerpundit-http.client.js.map