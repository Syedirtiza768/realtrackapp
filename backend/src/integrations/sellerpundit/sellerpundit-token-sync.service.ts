import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenEncryptionService } from '../../channels/token-encryption.service.js';
import { ChannelConnection } from '../../channels/entities/channel-connection.entity.js';
import { ConnectedEbayAccount } from '../ebay/entities/connected-ebay-account.entity.js';
import { EbayOAuthToken } from '../ebay/entities/ebay-oauth-token.entity.js';
import { SellerpunditAuthService } from './sellerpundit-auth.service.js';
import { SellerpunditHttpClient } from './sellerpundit-http.client.js';
import type { SellerpunditTokenRow } from './sellerpundit.types.js';
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
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayOAuthToken)
    private readonly tokenRepo: Repository<EbayOAuthToken>,
    @InjectRepository(ChannelConnection)
    private readonly connectionRepo: Repository<ChannelConnection>,
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
      throw new UnauthorizedException('SellerPundit account or token not found');
    }
    if (account.connectionStatus === 'disabled') {
      throw new UnauthorizedException('eBay account is disabled');
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
      throw new UnauthorizedException('Missing SellerPundit token id on account');
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
      throw new UnauthorizedException('SellerPundit store not found — re-import stores');
    }

    await this.persistTokenRow(account, match);
  }

  async persistTokenRow(
    account: ConnectedEbayAccount,
    row: SellerpunditTokenRow,
  ): Promise<void> {
    const accessToken = (row.token ?? row.accessToken ?? '').trim();
    if (!accessToken) {
      throw new UnauthorizedException('SellerPundit returned empty access token');
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
      conn.status = 'active';
      conn.lastError = null;
      await this.connectionRepo.save(conn);
    }

    await this.accountRepo.update(account.id, {
      lastTokenRefreshAt: oauth.lastRefreshedAt,
      sellerpunditLastSyncAt: new Date(),
      connectionStatus: 'active',
      lastErrorMessage: null,
    });
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
