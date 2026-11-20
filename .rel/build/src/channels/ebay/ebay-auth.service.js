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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EbayAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayAuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const axios_1 = __importStar(require("axios"));
const store_entity_js_1 = require("../entities/store.entity.js");
const channel_connection_entity_js_1 = require("../entities/channel-connection.entity.js");
const token_encryption_service_js_1 = require("../token-encryption.service.js");
const connected_ebay_account_entity_js_1 = require("../../integrations/ebay/entities/connected-ebay-account.entity.js");
const sellerpundit_token_sync_service_js_1 = require("../../integrations/sellerpundit/sellerpundit-token-sync.service.js");
let EbayAuthService = EbayAuthService_1 = class EbayAuthService {
    configService;
    encryption;
    sellerpunditTokens;
    connectionRepo;
    storeRepo;
    connectedAccountRepo;
    logger = new common_1.Logger(EbayAuthService_1.name);
    config;
    http;
    refreshBufferMs = 30 * 60 * 1000;
    constructor(configService, encryption, sellerpunditTokens, connectionRepo, storeRepo, connectedAccountRepo) {
        this.configService = configService;
        this.encryption = encryption;
        this.sellerpunditTokens = sellerpunditTokens;
        this.connectionRepo = connectionRepo;
        this.storeRepo = storeRepo;
        this.connectedAccountRepo = connectedAccountRepo;
        const environment = this.configService
            .get('EBAY_ENVIRONMENT', '')
            .trim()
            .toUpperCase();
        const sandboxOverride = this.configService.get('EBAY_SANDBOX');
        const sandbox = sandboxOverride != null
            ? sandboxOverride.toLowerCase() === 'true'
            : environment !== 'PRODUCTION';
        this.config = {
            clientId: this.configService.get('EBAY_CLIENT_ID', ''),
            clientSecret: this.configService.get('EBAY_CLIENT_SECRET', ''),
            redirectUri: this.configService.get('EBAY_REDIRECT_URI', ''),
            sandbox,
            baseUrl: sandbox
                ? 'https://api.sandbox.ebay.com'
                : 'https://api.ebay.com',
            authUrl: sandbox
                ? 'https://auth.sandbox.ebay.com'
                : 'https://auth.ebay.com',
        };
        this.http = axios_1.default.create({
            baseURL: this.config.baseUrl,
            timeout: 30_000,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    getApiConfig() {
        return { ...this.config };
    }
    getBasicAuth() {
        return Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    }
    async findLinkedAccount(storeId, connectionId) {
        const byStore = await this.connectedAccountRepo.findOne({
            where: { primaryStoreId: storeId },
        });
        if (byStore)
            return byStore;
        if (connectionId) {
            return this.connectedAccountRepo.findOne({
                where: { channelConnectionId: connectionId },
            });
        }
        return null;
    }
    async getApiBaseUrlForStore(storeId) {
        const store = await this.storeRepo.findOneBy({ id: storeId });
        if (!store) {
            return this.config.baseUrl;
        }
        const linked = await this.findLinkedAccount(store.id, store.connectionId);
        if (linked?.environment === 'production') {
            return 'https://api.ebay.com';
        }
        if (linked?.environment === 'sandbox') {
            return 'https://api.sandbox.ebay.com';
        }
        const storeConfig = store.config ?? {};
        if (storeConfig.sellerpundit === true) {
            const spEnv = this.configService
                .get('SELLERPUNDIT_ENVIRONMENT', 'production')
                .trim()
                .toLowerCase();
            return spEnv === 'sandbox'
                ? 'https://api.sandbox.ebay.com'
                : 'https://api.ebay.com';
        }
        return this.config.baseUrl;
    }
    async getAccessToken(storeId, options) {
        const store = await this.storeRepo.findOne({
            where: { id: storeId },
            relations: ['connection'],
        });
        if (!store) {
            throw new Error(`Store ${storeId} not found`);
        }
        const connection = store.connection ??
            (await this.connectionRepo.findOneByOrFail({ id: store.connectionId }));
        const linked = await this.findLinkedAccount(store.id, store.connectionId);
        if (linked?.connectionSource === 'sellerpundit') {
            try {
                return await this.sellerpunditTokens.ensureFreshAccessToken(linked.id, {
                    force: options?.forceRefresh === true,
                });
            }
            catch (err) {
                throw this.wrapTokenError(store.storeName, err, 'SellerPundit token refresh failed — re-sync stores in Settings → eBay Integrations');
            }
        }
        const tokens = JSON.parse(this.encryption.decrypt(connection.encryptedTokens));
        const expiresAt = new Date(tokens.expiresAt);
        const now = new Date();
        if (expiresAt.getTime() - now.getTime() < this.refreshBufferMs) {
            if (tokens.refreshToken) {
                this.logger.log(`Proactively refreshing token for store ${storeId} (expires ${expiresAt.toISOString()})`);
                try {
                    return await this.refreshAndStore(connection, tokens.refreshToken);
                }
                catch (err) {
                    throw this.wrapTokenError(store.storeName, err, 'eBay authorization expired — reconnect this store in Settings → eBay Integrations');
                }
            }
            this.logger.warn(`Token for store ${storeId} is expiring but no refresh token available`);
            throw new common_1.UnauthorizedException(`eBay authorization expired for "${store.storeName}". Reconnect this store in Settings → eBay Integrations.`);
        }
        return tokens.accessToken;
    }
    wrapTokenError(storeName, err, hint) {
        if ((0, axios_1.isAxiosError)(err) && err.response?.status === 401) {
            return new common_1.UnauthorizedException(`eBay rejected the access token for "${storeName}". ${hint}`);
        }
        if (err instanceof common_1.UnauthorizedException) {
            return err;
        }
        const message = err instanceof Error ? err.message : String(err);
        return new common_1.UnauthorizedException(`${hint} (${message})`);
    }
    async getApplicationToken() {
        const { data } = await this.http.post('/identity/v1/oauth2/token', new URLSearchParams({
            grant_type: 'client_credentials',
            scope: 'https://api.ebay.com/oauth/api_scope',
        }).toString(), {
            headers: {
                Authorization: `Basic ${this.getBasicAuth()}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        return data.access_token;
    }
    initiateOAuth(state) {
        const scopes = [
            'https://api.ebay.com/oauth/api_scope',
            'https://api.ebay.com/oauth/api_scope/sell.inventory',
            'https://api.ebay.com/oauth/api_scope/sell.account',
            'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
            'https://api.ebay.com/oauth/api_scope/sell.marketing',
            'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
            'https://api.ebay.com/oauth/api_scope/buy.browse',
        ].join('%20');
        const authUrl = `${this.config.authUrl}/oauth2/authorize?` +
            `client_id=${this.config.clientId}` +
            `&redirect_uri=${encodeURIComponent(this.config.redirectUri)}` +
            `&response_type=code` +
            `&scope=${scopes}` +
            `&state=${state}`;
        return { authUrl, state };
    }
    async handleOAuthCallback(code, state, userId) {
        const { data } = await this.http.post('/identity/v1/oauth2/token', new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: this.config.redirectUri,
        }).toString(), {
            headers: {
                Authorization: `Basic ${this.getBasicAuth()}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        const tokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
            scope: data.scope,
            tokenType: data.token_type,
        };
        let ebayUserId = 'unknown';
        try {
            const identity = await this.http.get('/commerce/identity/v1/user/', {
                headers: { Authorization: `Bearer ${tokens.accessToken}` },
            });
            ebayUserId = identity.data.username ?? identity.data.userId ?? 'unknown';
        }
        catch (err) {
            this.logger.warn('Could not fetch eBay identity after OAuth', err);
        }
        const connection = this.connectionRepo.create({
            channel: 'ebay',
            userId,
            accountName: `eBay — ${ebayUserId}`,
            externalAccountId: ebayUserId,
            encryptedTokens: this.encryption.encrypt(JSON.stringify(tokens)),
            tokenExpiresAt: tokens.expiresAt,
            scope: tokens.scope ?? null,
            status: 'active',
        });
        const savedConn = await this.connectionRepo.save(connection);
        const store = this.storeRepo.create({
            connectionId: savedConn.id,
            channel: 'ebay',
            storeName: `eBay Store — ${ebayUserId}`,
            externalStoreId: ebayUserId,
            status: 'active',
            isPrimary: false,
            config: {
                marketplace: 'EBAY_US',
                sandbox: this.config.sandbox,
                ebayUserId,
            },
        });
        const savedStore = await this.storeRepo.save(store);
        this.logger.log(`Connected eBay account "${ebayUserId}" → connection=${savedConn.id}, store=${savedStore.id}`);
        return { connectionId: savedConn.id, storeId: savedStore.id };
    }
    async refreshToken(storeId) {
        const store = await this.storeRepo.findOneByOrFail({ id: storeId });
        const connection = await this.connectionRepo.findOneByOrFail({
            id: store.connectionId,
        });
        const tokens = JSON.parse(this.encryption.decrypt(connection.encryptedTokens));
        if (!tokens.refreshToken) {
            throw new Error(`No refresh token available for store ${storeId}`);
        }
        await this.refreshAndStore(connection, tokens.refreshToken);
    }
    async refreshAndStore(connection, refreshToken) {
        if (!this.config.clientId || !this.config.clientSecret) {
            connection.status = 'error';
            connection.lastError =
                'EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not configured';
            await this.connectionRepo.save(connection);
            throw new common_1.UnauthorizedException('eBay API credentials are not configured on the server (EBAY_CLIENT_ID / EBAY_CLIENT_SECRET).');
        }
        try {
            const { data } = await this.http.post('/identity/v1/oauth2/token', new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }).toString(), {
                headers: {
                    Authorization: `Basic ${this.getBasicAuth()}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            const newTokens = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token ?? refreshToken,
                expiresAt: new Date(Date.now() + data.expires_in * 1000),
                scope: data.scope,
                tokenType: data.token_type,
            };
            connection.encryptedTokens = this.encryption.encrypt(JSON.stringify(newTokens));
            connection.tokenExpiresAt = newTokens.expiresAt;
            connection.status = 'active';
            connection.lastError = null;
            await this.connectionRepo.save(connection);
            this.logger.log(`Refreshed token for connection ${connection.id}`);
            return newTokens.accessToken;
        }
        catch (err) {
            connection.status = 'error';
            connection.lastError = 'eBay token refresh failed';
            await this.connectionRepo.save(connection);
            throw err;
        }
    }
};
exports.EbayAuthService = EbayAuthService;
exports.EbayAuthService = EbayAuthService = EbayAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(channel_connection_entity_js_1.ChannelConnection)),
    __param(4, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(5, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        token_encryption_service_js_1.TokenEncryptionService,
        sellerpundit_token_sync_service_js_1.SellerpunditTokenSyncService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], EbayAuthService);
//# sourceMappingURL=ebay-auth.service.js.map