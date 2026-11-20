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
var EbayAccountTokenService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayAccountTokenService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const common_2 = require("@nestjs/common");
const typeorm_2 = require("typeorm");
const axios_1 = __importDefault(require("axios"));
const token_encryption_service_js_1 = require("../../../channels/token-encryption.service.js");
const channel_connection_entity_js_1 = require("../../../channels/entities/channel-connection.entity.js");
const connected_ebay_account_entity_js_1 = require("../entities/connected-ebay-account.entity.js");
const ebay_oauth_token_entity_js_1 = require("../entities/ebay-oauth-token.entity.js");
const ebay_integrations_redis_connection_js_1 = require("../ebay-integrations-redis.connection.js");
const sellerpundit_token_sync_service_js_1 = require("../../sellerpundit/sellerpundit-token-sync.service.js");
let EbayAccountTokenService = EbayAccountTokenService_1 = class EbayAccountTokenService {
    config;
    encryption;
    redis;
    tokenRepo;
    accountRepo;
    connectionRepo;
    sellerpunditTokens;
    logger = new common_1.Logger(EbayAccountTokenService_1.name);
    refreshBufferMs = 30 * 60 * 1000;
    constructor(config, encryption, redis, tokenRepo, accountRepo, connectionRepo, sellerpunditTokens) {
        this.config = config;
        this.encryption = encryption;
        this.redis = redis;
        this.tokenRepo = tokenRepo;
        this.accountRepo = accountRepo;
        this.connectionRepo = connectionRepo;
        this.sellerpunditTokens = sellerpunditTokens;
    }
    getOAuthBase(environment) {
        return environment === 'production'
            ? 'https://api.ebay.com'
            : 'https://api.sandbox.ebay.com';
    }
    getAuthHost(environment) {
        return environment === 'production'
            ? 'https://auth.ebay.com'
            : 'https://auth.sandbox.ebay.com';
    }
    getRedirectUri() {
        return this.config.get('EBAY_REDIRECT_URI', '').trim();
    }
    basicAuthHeader() {
        const id = this.config.get('EBAY_CLIENT_ID', '');
        const secret = this.config.get('EBAY_CLIENT_SECRET', '');
        return Buffer.from(`${id}:${secret}`).toString('base64');
    }
    async getValidAccessToken(ebayAccountId) {
        const account = await this.accountRepo.findOne({
            where: { id: ebayAccountId },
        });
        if (!account) {
            throw new common_1.UnauthorizedException('eBay account not found');
        }
        const oauthToken = await this.tokenRepo.findOne({
            where: { ebayAccountId },
        });
        if (!oauthToken) {
            throw new common_1.UnauthorizedException('eBay token record not found');
        }
        if (account.connectionStatus === 'disabled') {
            throw new common_1.UnauthorizedException('eBay account is disabled');
        }
        if (account.connectionStatus === 'reconnect_required' ||
            oauthToken.reconnectRequired) {
            throw new common_1.UnauthorizedException('eBay reconnect required');
        }
        if (account.connectionSource === 'sellerpundit') {
            return this.sellerpunditTokens.ensureFreshAccessToken(ebayAccountId);
        }
        const row = oauthToken;
        const now = Date.now();
        const expires = new Date(row.accessTokenExpiresAt).getTime();
        if (expires - now > this.refreshBufferMs) {
            return this.encryption.decrypt(row.accessTokenEncrypted);
        }
        const lockKey = `ebay-token-refresh:${ebayAccountId}`;
        const gotLock = await this.redis.set(lockKey, '1', 'EX', 45, 'NX');
        if (!gotLock) {
            for (let i = 0; i < 30; i++) {
                await new Promise((r) => setTimeout(r, 500));
                const refreshed = await this.tokenRepo.findOne({
                    where: { ebayAccountId },
                });
                if (refreshed &&
                    new Date(refreshed.accessTokenExpiresAt).getTime() - Date.now() >
                        this.refreshBufferMs) {
                    return this.encryption.decrypt(refreshed.accessTokenEncrypted);
                }
            }
            throw new common_1.ServiceUnavailableException('Timed out waiting for token refresh lock');
        }
        try {
            return await this.refreshLocked(account.id, account.environment);
        }
        finally {
            await this.redis.del(lockKey);
        }
    }
    async refreshLocked(ebayAccountId, environment) {
        const row = await this.tokenRepo.findOneOrFail({
            where: { ebayAccountId },
        });
        const refreshToken = this.encryption.decrypt(row.refreshTokenEncrypted);
        if (!refreshToken) {
            row.reconnectRequired = true;
            await this.tokenRepo.save(row);
            throw new common_1.UnauthorizedException('Missing refresh token');
        }
        const oauthBase = this.getOAuthBase(environment);
        try {
            const { data } = await axios_1.default.post(`${oauthBase}/identity/v1/oauth2/token`, new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                scope: this.getDefaultScopes().join(' '),
            }).toString(), {
                headers: {
                    Authorization: `Basic ${this.basicAuthHeader()}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 30_000,
            });
            const updated = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token ?? refreshToken,
                expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
                scope: data.scope,
                tokenType: data.token_type,
            };
            row.accessTokenEncrypted = this.encryption.encrypt(updated.accessToken);
            row.accessTokenExpiresAt = new Date(updated.expiresAt);
            row.refreshTokenEncrypted = this.encryption.encrypt(updated.refreshToken);
            row.lastRefreshedAt = new Date();
            row.reconnectRequired = false;
            await this.tokenRepo.save(row);
            const account = await this.accountRepo.findOneByOrFail({
                id: ebayAccountId,
            });
            const conn = await this.connectionRepo.findOneByOrFail({
                id: account.channelConnectionId,
            });
            conn.encryptedTokens = this.encryption.encrypt(JSON.stringify(updated));
            conn.tokenExpiresAt = new Date(updated.expiresAt);
            conn.status = 'active';
            conn.lastError = null;
            await this.connectionRepo.save(conn);
            await this.accountRepo.update(ebayAccountId, {
                lastTokenRefreshAt: new Date(),
                connectionStatus: 'active',
            });
            return updated.accessToken;
        }
        catch (e) {
            this.logger.warn(`Token refresh failed for account ${ebayAccountId}`, e);
            row.reconnectRequired = true;
            await this.tokenRepo.save(row);
            await this.accountRepo.update(ebayAccountId, {
                connectionStatus: 'reconnect_required',
            });
            throw new common_1.UnauthorizedException('eBay token refresh failed — reconnect required');
        }
    }
    getDefaultScopes() {
        const raw = this.config.get('EBAY_SCOPES', '').trim();
        if (raw) {
            return raw.split(/[\s,]+/).filter(Boolean);
        }
        return [
            'https://api.ebay.com/oauth/api_scope',
            'https://api.ebay.com/oauth/api_scope/sell.inventory',
            'https://api.ebay.com/oauth/api_scope/sell.account',
            'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
            'https://api.ebay.com/oauth/api_scope/sell.marketing',
            'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
        ];
    }
    buildAuthorizeUrl(params) {
        const clientId = this.config.get('EBAY_CLIENT_ID', '');
        const redirectUri = this.getRedirectUri();
        const scopes = this.getDefaultScopes()
            .map((s) => encodeURIComponent(s))
            .join('%20');
        const host = this.getAuthHost(params.environment);
        return (`${host}/oauth2/authorize?` +
            `client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&response_type=code` +
            `&scope=${scopes}` +
            `&state=${encodeURIComponent(params.state)}`);
    }
    async exchangeCode(params) {
        const oauthBase = this.getOAuthBase(params.environment);
        const { data } = await axios_1.default.post(`${oauthBase}/identity/v1/oauth2/token`, new URLSearchParams({
            grant_type: 'authorization_code',
            code: params.code,
            redirect_uri: this.getRedirectUri(),
        }).toString(), {
            headers: {
                Authorization: `Basic ${this.basicAuthHeader()}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 30_000,
        });
        const tokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
            scope: data.scope,
            tokenType: data.token_type,
        };
        return { tokens };
    }
};
exports.EbayAccountTokenService = EbayAccountTokenService;
exports.EbayAccountTokenService = EbayAccountTokenService = EbayAccountTokenService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_2.Inject)(ebay_integrations_redis_connection_js_1.EBAY_INTEGRATIONS_REDIS)),
    __param(3, (0, typeorm_1.InjectRepository)(ebay_oauth_token_entity_js_1.EbayOAuthToken)),
    __param(4, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(5, (0, typeorm_1.InjectRepository)(channel_connection_entity_js_1.ChannelConnection)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        token_encryption_service_js_1.TokenEncryptionService, Function, typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        sellerpundit_token_sync_service_js_1.SellerpunditTokenSyncService])
], EbayAccountTokenService);
//# sourceMappingURL=ebay-account-token.service.js.map