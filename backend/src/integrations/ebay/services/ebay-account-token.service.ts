import {
  Injectable,
  Logger,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import axios from 'axios';
import type Redis from 'ioredis';
import { TokenEncryptionService } from '../../../channels/token-encryption.service.js';
import { ChannelConnection } from '../../../channels/entities/channel-connection.entity.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayOAuthToken } from '../entities/ebay-oauth-token.entity.js';
import { EBAY_INTEGRATIONS_REDIS } from '../ebay-integrations-redis.connection.js';
import { SellerpunditTokenSyncService } from '../../sellerpundit/sellerpundit-token-sync.service.js';

interface TokenBlob {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope?: string;
  tokenType?: string;
}

@Injectable()
export class EbayAccountTokenService {
  private readonly logger = new Logger(EbayAccountTokenService.name);
  private readonly refreshBufferMs = 30 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly encryption: TokenEncryptionService,
    @Inject(EBAY_INTEGRATIONS_REDIS) private readonly redis: Redis,
    @InjectRepository(EbayOAuthToken)
    private readonly tokenRepo: Repository<EbayOAuthToken>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(ChannelConnection)
    private readonly connectionRepo: Repository<ChannelConnection>,
    private readonly sellerpunditTokens: SellerpunditTokenSyncService,
  ) {}

  private getOAuthBase(environment: 'sandbox' | 'production'): string {
    return environment === 'production'
      ? 'https://api.ebay.com'
      : 'https://api.sandbox.ebay.com';
  }

  private getAuthHost(environment: 'sandbox' | 'production'): string {
    return environment === 'production'
      ? 'https://auth.ebay.com'
      : 'https://auth.sandbox.ebay.com';
  }

  private basicAuthHeader(): string {
    const id = this.config.get<string>('EBAY_CLIENT_ID', '');
    const secret = this.config.get<string>('EBAY_CLIENT_SECRET', '');
    return Buffer.from(`${id}:${secret}`).toString('base64');
  }

  async getValidAccessToken(ebayAccountId: string): Promise<string> {
    const account = await this.accountRepo.findOne({
      where: { id: ebayAccountId },
      relations: ['oauthToken'],
    });
    if (!account || !account.oauthToken) {
      throw new UnauthorizedException('eBay account or token record not found');
    }
    if (account.connectionStatus === 'disabled') {
      throw new UnauthorizedException('eBay account is disabled');
    }
    if (
      account.connectionStatus === 'reconnect_required' ||
      account.oauthToken.reconnectRequired
    ) {
      throw new UnauthorizedException('eBay reconnect required');
    }

    if (account.connectionSource === 'sellerpundit') {
      return this.sellerpunditTokens.ensureFreshAccessToken(ebayAccountId);
    }

    const row = account.oauthToken;
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
        if (
          refreshed &&
          new Date(refreshed.accessTokenExpiresAt).getTime() - Date.now() >
            this.refreshBufferMs
        ) {
          return this.encryption.decrypt(refreshed.accessTokenEncrypted);
        }
      }
      throw new ServiceUnavailableException('Timed out waiting for token refresh lock');
    }

    try {
      return await this.refreshLocked(account.id, account.environment);
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private async refreshLocked(
    ebayAccountId: string,
    environment: 'sandbox' | 'production',
  ): Promise<string> {
    const row = await this.tokenRepo.findOneOrFail({ where: { ebayAccountId } });
    const refreshToken = this.encryption.decrypt(row.refreshTokenEncrypted);
    if (!refreshToken) {
      row.reconnectRequired = true;
      await this.tokenRepo.save(row);
      throw new UnauthorizedException('Missing refresh token');
    }

    const oauthBase = this.getOAuthBase(environment);
    try {
      const { data } = await axios.post(
        `${oauthBase}/identity/v1/oauth2/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: this.getDefaultScopes().join(' '),
        }).toString(),
        {
          headers: {
            Authorization: `Basic ${this.basicAuthHeader()}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30_000,
        },
      );

      const updated: TokenBlob = {
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

      const account = await this.accountRepo.findOneByOrFail({ id: ebayAccountId });
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
    } catch (e: unknown) {
      this.logger.warn(`Token refresh failed for account ${ebayAccountId}`, e);
      row.reconnectRequired = true;
      await this.tokenRepo.save(row);
      await this.accountRepo.update(ebayAccountId, {
        connectionStatus: 'reconnect_required',
      });
      throw new UnauthorizedException('eBay token refresh failed — reconnect required');
    }
  }

  getDefaultScopes(): string[] {
    const raw = this.config.get<string>('EBAY_SCOPES', '').trim();
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

  buildAuthorizeUrl(params: {
    state: string;
    environment: 'sandbox' | 'production';
  }): string {
    const clientId = this.config.get<string>('EBAY_CLIENT_ID', '');
    const redirectUri = this.config.get<string>('EBAY_REDIRECT_URI', '');
    const scopes = this.getDefaultScopes()
      .map((s) => encodeURIComponent(s))
      .join('%20');
    const host = this.getAuthHost(params.environment);
    return (
      `${host}/oauth2/authorize?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scopes}` +
      `&state=${encodeURIComponent(params.state)}`
    );
  }

  async exchangeCode(params: {
    code: string;
    environment: 'sandbox' | 'production';
  }): Promise<{ tokens: TokenBlob }> {
    const oauthBase = this.getOAuthBase(params.environment);
    const { data } = await axios.post(
      `${oauthBase}/identity/v1/oauth2/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: this.config.get<string>('EBAY_REDIRECT_URI', ''),
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${this.basicAuthHeader()}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30_000,
      },
    );

    const tokens: TokenBlob = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      scope: data.scope,
      tokenType: data.token_type,
    };
    return { tokens };
  }
}
