import { HttpException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { TokenEncryptionService } from '../../channels/token-encryption.service.js';
import type { ChannelConnection } from '../../channels/entities/channel-connection.entity.js';
import type { Store } from '../../channels/entities/store.entity.js';
import type { ConnectedEbayAccount } from '../ebay/entities/connected-ebay-account.entity.js';
import type { EbayOAuthToken } from '../ebay/entities/ebay-oauth-token.entity.js';
import type { SellerpunditAuthService } from './sellerpundit-auth.service.js';
import type { SellerpunditHttpClient } from './sellerpundit-http.client.js';
import type { SellerpunditMarketplaceRegistry } from './sellerpundit-marketplace.registry.js';
import { SellerpunditTokenSyncService } from './sellerpundit-token-sync.service.js';

/* ── Helpers ── */

function createRepo<T extends Record<string, unknown>>() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    findOneByOrFail: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn((d: Partial<T>) => ({ id: 'new-id', ...d } as T)),
    save: jest.fn((d: T) => Promise.resolve({ id: 'saved-id', ...d } as T)),
    update: jest.fn().mockResolvedValue(undefined),
  } as unknown as Repository<T>;
}

function futureDate(minutes = 60): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/* ── Tests ── */

describe('SellerpunditTokenSyncService', () => {
  let svc: SellerpunditTokenSyncService;
  let accountRepo: ReturnType<typeof createRepo<ConnectedEbayAccount>>;
  let tokenRepo: ReturnType<typeof createRepo<EbayOAuthToken>>;
  let connectionRepo: ReturnType<typeof createRepo<ChannelConnection>>;
  let storeRepo: ReturnType<typeof createRepo<Store>>;
  let auth: { getJwt: jest.Mock };
  let http: { get: jest.Mock };
  let encryption: { encrypt: jest.Mock; decrypt: jest.Mock };
  let registry: { resolveMarketplaceForAccount: jest.Mock };

  beforeEach(() => {
    accountRepo = createRepo<ConnectedEbayAccount>();
    tokenRepo = createRepo<EbayOAuthToken>();
    connectionRepo = createRepo<ChannelConnection>();
    storeRepo = createRepo<Store>();
    auth = { getJwt: jest.fn().mockResolvedValue('sp-jwt') };
    http = { get: jest.fn() };
    encryption = {
      encrypt: jest.fn((v: string) => `enc:${v}`),
      decrypt: jest.fn((v: string) => v.replace('enc:', '')),
    };
    registry = { resolveMarketplaceForAccount: jest.fn().mockReturnValue('EBAY_MOTORS_US') };

    svc = new SellerpunditTokenSyncService(
      auth as unknown as SellerpunditAuthService,
      http as unknown as SellerpunditHttpClient,
      encryption as unknown as TokenEncryptionService,
      registry as unknown as SellerpunditMarketplaceRegistry,
      accountRepo,
      tokenRepo,
      connectionRepo,
      storeRepo,
    );
  });

  describe('unwrapTokenList', () => {
    it('handles array response', () => {
      const tokens = [{ id: '1', token: 'tok' }];
      expect(svc.unwrapTokenList(tokens)).toEqual(tokens);
    });

    it('handles {data: []} response', () => {
      const tokens = [{ id: '1', token: 'tok' }];
      expect(svc.unwrapTokenList({ data: tokens })).toEqual(tokens);
    });

    it('handles {data: {data: []}} nested response', () => {
      const tokens = [{ id: '1', token: 'tok' }];
      expect(svc.unwrapTokenList({ data: { data: tokens } })).toEqual(tokens);
    });

    it('returns empty array for unknown format', () => {
      expect(svc.unwrapTokenList(null)).toEqual([]);
      expect(svc.unwrapTokenList('string')).toEqual([]);
      expect(svc.unwrapTokenList({})).toEqual([]);
    });
  });

  describe('ensureFreshAccessToken', () => {
    it('throws for missing account', async () => {
      accountRepo.findOne = jest.fn().mockResolvedValue(null);
      await expect(svc.ensureFreshAccessToken('missing')).rejects.toThrow(HttpException);
    });

    it('throws for disabled account', async () => {
      accountRepo.findOne = jest.fn().mockResolvedValue({
        id: 'acct-1',
        connectionSource: 'sellerpundit',
        connectionStatus: 'disabled',
        oauthToken: { accessTokenExpiresAt: futureDate(120) },
      });

      await expect(svc.ensureFreshAccessToken('acct-1')).rejects.toThrow(/disabled/);
    });
  });

  describe('validateAccountEbayToken', () => {
    it('returns false for non-sellerpundit account', async () => {
      accountRepo.findOne = jest.fn().mockResolvedValue(null);
      const result = await svc.validateAccountEbayToken('acct-1', 'EBAY_US');
      expect(result).toBe(false);
    });

    it('returns false on refresh failure', async () => {
      accountRepo.findOne = jest.fn().mockResolvedValue({
        id: 'acct-1',
        connectionSource: 'sellerpundit',
        sellerpunditTokenId: 'sp-1',
        organizationId: 'org-1',
      });
      auth.getJwt.mockRejectedValue(new Error('auth failed'));

      const result = await svc.validateAccountEbayToken('acct-1', 'EBAY_US');
      expect(result).toBe(false);
    });
  });
});
