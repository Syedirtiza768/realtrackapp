import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { type AxiosInstance, isAxiosError } from 'axios';
import { Store } from '../entities/store.entity.js';
import { ChannelConnection } from '../entities/channel-connection.entity.js';
import { TokenEncryptionService } from '../token-encryption.service.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { SellerpunditTokenSyncService } from '../../integrations/sellerpundit/sellerpundit-token-sync.service.js';
import type { EbayApiConfig } from './ebay-api.types.js';

/**
 * EbayAuthService — Multi-account OAuth2 flow manager.
 *
 * Manages per-store eBay OAuth tokens:
 *  - Initiate OAuth consent for new store connections
 *  - Exchange authorization codes for token pairs
 *  - Auto-refresh access tokens before expiry
 *  - Decrypt and cache tokens per request
 *
 * Each connected eBay store has its own User Token pair (access + refresh),
 * encrypted at rest via AES-256-GCM (TokenEncryptionService).
 */
@Injectable()
export class EbayAuthService {
  private readonly logger = new Logger(EbayAuthService.name);
  private readonly config: EbayApiConfig;
  private readonly http: AxiosInstance;

  /** Buffer (in ms) before token expiry to trigger proactive refresh */
  private readonly refreshBufferMs = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly encryption: TokenEncryptionService,
    private readonly sellerpunditTokens: SellerpunditTokenSyncService,
    @InjectRepository(ChannelConnection)
    private readonly connectionRepo: Repository<ChannelConnection>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly connectedAccountRepo: Repository<ConnectedEbayAccount>,
  ) {
    const environment = this.configService
      .get<string>('EBAY_ENVIRONMENT', '')
      .trim()
      .toUpperCase();
    const sandboxOverride = this.configService.get<string>('EBAY_SANDBOX');
    const sandbox =
      sandboxOverride != null
        ? sandboxOverride.toLowerCase() === 'true'
        : environment !== 'PRODUCTION';

    this.config = {
      clientId: this.configService.get<string>('EBAY_CLIENT_ID', ''),
      clientSecret: this.configService.get<string>('EBAY_CLIENT_SECRET', ''),
      redirectUri: this.configService.get<string>('EBAY_REDIRECT_URI', ''),
      sandbox,
      baseUrl: sandbox
        ? 'https://api.sandbox.ebay.com'
        : 'https://api.ebay.com',
      authUrl: sandbox
        ? 'https://auth.sandbox.ebay.com'
        : 'https://auth.ebay.com',
    };

    this.http = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Get eBay API configuration (for use by other eBay services).
   */
  getApiConfig(): EbayApiConfig {
    return { ...this.config };
  }

  /**
   * Get Base64-encoded Basic Auth header value.
   */
  private getBasicAuth(): string {
    return Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');
  }

  /**
   * Resolve the integrations account linked to a legacy store row, if any.
   */
  private async findLinkedAccount(
    storeId: string,
    connectionId?: string,
  ): Promise<ConnectedEbayAccount | null> {
    const byStore = await this.connectedAccountRepo.findOne({
      where: { primaryStoreId: storeId },
    });
    if (byStore) return byStore;

    if (connectionId) {
      return this.connectedAccountRepo.findOne({
        where: { channelConnectionId: connectionId },
      });
    }
    return null;
  }

  /**
   * API host for a store (SellerPundit accounts use their own environment).
   */
  async getApiBaseUrlForStore(storeId: string): Promise<string> {
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
        .get<string>('SELLERPUNDIT_ENVIRONMENT', 'production')
        .trim()
        .toLowerCase();
      return spEnv === 'sandbox'
        ? 'https://api.sandbox.ebay.com'
        : 'https://api.ebay.com';
    }

    return this.config.baseUrl;
  }

  /**
   * Get a valid access token for a specific store.
   * Auto-refreshes if the token is expired or within the refresh buffer.
   */
  async getAccessToken(
    storeId: string,
    options?: { forceRefresh?: boolean },
  ): Promise<string> {
    const store = await this.storeRepo.findOne({
      where: { id: storeId },
      relations: ['connection'],
    });
    if (!store) {
      throw new Error(`Store ${storeId} not found`);
    }

    const connection =
      store.connection ??
      (await this.connectionRepo.findOneByOrFail({ id: store.connectionId }));

    const linked = await this.findLinkedAccount(store.id, store.connectionId);
    if (linked?.connectionSource === 'sellerpundit') {
      try {
        return await this.sellerpunditTokens.ensureFreshAccessToken(linked.id, {
          force: options?.forceRefresh === true,
        });
      } catch (err) {
        throw this.wrapTokenError(
          store.storeName,
          err,
          'SellerPundit token refresh failed — re-sync stores in Settings → eBay Integrations',
        );
      }
    }

    const tokens = JSON.parse(
      this.encryption.decrypt(connection.encryptedTokens),
    );

    // Check if token needs refresh
    const expiresAt = new Date(tokens.expiresAt);
    const now = new Date();
    if (expiresAt.getTime() - now.getTime() < this.refreshBufferMs) {
      if (tokens.refreshToken) {
        this.logger.log(
          `Proactively refreshing token for store ${storeId} (expires ${expiresAt.toISOString()})`,
        );
        try {
          return await this.refreshAndStore(connection, tokens.refreshToken);
        } catch (err) {
          throw this.wrapTokenError(
            store.storeName,
            err,
            'eBay authorization expired — reconnect this store in Settings → eBay Integrations',
          );
        }
      }
      this.logger.warn(
        `Token for store ${storeId} is expiring but no refresh token available`,
      );
      throw new UnauthorizedException(
        `eBay authorization expired for "${store.storeName}". Reconnect this store in Settings → eBay Integrations.`,
      );
    }

    return tokens.accessToken;
  }

  private wrapTokenError(
    storeName: string,
    err: unknown,
    hint: string,
  ): UnauthorizedException {
    if (isAxiosError(err) && err.response?.status === 401) {
      return new UnauthorizedException(
        `eBay rejected the access token for "${storeName}". ${hint}`,
      );
    }
    if (err instanceof UnauthorizedException) {
      return err;
    }
    const message = err instanceof Error ? err.message : String(err);
    return new UnauthorizedException(`${hint} (${message})`);
  }

  /**
   * Get a valid Application Token (client_credentials grant).
   * Used for Taxonomy API and Browse API calls that don't require user context.
   */
  async getApplicationToken(): Promise<string> {
    const { data } = await this.http.post(
      '/identity/v1/oauth2/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope',
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${this.getBasicAuth()}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return data.access_token;
  }

  /**
   * Build the OAuth authorization URL for a user to connect a new eBay store.
   */
  initiateOAuth(state: string): { authUrl: string; state: string } {
    const scopes = [
      'https://api.ebay.com/oauth/api_scope',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.account',
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
      'https://api.ebay.com/oauth/api_scope/sell.marketing',
      'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
    ].join('%20');

    const authUrl =
      `${this.config.authUrl}/oauth2/authorize?` +
      `client_id=${this.config.clientId}` +
      `&redirect_uri=${encodeURIComponent(this.config.redirectUri)}` +
      `&response_type=code` +
      `&scope=${scopes}` +
      `&state=${state}`;

    return { authUrl, state };
  }

  /**
   * Handle the OAuth callback — exchange code for tokens and create a connection + store.
   */
  async handleOAuthCallback(
    code: string,
    state: string,
    userId: string,
  ): Promise<{ connectionId: string; storeId: string }> {
    // Exchange code for tokens
    const { data } = await this.http.post(
      '/identity/v1/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${this.getBasicAuth()}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
      tokenType: data.token_type,
    };

    // Fetch seller identity
    let ebayUserId = 'unknown';
    try {
      const identity = await this.http.get('/commerce/identity/v1/user/', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      ebayUserId = identity.data.username ?? identity.data.userId ?? 'unknown';
    } catch (err) {
      this.logger.warn('Could not fetch eBay identity after OAuth', err);
    }

    // Create connection
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

    // Create store
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

    this.logger.log(
      `Connected eBay account "${ebayUserId}" → connection=${savedConn.id}, store=${savedStore.id}`,
    );

    return { connectionId: savedConn.id, storeId: savedStore.id };
  }

  /**
   * Refresh the token for a specific store and persist the new tokens.
   */
  async refreshToken(storeId: string): Promise<void> {
    const store = await this.storeRepo.findOneByOrFail({ id: storeId });
    const connection = await this.connectionRepo.findOneByOrFail({
      id: store.connectionId,
    });
    const tokens = JSON.parse(
      this.encryption.decrypt(connection.encryptedTokens),
    );

    if (!tokens.refreshToken) {
      throw new Error(`No refresh token available for store ${storeId}`);
    }

    await this.refreshAndStore(connection, tokens.refreshToken);
  }

  /**
   * Internal: refresh token and persist updated credentials.
   */
  private async refreshAndStore(
    connection: ChannelConnection,
    refreshToken: string,
  ): Promise<string> {
    if (!this.config.clientId || !this.config.clientSecret) {
      connection.status = 'error';
      connection.lastError =
        'EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not configured';
      await this.connectionRepo.save(connection);
      throw new UnauthorizedException(
        'eBay API credentials are not configured on the server (EBAY_CLIENT_ID / EBAY_CLIENT_SECRET).',
      );
    }

    try {
      const { data } = await this.http.post(
        '/identity/v1/oauth2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: [
            'https://api.ebay.com/oauth/api_scope',
            'https://api.ebay.com/oauth/api_scope/sell.inventory',
            'https://api.ebay.com/oauth/api_scope/sell.account',
            'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
          ].join(' '),
        }).toString(),
        {
          headers: {
            Authorization: `Basic ${this.getBasicAuth()}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const newTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? refreshToken,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        scope: data.scope,
        tokenType: data.token_type,
      };

      connection.encryptedTokens = this.encryption.encrypt(
        JSON.stringify(newTokens),
      );
      connection.tokenExpiresAt = newTokens.expiresAt;
      connection.status = 'active';
      connection.lastError = null;
      await this.connectionRepo.save(connection);

      this.logger.log(`Refreshed token for connection ${connection.id}`);
      return newTokens.accessToken;
    } catch (err) {
      connection.status = 'error';
      connection.lastError = 'eBay token refresh failed';
      await this.connectionRepo.save(connection);
      throw err;
    }
  }
}
