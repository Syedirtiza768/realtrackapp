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
var SellerpunditTokenSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerpunditTokenSyncService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const axios_1 = __importStar(require("axios"));
const typeorm_2 = require("typeorm");
const token_encryption_service_js_1 = require("../../channels/token-encryption.service.js");
const channel_connection_entity_js_1 = require("../../channels/entities/channel-connection.entity.js");
const store_entity_js_1 = require("../../channels/entities/store.entity.js");
const connected_ebay_account_entity_js_1 = require("../ebay/entities/connected-ebay-account.entity.js");
const ebay_oauth_token_entity_js_1 = require("../ebay/entities/ebay-oauth-token.entity.js");
const sellerpundit_auth_service_js_1 = require("./sellerpundit-auth.service.js");
const sellerpundit_http_client_js_1 = require("./sellerpundit-http.client.js");
const sellerpundit_marketplace_registry_js_1 = require("./sellerpundit-marketplace.registry.js");
const ebay_api_error_util_js_1 = require("../../channels/ebay/ebay-api-error.util.js");
const sellerpundit_token_expiry_util_js_1 = require("./sellerpundit-token-expiry.util.js");
let SellerpunditTokenSyncService = SellerpunditTokenSyncService_1 = class SellerpunditTokenSyncService {
    auth;
    http;
    encryption;
    registry;
    accountRepo;
    tokenRepo;
    connectionRepo;
    storeRepo;
    logger = new common_1.Logger(SellerpunditTokenSyncService_1.name);
    constructor(auth, http, encryption, registry, accountRepo, tokenRepo, connectionRepo, storeRepo) {
        this.auth = auth;
        this.http = http;
        this.encryption = encryption;
        this.registry = registry;
        this.accountRepo = accountRepo;
        this.tokenRepo = tokenRepo;
        this.connectionRepo = connectionRepo;
        this.storeRepo = storeRepo;
    }
    async ensureFreshAccessToken(ebayAccountId, options) {
        const account = await this.accountRepo.findOne({
            where: { id: ebayAccountId, connectionSource: 'sellerpundit' },
            relations: ['oauthToken'],
        });
        if (!account?.oauthToken) {
            throw new common_1.HttpException('SellerPundit account or token not found', 502);
        }
        if (account.connectionStatus === 'disabled') {
            throw new common_1.HttpException('eBay account is disabled', 502);
        }
        const row = account.oauthToken;
        if (!(0, sellerpundit_token_expiry_util_js_1.sellerpunditTokenNeedsRefresh)(row, options)) {
            return this.encryption.decrypt(row.accessTokenEncrypted);
        }
        await this.refreshTokenFromSellerpundit(account);
        const updated = await this.tokenRepo.findOneOrFail({
            where: { ebayAccountId },
        });
        return this.encryption.decrypt(updated.accessTokenEncrypted);
    }
    async refreshTokenFromSellerpundit(account) {
        if (!account.sellerpunditTokenId) {
            throw new common_1.HttpException('Missing SellerPundit token id on account', 502);
        }
        const jwt = await this.auth.getJwt(account.organizationId);
        const raw = await this.http.get(jwt, '/token/get-all-tokens');
        const tokens = this.unwrapTokenList(raw);
        const match = tokens.find((t) => t.id === account.sellerpunditTokenId);
        if (!match) {
            await this.accountRepo.update(account.id, {
                connectionStatus: 'reconnect_required',
                lastErrorMessage: 'SellerPundit token no longer returned for this store',
            });
            throw new common_1.HttpException('SellerPundit store not found — re-import stores', 502);
        }
        await this.persistTokenRow(account, match);
    }
    async persistTokenRow(account, row) {
        const accessToken = (row.token ?? row.accessToken ?? '').trim();
        if (!accessToken) {
            throw new common_1.HttpException('SellerPundit returned empty access token', 502);
        }
        const expiresAt = (0, sellerpundit_token_expiry_util_js_1.computeSellerpunditAccessTokenExpiry)(row);
        const refreshToken = row.refreshToken?.trim() ?? '';
        let oauth = await this.tokenRepo.findOne({
            where: { ebayAccountId: account.id },
        });
        if (!oauth) {
            oauth = this.tokenRepo.create({
                ebayAccountId: account.id,
                grantedScopes: [],
                reconnectRequired: false,
            });
        }
        oauth.accessTokenEncrypted = this.encryption.encrypt(accessToken);
        oauth.accessTokenExpiresAt = expiresAt;
        oauth.refreshTokenEncrypted = this.encryption.encrypt(refreshToken);
        oauth.refreshTokenExpiresAt = row.refreshTokenExpiresIn
            ? new Date(Date.now() + row.refreshTokenExpiresIn * 1000)
            : null;
        const refreshedAt = row.lastTokenRefreshDate
            ? new Date(row.lastTokenRefreshDate)
            : new Date();
        oauth.lastRefreshedAt = Number.isNaN(refreshedAt.getTime())
            ? new Date()
            : refreshedAt;
        if (expiresAt.getTime() <= Date.now()) {
            this.logger.warn(`SellerPundit token ${row.id} for "${account.ebayUsername ?? account.id}" appears expired per SellerPundit metadata — re-sync stores in SellerPundit if publish fails`);
        }
        oauth.reconnectRequired = false;
        await this.tokenRepo.save(oauth);
        const ebayTokenValid = await this.probeEbayAccessToken(accessToken, account.environment ?? 'production', await this.resolveProbeMarketplaceId(account));
        if (!ebayTokenValid) {
            oauth.reconnectRequired = true;
            await this.tokenRepo.save(oauth);
            this.logger.warn(`SellerPundit token ${row.id} for "${account.ebayUsername ?? account.accountDisplayName ?? account.id}" is not accepted by eBay — reconnect eBay in SellerPundit, then re-sync stores`);
        }
        const conn = await this.connectionRepo.findOneBy({
            id: account.channelConnectionId,
        });
        if (conn) {
            conn.encryptedTokens = this.encryption.encrypt(JSON.stringify({
                accessToken,
                refreshToken,
                expiresAt: expiresAt.toISOString(),
            }));
            conn.tokenExpiresAt = expiresAt;
            conn.status = ebayTokenValid ? 'active' : 'error';
            conn.lastError = ebayTokenValid
                ? null
                : 'eBay rejected SellerPundit OAuth token — reconnect in SellerPundit';
            await this.connectionRepo.save(conn);
        }
        const newConnectionStatus = ebayTokenValid
            ? 'active'
            : 'reconnect_required';
        const newErrorMessage = ebayTokenValid
            ? null
            : 'eBay rejected SellerPundit OAuth token — reconnect eBay in SellerPundit, then Re-sync stores';
        await this.accountRepo.update(account.id, {
            lastTokenRefreshAt: oauth.lastRefreshedAt,
            sellerpunditLastSyncAt: new Date(),
            connectionStatus: newConnectionStatus,
            lastErrorMessage: newErrorMessage,
        });
        account.lastTokenRefreshAt = oauth.lastRefreshedAt;
        account.sellerpunditLastSyncAt = new Date();
        account.connectionStatus = newConnectionStatus;
        account.lastErrorMessage = newErrorMessage;
    }
    async validateAccountEbayToken(ebayAccountId, marketplaceId) {
        const account = await this.accountRepo.findOne({
            where: { id: ebayAccountId, connectionSource: 'sellerpundit' },
        });
        if (!account)
            return false;
        try {
            await this.refreshTokenFromSellerpundit(account);
            const oauth = await this.tokenRepo.findOneByOrFail({ ebayAccountId });
            const accessToken = this.encryption.decrypt(oauth.accessTokenEncrypted);
            return this.probeEbayAccessToken(accessToken, account.environment ?? 'production', marketplaceId);
        }
        catch {
            return false;
        }
    }
    async resolveProbeMarketplaceId(account) {
        if (account.primaryStoreId) {
            const store = await this.storeRepo.findOneBy({
                id: account.primaryStoreId,
            });
            if (store?.ebayMarketplaceId?.trim()) {
                return store.ebayMarketplaceId.trim();
            }
        }
        return this.registry.resolveMarketplaceForAccount(account.sellerpunditAccountName ?? account.accountDisplayName ?? '', 'EBAY_MOTORS_US');
    }
    async probeEbayAccessToken(accessToken, environment, marketplaceId) {
        const baseUrl = environment === 'sandbox'
            ? 'https://api.sandbox.ebay.com'
            : 'https://api.ebay.com';
        try {
            const { status, data } = await axios_1.default.get(`${baseUrl}/sell/inventory/v1/inventory_item`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
                    Accept: 'application/json',
                },
                params: { limit: 1 },
                timeout: 15_000,
                validateStatus: () => true,
            });
            if (status === 200)
                return true;
            if (status === 401 &&
                (0, ebay_api_error_util_js_1.isEbayInvalidAccessTokenError)({ response: { status, data } })) {
                return false;
            }
            return status >= 200 && status < 500;
        }
        catch (err) {
            if ((0, ebay_api_error_util_js_1.isEbayInvalidAccessTokenError)(err))
                return false;
            if ((0, axios_1.isAxiosError)(err) && err.response?.status === 401)
                return false;
            return false;
        }
    }
    unwrapTokenList(raw) {
        if (Array.isArray(raw))
            return raw;
        if (raw && typeof raw === 'object') {
            const o = raw;
            if (Array.isArray(o.data))
                return o.data;
            if (o.data &&
                typeof o.data === 'object' &&
                Array.isArray(o.data.data)) {
                return o.data.data;
            }
        }
        return [];
    }
};
exports.SellerpunditTokenSyncService = SellerpunditTokenSyncService;
exports.SellerpunditTokenSyncService = SellerpunditTokenSyncService = SellerpunditTokenSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(5, (0, typeorm_1.InjectRepository)(ebay_oauth_token_entity_js_1.EbayOAuthToken)),
    __param(6, (0, typeorm_1.InjectRepository)(channel_connection_entity_js_1.ChannelConnection)),
    __param(7, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __metadata("design:paramtypes", [sellerpundit_auth_service_js_1.SellerpunditAuthService,
        sellerpundit_http_client_js_1.SellerpunditHttpClient,
        token_encryption_service_js_1.TokenEncryptionService,
        sellerpundit_marketplace_registry_js_1.SellerpunditMarketplaceRegistry,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], SellerpunditTokenSyncService);
//# sourceMappingURL=sellerpundit-token-sync.service.js.map