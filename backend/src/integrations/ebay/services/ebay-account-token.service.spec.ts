import {
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { EbayAccountTokenService } from './ebay-account-token.service.js';
import type { EbayOAuthToken } from '../entities/ebay-oauth-token.entity.js';
import type { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import type { ChannelConnection } from '../../../channels/entities/channel-connection.entity.js';

/* ── Helpers ── */

function mockConfig(values: Record<string, string> = {}) {
  return {
    get: (key: string, ...args: unknown[]) =>
      values[key] ?? (args.length > 0 ? args[0] : undefined),
  } as unknown as ConfigService;
}

function createMockRepo<T extends Record<string, unknown>>() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    findOneByOrFail: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn((d: Partial<T>) => ({ id: 'new-id', ...d }) as T),
    save: jest.fn((d: T) => Promise.resolve({ id: 'saved-id', ...d } as T)),
    update: jest.fn().mockResolvedValue(undefined),
  } as unknown as Repository<T>;
}

function mockEncryption() {
  return {
    encrypt: jest.fn((v: string) => `enc:${v}`),
    decrypt: jest.fn((v: string) => {
      if (v.startsWith('enc:')) return v.slice(4);
      return v;
    }),
  };
}

function mockRedis() {
  return {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
  };
}

function mockSellerpunditTokens() {
  return {
    ensureFreshAccessToken: jest.fn(),
  };
}

function futureDate(minutesFromNow = 60): string {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

/* ── Tests ── */

describe('EbayAccountTokenService', () => {
  let svc: EbayAccountTokenService;
  let tokenRepo: ReturnType<typeof createMockRepo<EbayOAuthToken>>;
  let accountRepo: ReturnType<typeof createMockRepo<ConnectedEbayAccount>>;
  let connectionRepo: ReturnType<typeof createMockRepo<ChannelConnection>>;
  let encryption: ReturnType<typeof mockEncryption>;
  let redis: ReturnType<typeof mockRedis>;
  let sellerpunditTokens: ReturnType<typeof mockSellerpunditTokens>;

  beforeEach(() => {
    tokenRepo = createMockRepo<EbayOAuthToken>();
    accountRepo = createMockRepo<ConnectedEbayAccount>();
    connectionRepo = createMockRepo<ChannelConnection>();
    encryption = mockEncryption();
    redis = mockRedis();
    sellerpunditTokens = mockSellerpunditTokens();

    svc = new EbayAccountTokenService(
      mockConfig({
        EBAY_CLIENT_ID: 'test-id',
        EBAY_CLIENT_SECRET: 'test-secret',
        EBAY_REDIRECT_URI: 'https://app.example.com/callback',
      }),
      encryption as any,
      redis as any,
      tokenRepo,
      accountRepo,
      connectionRepo,
      sellerpunditTokens as any,
    );
  });

  describe('getValidAccessToken', () => {
    it('returns decrypted token when not near expiry', async () => {
      accountRepo.findOne = jest.fn().mockResolvedValue({
        id: 'acct-1',
        connectionStatus: 'active',
        environment: 'production',
      });
      tokenRepo.findOne = jest.fn().mockResolvedValue({
        accessTokenEncrypted: 'enc:valid-token',
        accessTokenExpiresAt: new Date(futureDate(120)),
        refreshTokenEncrypted: 'enc:refresh-token',
      });

      const result = await svc.getValidAccessToken('acct-1');
      expect(result).toBe('valid-token');
    });

    it('throws for missing account', async () => {
      accountRepo.findOne = jest.fn().mockResolvedValue(null);
      await expect(svc.getValidAccessToken('missing')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws for missing token record', async () => {
      accountRepo.findOne = jest
        .fn()
        .mockResolvedValue({ id: 'acct-1', connectionStatus: 'active' });
      tokenRepo.findOne = jest.fn().mockResolvedValue(null);

      await expect(svc.getValidAccessToken('acct-1')).rejects.toThrow(
        /token record not found/,
      );
    });

    it('throws for disabled account', async () => {
      accountRepo.findOne = jest
        .fn()
        .mockResolvedValue({ id: 'acct-1', connectionStatus: 'disabled' });
      tokenRepo.findOne = jest
        .fn()
        .mockResolvedValue({ accessTokenExpiresAt: new Date(futureDate(120)) });

      await expect(svc.getValidAccessToken('acct-1')).rejects.toThrow(
        /disabled/,
      );
    });

    it('throws for reconnect_required account', async () => {
      accountRepo.findOne = jest.fn().mockResolvedValue({
        id: 'acct-1',
        connectionStatus: 'reconnect_required',
      });
      tokenRepo.findOne = jest
        .fn()
        .mockResolvedValue({ accessTokenExpiresAt: new Date(futureDate(120)) });

      await expect(svc.getValidAccessToken('acct-1')).rejects.toThrow(
        /reconnect/,
      );
    });

    it('throws for token with reconnectRequired flag', async () => {
      accountRepo.findOne = jest
        .fn()
        .mockResolvedValue({ id: 'acct-1', connectionStatus: 'active' });
      tokenRepo.findOne = jest.fn().mockResolvedValue({
        accessTokenExpiresAt: new Date(futureDate(120)),
        reconnectRequired: true,
      });

      await expect(svc.getValidAccessToken('acct-1')).rejects.toThrow(
        /reconnect/,
      );
    });

    it('delegates to sellerpunditTokens for sellerpundit accounts', async () => {
      accountRepo.findOne = jest.fn().mockResolvedValue({
        id: 'acct-1',
        connectionStatus: 'active',
        connectionSource: 'sellerpundit',
      });
      tokenRepo.findOne = jest.fn().mockResolvedValue({
        accessTokenExpiresAt: new Date(futureDate(120)),
      });
      sellerpunditTokens.ensureFreshAccessToken.mockResolvedValue('sp-token');

      const result = await svc.getValidAccessToken('acct-1');
      expect(result).toBe('sp-token');
      expect(sellerpunditTokens.ensureFreshAccessToken).toHaveBeenCalledWith(
        'acct-1',
      );
    });

    it('acquires Redis lock and refreshes when token near expiry', async () => {
      accountRepo.findOne = jest.fn().mockResolvedValue({
        id: 'acct-1',
        connectionStatus: 'active',
        environment: 'production',
        channelConnectionId: 'conn-1',
      });
      tokenRepo.findOne = jest.fn().mockResolvedValue({
        accessTokenEncrypted: 'enc:old-token',
        accessTokenExpiresAt: new Date(futureDate(5)), // near expiry
        refreshTokenEncrypted: 'enc:refresh-token',
      });
      redis.set = jest.fn().mockResolvedValue('OK'); // lock acquired

      // Mock axios.post for refresh
      const axios = require('axios');
      const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({
        data: {
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_in: 7200,
        },
      });

      tokenRepo.findOneOrFail = jest.fn().mockResolvedValue({
        accessTokenEncrypted: 'enc:old-token',
        refreshTokenEncrypted: 'enc:refresh-token',
        accessTokenExpiresAt: new Date(futureDate(5)),
      });
      accountRepo.findOneByOrFail = jest.fn().mockResolvedValue({
        id: 'acct-1',
        channelConnectionId: 'conn-1',
      });
      connectionRepo.findOneByOrFail = jest
        .fn()
        .mockResolvedValue({ id: 'conn-1' });

      const result = await svc.getValidAccessToken('acct-1');
      expect(result).toBe('new-token');
      expect(redis.set).toHaveBeenCalledWith(
        'ebay-token-refresh:acct-1',
        '1',
        'EX',
        45,
        'NX',
      );
      expect(redis.del).toHaveBeenCalledWith('ebay-token-refresh:acct-1');

      postSpy.mockRestore();
    });

    it('waits for lock release and returns refreshed token (poll pattern)', async () => {
      accountRepo.findOne = jest.fn().mockResolvedValue({
        id: 'acct-1',
        connectionStatus: 'active',
        environment: 'production',
      });
      tokenRepo.findOne = jest
        .fn()
        .mockResolvedValueOnce({
          accessTokenEncrypted: 'enc:old-token',
          accessTokenExpiresAt: new Date(futureDate(5)),
          refreshTokenEncrypted: 'enc:refresh-token',
        })
        // Second call (poll) returns refreshed token
        .mockResolvedValueOnce({
          accessTokenEncrypted: 'enc:refreshed-by-other-worker',
          accessTokenExpiresAt: new Date(futureDate(120)),
        });
      redis.set = jest.fn().mockResolvedValue(null); // lock NOT acquired

      const result = await svc.getValidAccessToken('acct-1');
      expect(result).toBe('refreshed-by-other-worker');
    });
  });

  describe('getDefaultScopes', () => {
    it('returns hardcoded defaults when EBAY_SCOPES is empty', () => {
      const scopes = svc.getDefaultScopes();
      expect(scopes).toContain(
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
      );
      expect(scopes).toContain(
        'https://api.ebay.com/oauth/api_scope/sell.account',
      );
      expect(scopes).toContain(
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
      );
      expect(scopes).toHaveLength(6);
    });

    it('parses EBAY_SCOPES env var when set', () => {
      const customSvc = new EbayAccountTokenService(
        mockConfig({ EBAY_SCOPES: 'scope1 scope2 scope3' }),
        encryption as any,
        redis as any,
        tokenRepo,
        accountRepo,
        connectionRepo,
        sellerpunditTokens as any,
      );
      expect(customSvc.getDefaultScopes()).toEqual([
        'scope1',
        'scope2',
        'scope3',
      ]);
    });
  });

  describe('buildAuthorizeUrl', () => {
    it('builds URL with all scopes for production', () => {
      const url = svc.buildAuthorizeUrl({
        state: 'my-state',
        environment: 'production',
      });
      expect(url).toContain('https://auth.ebay.com/oauth2/authorize');
      expect(url).toContain('client_id=test-id');
      expect(url).toContain('state=my-state');
      expect(url).toContain('sell.inventory');
    });

    it('uses sandbox host for sandbox environment', () => {
      const url = svc.buildAuthorizeUrl({ state: 's', environment: 'sandbox' });
      expect(url).toContain('https://auth.sandbox.ebay.com/oauth2/authorize');
    });
  });
});
