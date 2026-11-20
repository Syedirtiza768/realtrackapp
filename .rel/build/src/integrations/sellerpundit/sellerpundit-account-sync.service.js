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
var SellerpunditAccountSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerpunditAccountSyncService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const channel_connection_entity_js_1 = require("../../channels/entities/channel-connection.entity.js");
const store_entity_js_1 = require("../../channels/entities/store.entity.js");
const token_encryption_service_js_1 = require("../../channels/token-encryption.service.js");
const connected_ebay_account_entity_js_1 = require("../ebay/entities/connected-ebay-account.entity.js");
const ebay_oauth_token_entity_js_1 = require("../ebay/entities/ebay-oauth-token.entity.js");
const ebay_account_marketplace_entity_js_1 = require("../ebay/entities/ebay-account-marketplace.entity.js");
const ebay_marketplace_config_service_js_1 = require("../ebay/services/ebay-marketplace-config.service.js");
const listing_action_log_writer_service_js_1 = require("../ebay/services/listing-action-log-writer.service.js");
const sellerpundit_auth_service_js_1 = require("./sellerpundit-auth.service.js");
const sellerpundit_http_client_js_1 = require("./sellerpundit-http.client.js");
const sellerpundit_marketplace_registry_js_1 = require("./sellerpundit-marketplace.registry.js");
const sellerpundit_token_sync_service_js_1 = require("./sellerpundit-token-sync.service.js");
let SellerpunditAccountSyncService = SellerpunditAccountSyncService_1 = class SellerpunditAccountSyncService {
    config;
    auth;
    http;
    tokenSync;
    encryption;
    mpConfig;
    registry;
    dataSource;
    logWriter;
    accountRepo;
    connectionRepo;
    storeRepo;
    oauthRepo;
    mpRepo;
    logger = new common_1.Logger(SellerpunditAccountSyncService_1.name);
    constructor(config, auth, http, tokenSync, encryption, mpConfig, registry, dataSource, logWriter, accountRepo, connectionRepo, storeRepo, oauthRepo, mpRepo) {
        this.config = config;
        this.auth = auth;
        this.http = http;
        this.tokenSync = tokenSync;
        this.encryption = encryption;
        this.mpConfig = mpConfig;
        this.registry = registry;
        this.dataSource = dataSource;
        this.logWriter = logWriter;
        this.accountRepo = accountRepo;
        this.connectionRepo = connectionRepo;
        this.storeRepo = storeRepo;
        this.oauthRepo = oauthRepo;
        this.mpRepo = mpRepo;
    }
    async syncStores(organizationId, userId) {
        const jwt = await this.auth.getJwt(organizationId);
        const raw = await this.http.get(jwt, '/token/get-all-tokens');
        const tokens = this.tokenSync.unwrapTokenList(raw);
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const accountIds = [];
        const environment = this.config.get('SELLERPUNDIT_ENVIRONMENT', 'production') ===
            'sandbox'
            ? 'sandbox'
            : 'production';
        const configDefaultMp = this.config.get('SELLERPUNDIT_DEFAULT_MARKETPLACE_ID', 'EBAY_MOTORS_US') || 'EBAY_MOTORS_US';
        for (const row of tokens) {
            if (row.status && row.status !== 'active') {
                skipped++;
                continue;
            }
            if (!row.accountName?.trim()) {
                skipped++;
                continue;
            }
            const existing = await this.accountRepo.findOne({
                where: { organizationId, sellerpunditTokenId: row.id },
            });
            if (existing) {
                await this.tokenSync.persistTokenRow(existing, row);
                const displayName = row.accountName.trim();
                existing.accountDisplayName = displayName;
                existing.sellerpunditAccountName = displayName;
                existing.sellerpunditMarketplaceId = row.marketPlaceId;
                existing.sellerpunditLastSyncAt = new Date();
                if (row.sellerId)
                    existing.ebayUserId = String(row.sellerId);
                await this.accountRepo.save(existing);
                const marketplaceId = this.registry.resolveMarketplaceForAccount(displayName, configDefaultMp);
                await this.alignAccountMarketplace(existing, marketplaceId);
                updated++;
                accountIds.push(existing.id);
                continue;
            }
            const ebayUserId = row.sellerId ? String(row.sellerId) : `sp-${row.id}`;
            const dup = await this.accountRepo.findOne({
                where: { organizationId, ebayUserId },
            });
            if (dup) {
                this.logger.warn(`Skip SP token ${row.id}: ebay_user_id ${ebayUserId} already used by ${dup.id}`);
                skipped++;
                continue;
            }
            const marketplaceId = this.registry.resolveMarketplaceForAccount(row.accountName.trim(), configDefaultMp);
            const acctId = await this.createAccountFromToken({
                organizationId,
                userId,
                row,
                ebayUserId,
                environment,
                defaultMarketplaceId: marketplaceId,
            });
            imported++;
            accountIds.push(acctId);
        }
        await this.auth.upsertConfig(organizationId, {
            lastSyncAt: new Date(),
            lastError: null,
        });
        await this.logWriter.write({
            organizationId,
            userId,
            action: 'sellerpundit_stores_synced',
            result: 'success',
            afterSnapshot: { imported, updated, skipped, total: tokens.length },
        });
        return { imported, updated, skipped, accounts: accountIds };
    }
    async createAccountFromToken(input) {
        const displayName = input.row.accountName.trim();
        const accessToken = (input.row.token ?? input.row.accessToken ?? '').trim();
        const refreshToken = input.row.refreshToken?.trim() ?? '';
        const expiresInSec = input.row.expiresIn ?? 300;
        const expiresAt = new Date(Date.now() + expiresInSec * 1000);
        const tokenBlob = {
            accessToken,
            refreshToken,
            expiresAt: expiresAt.toISOString(),
        };
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const connection = this.connectionRepo.create({
                channel: 'ebay',
                userId: input.userId ?? input.organizationId,
                organizationId: input.organizationId,
                accountName: displayName,
                externalAccountId: input.ebayUserId,
                encryptedTokens: this.encryption.encrypt(JSON.stringify(tokenBlob)),
                tokenExpiresAt: expiresAt,
                scope: null,
                status: 'active',
            });
            const savedConn = await qr.manager.save(connection);
            const store = this.storeRepo.create({
                connectionId: savedConn.id,
                organizationId: input.organizationId,
                channel: 'ebay',
                storeName: displayName,
                externalStoreId: input.ebayUserId,
                status: 'active',
                isPrimary: false,
                ebayUserId: input.ebayUserId,
                ebayMarketplaceId: input.defaultMarketplaceId,
                config: {
                    marketplace: input.defaultMarketplaceId,
                    sellerpundit: true,
                    sellerpunditTokenId: input.row.id,
                },
            });
            const savedStore = await qr.manager.save(store);
            const acct = this.accountRepo.create({
                organizationId: input.organizationId,
                internalStoreId: null,
                channelConnectionId: savedConn.id,
                primaryStoreId: savedStore.id,
                ebayUserId: input.ebayUserId,
                ebayUsername: null,
                accountDisplayName: displayName,
                environment: input.environment,
                connectionStatus: 'active',
                connectedByUserId: input.userId,
                connectedAt: new Date(),
                connectionSource: 'sellerpundit',
                sellerpunditTokenId: input.row.id,
                sellerpunditAccountName: displayName,
                sellerpunditMarketplaceId: input.row.marketPlaceId,
                sellerpunditLastSyncAt: new Date(),
            });
            const savedAcct = await qr.manager.save(acct);
            const oauthRow = this.oauthRepo.create({
                ebayAccountId: savedAcct.id,
                accessTokenEncrypted: this.encryption.encrypt(accessToken),
                accessTokenExpiresAt: expiresAt,
                refreshTokenEncrypted: this.encryption.encrypt(refreshToken),
                refreshTokenExpiresAt: input.row.refreshTokenExpiresIn
                    ? new Date(Date.now() + input.row.refreshTokenExpiresIn * 1000)
                    : null,
                grantedScopes: [],
                lastRefreshedAt: input.row.lastTokenRefreshDate
                    ? new Date(input.row.lastTokenRefreshDate)
                    : new Date(),
                reconnectRequired: false,
            });
            await qr.manager.save(oauthRow);
            for (const mpId of this.registry.defaultMarketplacesForImport()) {
                try {
                    const mp = this.mpConfig.require(mpId);
                    const mpRow = this.mpRepo.create({
                        ebayAccountId: savedAcct.id,
                        marketplaceId: mpId,
                        currency: mp.currency,
                        locale: mp.locale,
                        enabled: mpId === input.defaultMarketplaceId,
                    });
                    await qr.manager.save(mpRow);
                }
                catch {
                }
            }
            savedStore.ebayMarketplaceId = input.defaultMarketplaceId;
            savedStore.config = {
                ...(savedStore.config ?? {}),
                marketplace: input.defaultMarketplaceId,
                sellerpundit: true,
                sellerpunditTokenId: input.row.id,
            };
            await qr.manager.save(savedStore);
            await qr.commitTransaction();
            return savedAcct.id;
        }
        catch (e) {
            await qr.rollbackTransaction();
            throw e;
        }
        finally {
            await qr.release();
        }
    }
    async alignAccountMarketplace(account, marketplaceId) {
        let mpRow = await this.mpRepo.findOne({
            where: { ebayAccountId: account.id, marketplaceId },
        });
        if (!mpRow) {
            const mp = this.mpConfig.require(marketplaceId);
            mpRow = this.mpRepo.create({
                ebayAccountId: account.id,
                marketplaceId,
                currency: mp.currency,
                locale: mp.locale,
                enabled: true,
            });
            await this.mpRepo.save(mpRow);
        }
        else if (!mpRow.enabled) {
            mpRow.enabled = true;
            await this.mpRepo.save(mpRow);
        }
        if (account.primaryStoreId) {
            const store = await this.storeRepo.findOne({
                where: { id: account.primaryStoreId },
            });
            if (store && store.ebayMarketplaceId !== marketplaceId) {
                store.ebayMarketplaceId = marketplaceId;
                store.config = {
                    ...(store.config ?? {}),
                    marketplace: marketplaceId,
                };
                await this.storeRepo.save(store);
            }
        }
    }
    async testConnection(organizationId) {
        const jwt = await this.auth.getJwt(organizationId);
        const raw = await this.http.get(jwt, '/token/get-all-tokens');
        const tokens = this.tokenSync.unwrapTokenList(raw);
        return { ok: true, storeCount: tokens.length };
    }
};
exports.SellerpunditAccountSyncService = SellerpunditAccountSyncService;
exports.SellerpunditAccountSyncService = SellerpunditAccountSyncService = SellerpunditAccountSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(9, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(10, (0, typeorm_1.InjectRepository)(channel_connection_entity_js_1.ChannelConnection)),
    __param(11, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(12, (0, typeorm_1.InjectRepository)(ebay_oauth_token_entity_js_1.EbayOAuthToken)),
    __param(13, (0, typeorm_1.InjectRepository)(ebay_account_marketplace_entity_js_1.EbayAccountMarketplace)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        sellerpundit_auth_service_js_1.SellerpunditAuthService,
        sellerpundit_http_client_js_1.SellerpunditHttpClient,
        sellerpundit_token_sync_service_js_1.SellerpunditTokenSyncService,
        token_encryption_service_js_1.TokenEncryptionService,
        ebay_marketplace_config_service_js_1.EbayMarketplaceConfigService,
        sellerpundit_marketplace_registry_js_1.SellerpunditMarketplaceRegistry,
        typeorm_2.DataSource,
        listing_action_log_writer_service_js_1.ListingActionLogWriterService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], SellerpunditAccountSyncService);
//# sourceMappingURL=sellerpundit-account-sync.service.js.map