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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EbayIntegrationsOAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayIntegrationsOAuthService = exports.EbayOAuthCallbackFailure = void 0;
exports.isPlaceholderEbayUserId = isPlaceholderEbayUserId;
exports.identityMatchesAccount = identityMatchesAccount;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto = __importStar(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const channel_connection_entity_js_1 = require("../../../channels/entities/channel-connection.entity.js");
const store_entity_js_1 = require("../../../channels/entities/store.entity.js");
const token_encryption_service_js_1 = require("../../../channels/token-encryption.service.js");
const connected_ebay_account_entity_js_1 = require("../entities/connected-ebay-account.entity.js");
const ebay_oauth_token_entity_js_1 = require("../entities/ebay-oauth-token.entity.js");
const ebay_account_marketplace_entity_js_1 = require("../entities/ebay-account-marketplace.entity.js");
const ebay_business_policy_entity_js_1 = require("../entities/ebay-business-policy.entity.js");
const ebay_oauth_state_store_js_1 = require("./ebay-oauth-state.store.js");
const ebay_account_token_service_js_1 = require("./ebay-account-token.service.js");
const ebay_marketplace_config_service_js_1 = require("./ebay-marketplace-config.service.js");
const ebay_policy_sync_service_js_1 = require("./ebay-policy-sync.service.js");
const listing_action_log_writer_service_js_1 = require("./listing-action-log-writer.service.js");
function isPlaceholderEbayUserId(value) {
    return !value || value === 'unknown' || value.startsWith('unknown_');
}
function identityMatchesAccount(account, identity) {
    const storedId = isPlaceholderEbayUserId(account.ebayUserId)
        ? null
        : account.ebayUserId;
    if (identity.userId && storedId === identity.userId)
        return true;
    const username = identity.username?.trim().toLowerCase();
    if (!username)
        return false;
    return (storedId?.toLowerCase() === username ||
        account.ebayUsername?.trim().toLowerCase() === username);
}
const STATUS_PREFERENCE = {
    active: 0,
    reconnect_required: 1,
    error: 2,
    disabled: 3,
};
function preferredAccount(accounts) {
    const time = (d) => (d ? new Date(d).getTime() : 0);
    return [...accounts].sort((a, b) => (STATUS_PREFERENCE[a.connectionStatus] ?? 9) -
        (STATUS_PREFERENCE[b.connectionStatus] ?? 9) ||
        time(b.lastTokenRefreshAt) - time(a.lastTokenRefreshAt) ||
        time(a.createdAt) - time(b.createdAt))[0];
}
const POLICY_LIST_FIELDS = {
    fulfillment: { list: 'fulfillmentPolicies', id: 'fulfillmentPolicyId' },
    payment: { list: 'paymentPolicies', id: 'paymentPolicyId' },
    return: { list: 'returnPolicies', id: 'returnPolicyId' },
};
const POLICY_CHECK_CONCURRENCY = 4;
class EbayOAuthCallbackFailure extends Error {
    reason;
    redirectPath;
    userMessage;
    constructor(message, reason, redirectPath, userMessage) {
        super(message);
        this.reason = reason;
        this.redirectPath = redirectPath;
        this.userMessage = userMessage;
    }
}
exports.EbayOAuthCallbackFailure = EbayOAuthCallbackFailure;
function verticalRedirectPath(vertical) {
    return vertical === 'fashion'
        ? '/fashion/stores'
        : vertical === 'business_industrial'
            ? '/business-industrial/stores'
            : '/settings/integrations/ebay';
}
let EbayIntegrationsOAuthService = EbayIntegrationsOAuthService_1 = class EbayIntegrationsOAuthService {
    stateStore;
    tokenService;
    encryption;
    mpConfig;
    dataSource;
    logWriter;
    policySync;
    connectionRepo;
    storeRepo;
    accountRepo;
    oauthRepo;
    mpRepo;
    policyRepo;
    logger = new common_1.Logger(EbayIntegrationsOAuthService_1.name);
    constructor(stateStore, tokenService, encryption, mpConfig, dataSource, logWriter, policySync, connectionRepo, storeRepo, accountRepo, oauthRepo, mpRepo, policyRepo) {
        this.stateStore = stateStore;
        this.tokenService = tokenService;
        this.encryption = encryption;
        this.mpConfig = mpConfig;
        this.dataSource = dataSource;
        this.logWriter = logWriter;
        this.policySync = policySync;
        this.connectionRepo = connectionRepo;
        this.storeRepo = storeRepo;
        this.accountRepo = accountRepo;
        this.oauthRepo = oauthRepo;
        this.mpRepo = mpRepo;
        this.policyRepo = policyRepo;
    }
    async startOAuth(input) {
        this.mpConfig.require(input.marketplaceId);
        const state = crypto.randomBytes(32).toString('hex');
        await this.stateStore.save(state, {
            userId: input.userId,
            organizationId: input.organizationId,
            internalStoreId: input.internalStoreId,
            marketplaceId: input.marketplaceId,
            environment: input.environment,
            scopes: this.tokenService.getDefaultScopes(),
            accountDisplayName: input.accountDisplayName,
            vertical: input.vertical ?? 'automotive',
            reconnectAccountId: input.reconnectAccountId ?? null,
        });
        const authUrl = this.tokenService.buildAuthorizeUrl({
            state,
            environment: input.environment,
        });
        return { authUrl, state };
    }
    async handleCallback(params) {
        const pending = await this.stateStore.consume(params.state);
        if (!pending) {
            throw new common_1.BadRequestException('Invalid or expired OAuth state');
        }
        try {
            return await this.handlePendingCallback(pending, params);
        }
        catch (e) {
            const userMessage = e instanceof common_1.HttpException &&
                (e.getStatus() < 500 || e instanceof common_1.ServiceUnavailableException)
                ? e.message
                : null;
            throw new EbayOAuthCallbackFailure(e?.message ?? String(e), e instanceof common_1.ConflictException ? 'conflict' : 'oauth_failed', verticalRedirectPath(pending.vertical), userMessage);
        }
    }
    async handlePendingCallback(pending, params) {
        let tokens;
        try {
            const result = await this.tokenService.exchangeCode({
                code: params.code,
                environment: pending.environment,
            });
            tokens = result.tokens;
        }
        catch (e) {
            this.logger.warn({ errMsg: e?.message }, 'eBay token exchange failed');
            throw e;
        }
        const identity = await this.fetchSellerIdentity(tokens.accessToken, pending.environment);
        if (pending.reconnectAccountId) {
            return this.reconnectExistingAccount(pending, tokens, identity, params);
        }
        const existing = await this.findExistingSellerAccount(pending, identity, tokens.accessToken);
        if (existing) {
            return this.reauthorizeInPlace(existing.account, existing.verifiedBy, 'connect', pending, tokens, identity, params);
        }
        if (!identity.userId) {
            throw new common_1.ServiceUnavailableException('eBay did not return the seller account ID, so the store was not saved. Try Sign in with eBay again.');
        }
        const ebayUserId = identity.userId;
        const ebayUsername = identity.username;
        const existingSellerStores = await this.storeRepo.find({
            where: {
                organizationId: pending.organizationId,
                ebayUserId,
            },
            select: ['id', 'storeName', 'verticalConfig'],
        });
        if (existingSellerStores.length > 0) {
            throw new common_1.ConflictException('This eBay seller account is already connected in this workspace and cannot be reused across verticals');
        }
        const tokenBlob = {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
            scope: tokens.scope,
            tokenType: tokens.tokenType,
        };
        const displayName = pending.accountDisplayName?.trim() ||
            ebayUsername ||
            `eBay — ${ebayUserId}`;
        const allMpConfigs = this.mpConfig.all();
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const connection = this.connectionRepo.create({
                channel: 'ebay',
                userId: pending.userId,
                organizationId: pending.organizationId,
                accountName: displayName,
                externalAccountId: ebayUserId,
                encryptedTokens: this.encryption.encrypt(JSON.stringify(tokenBlob)),
                tokenExpiresAt: new Date(tokenBlob.expiresAt),
                scope: tokens.scope ?? null,
                status: 'active',
            });
            const savedConn = await qr.manager.save(connection);
            const store = this.storeRepo.create({
                connectionId: savedConn.id,
                organizationId: pending.organizationId,
                channel: 'ebay',
                storeName: displayName,
                externalStoreId: ebayUserId,
                status: 'active',
                isPrimary: false,
                ebayUserId,
                ebayMarketplaceId: pending.marketplaceId,
                verticalConfig: pending.vertical === 'fashion'
                    ? {
                        enabledVerticals: ['fashion'],
                        defaultVertical: 'fashion',
                        ownerVertical: 'fashion',
                        workflows: {},
                    }
                    : pending.vertical === 'business_industrial'
                        ? {
                            enabledVerticals: ['business_industrial'],
                            defaultVertical: 'business_industrial',
                            ownerVertical: 'business_industrial',
                            workflows: {},
                        }
                        : null,
                config: {
                    marketplace: pending.marketplaceId,
                    sandbox: pending.environment === 'sandbox',
                    ebayUserId,
                },
            });
            const savedStore = await qr.manager.save(store);
            const acct = this.accountRepo.create({
                organizationId: pending.organizationId,
                internalStoreId: pending.internalStoreId,
                channelConnectionId: savedConn.id,
                primaryStoreId: savedStore.id,
                ebayUserId,
                ebayUsername,
                accountDisplayName: displayName,
                environment: pending.environment,
                connectionStatus: 'active',
                connectedByUserId: pending.userId,
                connectedAt: new Date(),
            });
            const savedAcct = await qr.manager.save(acct);
            const scopeList = (tokens.scope ?? '')
                .split(/[\s]+/)
                .map((s) => s.trim())
                .filter(Boolean);
            const oauthRow = this.oauthRepo.create({
                ebayAccountId: savedAcct.id,
                accessTokenEncrypted: this.encryption.encrypt(tokens.accessToken),
                accessTokenExpiresAt: new Date(tokenBlob.expiresAt),
                refreshTokenEncrypted: this.encryption.encrypt(tokens.refreshToken),
                refreshTokenExpiresAt: null,
                grantedScopes: scopeList.length
                    ? scopeList
                    : ['https://api.ebay.com/oauth/api_scope'],
                lastRefreshedAt: new Date(),
                reconnectRequired: false,
            });
            await qr.manager.save(oauthRow);
            for (const cfg of allMpConfigs) {
                const mpRow = this.mpRepo.create({
                    ebayAccountId: savedAcct.id,
                    marketplaceId: cfg.marketplaceId,
                    currency: cfg.currency,
                    locale: cfg.locale,
                    enabled: true,
                });
                await qr.manager.save(mpRow);
            }
            await qr.commitTransaction();
            await this.logWriter.write({
                organizationId: pending.organizationId,
                userId: pending.userId,
                ebayAccountId: savedAcct.id,
                marketplaceId: pending.marketplaceId,
                action: 'ebay_account_connected',
                result: 'success',
                ipAddress: params.ipAddress ?? null,
                userAgent: params.userAgent ?? null,
                afterSnapshot: {
                    ebayUserId,
                    marketplaceId: pending.marketplaceId,
                    environment: pending.environment,
                },
            });
            this.queuePolicySync(savedAcct.id, pending);
            return {
                connectedEbayAccountId: savedAcct.id,
                redirectUrl: verticalRedirectPath(pending.vertical),
            };
        }
        catch (e) {
            await qr.rollbackTransaction();
            this.logger.warn({ errMsg: e?.message }, 'eBay OAuth DB transaction failed');
            throw e;
        }
        finally {
            await qr.release();
        }
    }
    async reconnectExistingAccount(pending, tokens, identity, params) {
        const account = await this.accountRepo.findOne({
            where: {
                id: pending.reconnectAccountId,
                organizationId: pending.organizationId,
            },
        });
        if (!account)
            throw new common_1.BadRequestException('The eBay connection being reconnected no longer exists');
        if (account.connectionSource === 'sellerpundit')
            throw new common_1.BadRequestException('SellerPundit connections are re-authorized through SellerPundit');
        if (account.environment !== pending.environment)
            throw new common_1.BadRequestException(`This connection is ${account.environment}; reconnect it in the same environment`);
        const mismatch = () => new common_1.ConflictException(`You signed in to eBay as a different seller than "${account.accountDisplayName}". ` +
            'Sign out of eBay, sign in with that store’s seller account and reconnect again.');
        let verifiedBy;
        if (identityMatchesAccount(account, identity)) {
            verifiedBy = 'ebay_user_id';
        }
        else {
            const realIdMismatch = !!identity.userId && !isPlaceholderEbayUserId(account.ebayUserId);
            const owns = await this.tokenSeesCachedPolicies(account.id, tokens.accessToken, pending.environment);
            if (owns === true)
                verifiedBy = 'business_policies';
            else if (owns === 'no_cache' && !realIdMismatch)
                throw new common_1.ConflictException(`Cannot confirm the eBay login belongs to "${account.accountDisplayName}": ` +
                    'eBay did not return a seller ID and no business policies are cached for this connection.');
            else
                throw mismatch();
        }
        return this.reauthorizeInPlace(account, verifiedBy, 'reconnect', pending, tokens, identity, params);
    }
    async findExistingSellerAccount(pending, identity, accessToken) {
        const accounts = (await this.accountRepo.find({
            where: {
                organizationId: pending.organizationId,
                environment: pending.environment,
            },
        })).filter((a) => a.connectionSource !== 'sellerpundit');
        if (!accounts.length)
            return null;
        const byIdentity = accounts.filter((a) => identityMatchesAccount(a, identity));
        if (byIdentity.length)
            return {
                account: preferredAccount(byIdentity),
                verifiedBy: 'ebay_user_id',
            };
        const pool = identity.userId
            ? accounts.filter((a) => isPlaceholderEbayUserId(a.ebayUserId))
            : accounts;
        if (!pool.length)
            return null;
        const owned = await this.accountsOwningTokenPolicies(pool.map((a) => a.id), accessToken, pending.environment);
        if (owned === 'no_cache' || !owned.size)
            return null;
        const matches = pool.filter((a) => owned.has(a.id));
        if (matches.length > 1)
            this.logger.warn(`eBay login matches ${matches.length} existing accounts (${matches
                .map((a) => a.id)
                .join(', ')}); re-authorizing the preferred one`);
        return {
            account: preferredAccount(matches),
            verifiedBy: 'business_policies',
        };
    }
    async reauthorizeInPlace(account, verifiedBy, via, pending, tokens, identity, params) {
        const adoptUserId = identity.userId && identity.userId !== account.ebayUserId
            ? identity.userId
            : null;
        if (adoptUserId) {
            const [otherAccount, otherStore] = await Promise.all([
                this.accountRepo.findOne({
                    where: {
                        organizationId: pending.organizationId,
                        ebayUserId: adoptUserId,
                    },
                    select: ['id', 'accountDisplayName'],
                }),
                this.storeRepo.findOne({
                    where: {
                        organizationId: pending.organizationId,
                        ebayUserId: adoptUserId,
                    },
                    select: ['id', 'storeName'],
                }),
            ]);
            if ((otherAccount && otherAccount.id !== account.id) ||
                (otherStore && otherStore.id !== account.primaryStoreId))
                throw new common_1.ConflictException(`This eBay seller is already connected in this workspace as "${otherAccount?.accountDisplayName ?? otherStore?.storeName}"`);
        }
        const now = new Date();
        const expiresAt = new Date(tokens.expiresAt);
        const scopeList = (tokens.scope ?? '')
            .split(/[\s]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        await this.dataSource.transaction(async (m) => {
            const tokenRepo = m.getRepository(ebay_oauth_token_entity_js_1.EbayOAuthToken);
            const tokenRow = (await tokenRepo.findOne({ where: { ebayAccountId: account.id } })) ??
                tokenRepo.create({
                    ebayAccountId: account.id,
                    refreshTokenExpiresAt: null,
                });
            tokenRow.accessTokenEncrypted = this.encryption.encrypt(tokens.accessToken);
            tokenRow.accessTokenExpiresAt = expiresAt;
            tokenRow.refreshTokenEncrypted = this.encryption.encrypt(tokens.refreshToken);
            if (scopeList.length)
                tokenRow.grantedScopes = scopeList;
            else if (!tokenRow.grantedScopes?.length)
                tokenRow.grantedScopes = ['https://api.ebay.com/oauth/api_scope'];
            tokenRow.lastRefreshedAt = now;
            tokenRow.reconnectRequired = false;
            await tokenRepo.save(tokenRow);
            await m
                .getRepository(channel_connection_entity_js_1.ChannelConnection)
                .update(account.channelConnectionId, {
                encryptedTokens: this.encryption.encrypt(JSON.stringify(tokens)),
                tokenExpiresAt: expiresAt,
                scope: tokens.scope ?? null,
                status: 'active',
                lastError: null,
                ...(adoptUserId ? { externalAccountId: adoptUserId } : {}),
            });
            await m.getRepository(connected_ebay_account_entity_js_1.ConnectedEbayAccount).update(account.id, {
                connectionStatus: 'active',
                lastTokenRefreshAt: now,
                lastVerifiedAt: now,
                lastErrorMessage: null,
                ...(identity.username ? { ebayUsername: identity.username } : {}),
                ...(adoptUserId ? { ebayUserId: adoptUserId } : {}),
            });
            if (adoptUserId) {
                const storeRepo = m.getRepository(store_entity_js_1.Store);
                const store = await storeRepo.findOne({
                    where: { id: account.primaryStoreId },
                });
                if (store) {
                    store.ebayUserId = adoptUserId;
                    store.externalStoreId = adoptUserId;
                    store.config = { ...(store.config ?? {}), ebayUserId: adoptUserId };
                    await storeRepo.save(store);
                }
            }
        });
        await this.logWriter.write({
            organizationId: pending.organizationId,
            userId: pending.userId,
            ebayAccountId: account.id,
            marketplaceId: pending.marketplaceId,
            action: 'ebay_account_reconnected',
            result: 'success',
            ipAddress: params.ipAddress ?? null,
            userAgent: params.userAgent ?? null,
            beforeSnapshot: {
                connectionStatus: account.connectionStatus,
                ebayUserId: account.ebayUserId,
            },
            afterSnapshot: {
                connectionStatus: 'active',
                verifiedBy,
                via,
                ebayUserId: adoptUserId ?? account.ebayUserId,
            },
        });
        this.queuePolicySync(account.id, pending);
        return {
            connectedEbayAccountId: account.id,
            redirectUrl: verticalRedirectPath(pending.vertical),
        };
    }
    async tokenSeesCachedPolicies(ebayAccountId, accessToken, environment) {
        const owned = await this.accountsOwningTokenPolicies([ebayAccountId], accessToken, environment);
        return owned === 'no_cache' ? owned : owned.has(ebayAccountId);
    }
    async accountsOwningTokenPolicies(ebayAccountIds, accessToken, environment) {
        const cached = await this.policyRepo.find({
            where: { ebayAccountId: (0, typeorm_2.In)(ebayAccountIds) },
            select: ['ebayAccountId', 'marketplaceId', 'policyType', 'ebayPolicyId'],
        });
        const ownersByPolicyId = new Map();
        const pairCounts = new Map();
        for (const p of cached) {
            if (!POLICY_LIST_FIELDS[p.policyType])
                continue;
            const owners = ownersByPolicyId.get(p.ebayPolicyId) ?? new Set();
            owners.add(p.ebayAccountId);
            ownersByPolicyId.set(p.ebayPolicyId, owners);
            const pair = `${p.marketplaceId}|${p.policyType}`;
            pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
        }
        const pairs = [...pairCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([pair]) => pair);
        if (!pairs.length)
            return 'no_cache';
        const apiBase = environment === 'production'
            ? 'https://api.ebay.com'
            : 'https://api.sandbox.ebay.com';
        let answered = 0;
        const owned = new Set();
        const fetchPair = async (pair) => {
            const [marketplaceId, policyType] = pair.split('|');
            const fields = POLICY_LIST_FIELDS[policyType];
            try {
                const { data } = await axios_1.default.get(`${apiBase}/sell/account/v1/${policyType}_policy`, {
                    params: { marketplace_id: marketplaceId },
                    headers: { Authorization: `Bearer ${accessToken}` },
                    timeout: 15_000,
                });
                answered++;
                for (const row of data?.[fields.list] ?? []) {
                    const id = row[fields.id];
                    if (typeof id !== 'string')
                        continue;
                    for (const owner of ownersByPolicyId.get(id) ?? [])
                        owned.add(owner);
                }
            }
            catch (e) {
                const status = e?.response?.status ?? '?';
                this.logger.warn(`eBay seller check: ${policyType} policies for ${marketplaceId} failed (${status})`);
            }
        };
        for (let i = 0; i < pairs.length; i += POLICY_CHECK_CONCURRENCY) {
            await Promise.all(pairs.slice(i, i + POLICY_CHECK_CONCURRENCY).map(fetchPair));
            if (owned.size)
                return owned;
        }
        if (!answered)
            throw new common_1.ServiceUnavailableException('Could not reach eBay to confirm the seller account. Try again.');
        return owned;
    }
    async fetchSellerIdentity(accessToken, environment) {
        const base = environment === 'production'
            ? 'https://apiz.ebay.com'
            : 'https://apiz.sandbox.ebay.com';
        try {
            const { data } = await axios_1.default.get(`${base}/commerce/identity/v1/user/`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 15_000,
            });
            return {
                userId: typeof data?.userId === 'string' && data.userId ? data.userId : null,
                username: typeof data?.username === 'string' && data.username
                    ? data.username
                    : null,
            };
        }
        catch (e) {
            const status = e?.response?.status ?? '?';
            this.logger.warn({ status, errMsg: e?.message ?? String(e) }, `eBay identity API failed (${status})`);
            return { userId: null, username: null };
        }
    }
    queuePolicySync(ebayAccountId, pending) {
        this.logger.log(`Queuing policy sync for account ${ebayAccountId}`);
        const orgId = pending.organizationId;
        const usrId = pending.userId;
        setTimeout(() => {
            this.policySync
                .syncPolicies(ebayAccountId, orgId, usrId)
                .then((result) => {
                this.logger.log(`Auto-policy sync complete for ${ebayAccountId}: ${result.synced} policies — ${result.message}`);
            })
                .catch((err) => {
                this.logger.error(`Auto-policy sync failed for ${ebayAccountId}: ${err instanceof Error ? err.message : String(err)}`);
            });
        }, 1000);
    }
};
exports.EbayIntegrationsOAuthService = EbayIntegrationsOAuthService;
exports.EbayIntegrationsOAuthService = EbayIntegrationsOAuthService = EbayIntegrationsOAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, typeorm_1.InjectRepository)(channel_connection_entity_js_1.ChannelConnection)),
    __param(8, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(9, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(10, (0, typeorm_1.InjectRepository)(ebay_oauth_token_entity_js_1.EbayOAuthToken)),
    __param(11, (0, typeorm_1.InjectRepository)(ebay_account_marketplace_entity_js_1.EbayAccountMarketplace)),
    __param(12, (0, typeorm_1.InjectRepository)(ebay_business_policy_entity_js_1.EbayBusinessPolicy)),
    __metadata("design:paramtypes", [ebay_oauth_state_store_js_1.EbayOAuthStateStore,
        ebay_account_token_service_js_1.EbayAccountTokenService,
        token_encryption_service_js_1.TokenEncryptionService,
        ebay_marketplace_config_service_js_1.EbayMarketplaceConfigService,
        typeorm_2.DataSource,
        listing_action_log_writer_service_js_1.ListingActionLogWriterService,
        ebay_policy_sync_service_js_1.EbayPolicySyncService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], EbayIntegrationsOAuthService);
//# sourceMappingURL=ebay-integrations-oauth.service.js.map