import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { isAxiosError } from 'axios';
import { Repository } from 'typeorm';
import { TokenEncryptionService } from '../../channels/token-encryption.service.js';
import { ChannelConnection } from '../../channels/entities/channel-connection.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../ebay/entities/connected-ebay-account.entity.js';
import { EbayOAuthToken } from '../ebay/entities/ebay-oauth-token.entity.js';
import { SellerpunditAuthService } from './sellerpundit-auth.service.js';
import { SellerpunditHttpClient } from './sellerpundit-http.client.js';
import { SellerpunditMarketplaceRegistry } from './sellerpundit-marketplace.registry.js';
import type { SellerpunditTokenRow } from './sellerpundit.types.js';
import { isEbayInvalidAccessTokenError } from '../../channels/ebay/ebay-api-error.util.js';
import {
  computeSellerpunditAccessTokenExpiry,
  sellerpunditTokenNeedsRefresh,
} from './sellerpundit-token-expiry.util.js';

@Injectable()
export class SellerpunditTokenSyncService {
  private readonly logger = new Logger(SellerpunditTokenSyncService.name);

  constructor(
    private readonly auth: SellerpunditAuthService,
    private readonly http: SellerpunditHttpClient,
    private readonly encryption: TokenEncryptionService,
    private readonly registry: SellerpunditMarketplaceRegistry,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayOAuthToken)
    private readonly tokenRepo: Repository<EbayOAuthToken>,
    @InjectRepository(ChannelConnection)
    private readonly connectionRepo: Repository<ChannelConnection>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  async ensureFreshAccessToken(
    ebayAccountId: string,
    options?: { force?: boolean },
  ): Promise<string> {
    const account = await this.accountRepo.findOne({
      where: { id: ebayAccountId, connectionSource: 'sellerpundit' },
      relations: ['oauthToken'],
    });
    if (!account?.oauthToken) {
      throw new HttpException('SellerPundit account or token not found', 502);
    }
    if (account.connectionStatus === 'disabled') {
      throw new HttpException('eBay account is disabled', 502);
    }

    const row = account.oauthToken;
    if (!sellerpunditTokenNeedsRefresh(row, options)) {
      return this.encryption.decrypt(row.accessTokenEncrypted);
    }

    await this.refreshTokenFromSellerpundit(account);
    const updated = await this.tokenRepo.findOneOrFail({ where: { ebayAccountId } });
    return this.encryption.decrypt(updated.accessTokenEncrypted);
  }

  async refreshTokenFromSellerpundit(account: ConnectedEbayAccount): Promise<void> {
    if (!account.sellerpunditTokenId) {
      throw new HttpException('Missing SellerPundit token id on account', 502);
    }

    const jwt = await this.auth.getJwt(account.organizationId);
    const raw = await this.http.get<unknown>(jwt, '/token/get-all-tokens');
    const tokens = this.unwrapTokenList(raw);
    const match = tokens.find((t) => t.id === account.sellerpunditTokenId);
    if (!match) {
      await this.accountRepo.update(account.id, {
        connectionStatus: 'reconnect_required',
        lastErrorMessage: 'SellerPundit token no longer returned for this store',
      });
      throw new HttpException('SellerPundit store not found — re-import stores', 502);
    }

    await this.persistTokenRow(account, match);
  }

  async persistTokenRow(
    account: ConnectedEbayAccount,
    row: SellerpunditTokenRow,
  ): Promise<void> {
    const accessToken = (row.token ?? row.accessToken ?? '').trim();
    if (!accessToken) {
      throw new HttpException('SellerPundit returned empty access token', 502);
    }

    const expiresAt = computeSellerpunditAccessTokenExpiry(row);
    const refreshToken = row.refreshToken?.trim() ?? '';

    let oauth = await this.tokenRepo.findOne({ where: { ebayAccountId: account.id } });
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
    oauth.lastRefreshedAt = Number.isNaN(refreshedAt.getTime()) ? new Date() : refreshedAt;

    if (expiresAt.getTime() <= Date.now()) {
      this.logger.warn(
        `SellerPundit token ${row.id} for "${account.ebayUsername ?? account.id}" appears expired per SellerPundit metadata — re-sync stores in SellerPundit if publish fails`,
      );
    }
    oauth.reconnectRequired = false;
    await this.tokenRepo.save(oauth);

    const ebayTokenValid = await this.probeEbayAccessToken(
      accessToken,
      account.environment ?? 'production',
      await this.resolveProbeMarketplaceId(account),
    );
    if (!ebayTokenValid) {
      oauth.reconnectRequired = true;
      await this.tokenRepo.save(oauth);
      this.logger.warn(
        `SellerPundit token ${row.id} for "${account.ebayUsername ?? account.accountDisplayName ?? account.id}" is not accepted by eBay — reconnect eBay in SellerPundit, then re-sync stores`,
      );
    }

    const conn = await this.connectionRepo.findOneBy({ id: account.channelConnectionId });
    if (conn) {
      conn.encryptedTokens = this.encryption.encrypt(
        JSON.stringify({
          accessToken,
          refreshToken,
          expiresAt: expiresAt.toISOString(),
        }),
      );
      conn.tokenExpiresAt = expiresAt;
      conn.status = ebayTokenValid ? 'active' : 'error';
      conn.lastError = ebayTokenValid
        ? null
        : 'eBay rejected SellerPundit OAuth token — reconnect in SellerPundit';
      await this.connectionRepo.save(conn);
    }

    const newConnectionStatus = ebayTokenValid ? 'active' as const : 'reconnect_required' as const;
    const newErrorMessage = ebayTokenValid
      ? null
      : 'eBay rejected SellerPundit OAuth token — reconnect eBay in SellerPundit, then Re-sync stores';
    await this.accountRepo.update(account.id, {
      lastTokenRefreshAt: oauth.lastRefreshedAt,
      sellerpunditLastSyncAt: new Date(),
      connectionStatus: newConnectionStatus,
      lastErrorMessage: newErrorMessage,
    });
    // Also update the in-memory entity so callers that save() it afterwards don't overwrite the status.
    account.lastTokenRefreshAt = oauth.lastRefreshedAt;
    account.sellerpunditLastSyncAt = new Date();
    account.connectionStatus = newConnectionStatus;
    account.lastErrorMessage = newErrorMessage;
  }

  /** Live-check whether SellerPundit’s cached eBay user token works for Inventory API. */
  async validateAccountEbayToken(
    ebayAccountId: string,
    marketplaceId: string,
  ): Promise<boolean> {
    const account = await this.accountRepo.findOne({
      where: { id: ebayAccountId, connectionSource: 'sellerpundit' },
    });
    if (!account) return false;
    try {
      await this.refreshTokenFromSellerpundit(account);
      const oauth = await this.tokenRepo.findOneByOrFail({ ebayAccountId });
      const accessToken = this.encryption.decrypt(oauth.accessTokenEncrypted);
      return this.probeEbayAccessToken(
        accessToken,
        account.environment ?? 'production',
        marketplaceId,
      );
    } catch {
      return false;
    }
  }

  private async resolveProbeMarketplaceId(
    account: ConnectedEbayAccount,
  ): Promise<string> {
    if (account.primaryStoreId) {
      const store = await this.storeRepo.findOneBy({ id: account.primaryStoreId });
      if (store?.ebayMarketplaceId?.trim()) {
        return store.ebayMarketplaceId.trim();
      }
    }
    return this.registry.resolveMarketplaceForAccount(
      account.sellerpunditAccountName ?? account.accountDisplayName ?? '',
      'EBAY_MOTORS_US',
    );
  }

  private async probeEbayAccessToken(
    accessToken: string,
    environment: 'sandbox' | 'production',
    marketplaceId: string,
  ): Promise<boolean> {
    const baseUrl =
      environment === 'sandbox'
        ? 'https://api.sandbox.ebay.com'
        : 'https://api.ebay.com';
    try {
      const { status, data } = await axios.get(
        `${baseUrl}/sell/inventory/v1/inventory_item`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
            Accept: 'application/json',
          },
          params: { limit: 1 },
          timeout: 15_000,
          validateStatus: () => true,
        },
      );
      if (status === 200) return true;
      if (status === 401 && isEbayInvalidAccessTokenError({ response: { status, data } })) {
        return false;
      }
      return status >= 200 && status < 500;
    } catch (err: unknown) {
      if (isEbayInvalidAccessTokenError(err)) return false;
      if (isAxiosError(err) && err.response?.status === 401) return false;
      return false;
    }
  }

  unwrapTokenList(raw: unknown): SellerpunditTokenRow[] {
    if (Array.isArray(raw)) return raw as SellerpunditTokenRow[];
    if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      if (Array.isArray(o.data)) return o.data as SellerpunditTokenRow[];
      if (o.data && typeof o.data === 'object' && Array.isArray((o.data as { data?: unknown }).data)) {
        return (o.data as { data: SellerpunditTokenRow[] }).data;
      }
    }
    return [];
  }
}
