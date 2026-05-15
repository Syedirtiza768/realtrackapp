import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import axios from 'axios';
import { ChannelConnection } from '../../../channels/entities/channel-connection.entity.js';
import { Store } from '../../../channels/entities/store.entity.js';
import { TokenEncryptionService } from '../../../channels/token-encryption.service.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayOAuthToken } from '../entities/ebay-oauth-token.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { EbayOAuthStateStore } from './ebay-oauth-state.store.js';
import { EbayAccountTokenService } from './ebay-account-token.service.js';
import { EbayMarketplaceConfigService } from './ebay-marketplace-config.service.js';
import { ListingActionLogWriterService } from './listing-action-log-writer.service.js';

interface TokenBlob {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope?: string;
  tokenType?: string;
}

@Injectable()
export class EbayIntegrationsOAuthService {
  private readonly logger = new Logger(EbayIntegrationsOAuthService.name);

  constructor(
    private readonly stateStore: EbayOAuthStateStore,
    private readonly tokenService: EbayAccountTokenService,
    private readonly encryption: TokenEncryptionService,
    private readonly mpConfig: EbayMarketplaceConfigService,
    private readonly dataSource: DataSource,
    private readonly logWriter: ListingActionLogWriterService,
    @InjectRepository(ChannelConnection)
    private readonly connectionRepo: Repository<ChannelConnection>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayOAuthToken)
    private readonly oauthRepo: Repository<EbayOAuthToken>,
    @InjectRepository(EbayAccountMarketplace)
    private readonly mpRepo: Repository<EbayAccountMarketplace>,
  ) {}

  async startOAuth(input: {
    userId: string;
    organizationId: string;
    internalStoreId: string | null;
    marketplaceId: string;
    environment: 'sandbox' | 'production';
    accountDisplayName: string;
  }): Promise<{ authUrl: string; state: string }> {
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
    });
    const authUrl = this.tokenService.buildAuthorizeUrl({
      state,
      environment: input.environment,
    });
    return { authUrl, state };
  }

  async handleCallback(params: {
    code: string;
    state: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<{ connectedEbayAccountId: string; redirectUrl?: string }> {
    const pending = await this.stateStore.consume(params.state);
    if (!pending) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    const { tokens } = await this.tokenService.exchangeCode({
      code: params.code,
      environment: pending.environment,
    });

    const oauthBase =
      pending.environment === 'production'
        ? 'https://api.ebay.com'
        : 'https://api.sandbox.ebay.com';

    let ebayUserId = 'unknown';
    let ebayUsername: string | null = null;
    try {
      const identity = await axios.get(`${oauthBase}/commerce/identity/v1/user/`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        timeout: 15_000,
      });
      ebayUserId =
        identity.data?.username ?? identity.data?.userId ?? ebayUserId;
      ebayUsername = identity.data?.username ?? null;
    } catch (e) {
      this.logger.warn('eBay identity fetch failed after OAuth', e);
    }

    const tokenBlob: TokenBlob = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      tokenType: tokens.tokenType,
    };

    const displayName =
      pending.accountDisplayName?.trim() ||
      `eBay — ${ebayUserId}`;

    const mp = this.mpConfig.require(pending.marketplaceId);

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
        .map((s: string) => s.trim())
        .filter(Boolean);

      const oauthRow = this.oauthRepo.create({
        ebayAccountId: savedAcct.id,
        accessTokenEncrypted: this.encryption.encrypt(tokens.accessToken),
        accessTokenExpiresAt: new Date(tokenBlob.expiresAt),
        refreshTokenEncrypted: this.encryption.encrypt(tokens.refreshToken),
        refreshTokenExpiresAt: null,
        grantedScopes: scopeList.length ? scopeList : ['https://api.ebay.com/oauth/api_scope'],
        lastRefreshedAt: new Date(),
        reconnectRequired: false,
      });
      await qr.manager.save(oauthRow);

      const mpRow = this.mpRepo.create({
        ebayAccountId: savedAcct.id,
        marketplaceId: pending.marketplaceId,
        currency: mp.currency,
        locale: mp.locale,
        enabled: true,
      });
      await qr.manager.save(mpRow);

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

      return { connectedEbayAccountId: savedAcct.id };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }
}
