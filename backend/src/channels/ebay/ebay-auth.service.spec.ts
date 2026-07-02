import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { EbayAuthService } from './ebay-auth.service.js';
import type { ChannelConnection } from '../entities/channel-connection.entity.js';
import type { Store } from '../entities/store.entity.js';
import type { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';

/* ── Helpers ── */

function mockConfig(values: Record<string, string> = {}) {
  return {
    get: (key: string, ...args: unknown[]) =>
      values[key] ?? (args.length > 0 ? args[0] : undefined),
  } as unknown as ConfigService;
}

function createRepo<T extends Record<string, unknown>>() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    findOneByOrFail: jest.fn(),
    create: jest.fn((d: Partial<T>) => ({ id: 'new-id', ...d } as T)),
    save: jest.fn((d: T) => Promise.resolve({ id: 'saved-id', ...d } as T)),
    update: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  } as unknown as Repository<T>;
}

function mockEncryption() {
  return {
    encrypt: jest.fn((v: string) => `enc:${v}`),
    decrypt: jest.fn((v: string) => v.replace('enc:', '')),
  };
}

function mockSellerpunditTokens() {
  return {
    ensureFreshAccessToken: jest.fn(),
    refreshTokenFromSellerpundit: jest.fn(),
  };
}

/* ── Tests ── */

describe('EbayAuthService', () => {
  let svc: EbayAuthService;
  let connectionRepo: ReturnType<typeof createRepo<ChannelConnection>>;
  let storeRepo: ReturnType<typeof createRepo<Store>>;
  let connectedAccountRepo: ReturnType<typeof createRepo<ConnectedEbayAccount>>;
  let encryption: ReturnType<typeof mockEncryption>;
  let sellerpunditTokens: ReturnType<typeof mockSellerpunditTokens>;

  beforeEach(() => {
    connectionRepo = createRepo<ChannelConnection>();
    storeRepo = createRepo<Store>();
    connectedAccountRepo = createRepo<ConnectedEbayAccount>();
    encryption = mockEncryption();
    sellerpunditTokens = mockSellerpunditTokens();

    svc = new EbayAuthService(
      mockConfig({
        EBAY_CLIENT_ID: 'test-client-id',
        EBAY_CLIENT_SECRET: 'test-client-secret',
        EBAY_REDIRECT_URI: 'https://app.example.com/callback',
        EBAY_ENVIRONMENT: 'PRODUCTION',
      }) as ConfigService,
      encryption as any,
      sellerpunditTokens as any,
      connectionRepo,
      storeRepo,
      connectedAccountRepo,
    );
  });

  describe('getApiConfig', () => {
    it('returns production config when EBAY_ENVIRONMENT=PRODUCTION', () => {
      const cfg = svc.getApiConfig();
      expect(cfg.clientId).toBe('test-client-id');
      expect(cfg.sandbox).toBe(false);
      expect(cfg.baseUrl).toBe('https://api.ebay.com');
      expect(cfg.authUrl).toBe('https://auth.ebay.com');
    });

    it('returns sandbox config when EBAY_ENVIRONMENT is not PRODUCTION', () => {
      const sandboxSvc = new EbayAuthService(
        mockConfig({
          EBAY_CLIENT_ID: 'id',
          EBAY_CLIENT_SECRET: 'secret',
          EBAY_ENVIRONMENT: 'SANDBOX',
        }) as ConfigService,
        encryption as any,
        sellerpunditTokens as any,
        connectionRepo,
        storeRepo,
        connectedAccountRepo,
      );
      const cfg = sandboxSvc.getApiConfig();
      expect(cfg.sandbox).toBe(true);
      expect(cfg.baseUrl).toBe('https://api.sandbox.ebay.com');
    });
  });

  describe('getAccessToken', () => {
    it('returns decrypted token when not near expiry', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      storeRepo.findOne = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'Test Store',
        connectionId: 'conn-1',
        connection: {
          id: 'conn-1',
          encryptedTokens: `enc:${JSON.stringify({ accessToken: 'tok-abc', expiresAt: futureDate.toISOString() })}`,
        },
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);

      const token = await svc.getAccessToken('store-1');
      expect(token).toBe('tok-abc');
    });

    it('triggers proactive refresh when within 30min buffer', async () => {
      const nearExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
      storeRepo.findOne = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'Test Store',
        connectionId: 'conn-1',
        connection: {
          id: 'conn-1',
          encryptedTokens: `enc:${JSON.stringify({ accessToken: 'old-tok', refreshToken: 'ref-tok', expiresAt: nearExpiry.toISOString() })}`,
        },
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);

      // Mock refresh to succeed
      const httpPost = jest.fn().mockResolvedValue({
        data: { access_token: 'new-tok', refresh_token: 'new-ref', expires_in: 7200, scope: 'x', token_type: 'Bearer' },
      });
      (svc as any).http = { post: httpPost };

      const token = await svc.getAccessToken('store-1');
      expect(token).toBe('new-tok');
      expect(connectionRepo.save).toHaveBeenCalled();
    });

    it('throws UnauthorizedException when no refresh token available', async () => {
      const nearExpiry = new Date(Date.now() + 10 * 60 * 1000);
      storeRepo.findOne = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'Test Store',
        connectionId: 'conn-1',
        connection: {
          id: 'conn-1',
          encryptedTokens: `enc:${JSON.stringify({ accessToken: 'old', expiresAt: nearExpiry.toISOString() })}`,
          // no refreshToken
        },
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);

      await expect(svc.getAccessToken('store-1')).rejects.toThrow(UnauthorizedException);
    });

    it('delegates to sellerpunditTokens for SellerPundit accounts', async () => {
      storeRepo.findOne = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'SP Store',
        connectionId: 'conn-1',
        connection: { id: 'conn-1', encryptedTokens: 'enc:{}' },
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue({
        id: 'acct-1',
        connectionSource: 'sellerpundit',
      });
      sellerpunditTokens.ensureFreshAccessToken.mockResolvedValue('sp-token');

      const token = await svc.getAccessToken('store-1');
      expect(token).toBe('sp-token');
      expect(sellerpunditTokens.ensureFreshAccessToken).toHaveBeenCalledWith('acct-1', { force: false });
    });

    it('wraps SellerPundit errors with hint', async () => {
      storeRepo.findOne = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'SP Store',
        connectionId: 'conn-1',
        connection: { id: 'conn-1', encryptedTokens: 'enc:{}' },
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue({
        id: 'acct-1',
        connectionSource: 'sellerpundit',
      });
      sellerpunditTokens.ensureFreshAccessToken.mockRejectedValue(new Error('network'));

      await expect(svc.getAccessToken('store-1')).rejects.toThrow(/SellerPundit/);
    });

    it('throws for missing store', async () => {
      storeRepo.findOne = jest.fn().mockResolvedValue(null);
      await expect(svc.getAccessToken('missing')).rejects.toThrow(/not found/);
    });
  });

  describe('getApiBaseUrlForStore', () => {
    it('returns production URL for production linked account', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({ id: 'store-1', connectionId: 'conn-1' });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue({ environment: 'production' });

      const url = await svc.getApiBaseUrlForStore('store-1');
      expect(url).toBe('https://api.ebay.com');
    });

    it('returns sandbox URL for sandbox linked account', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({ id: 'store-1', connectionId: 'conn-1' });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue({ environment: 'sandbox' });

      const url = await svc.getApiBaseUrlForStore('store-1');
      expect(url).toBe('https://api.sandbox.ebay.com');
    });

    it('falls back to config.baseUrl when no store found', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue(null);

      const url = await svc.getApiBaseUrlForStore('missing');
      expect(url).toBe('https://api.ebay.com');
    });
  });

  describe('initiateOAuth', () => {
    it('builds correct auth URL with all scopes', () => {
      const result = svc.initiateOAuth('test-state');
      expect(result.authUrl).toContain('client_id=test-client-id');
      expect(result.authUrl).toContain('response_type=code');
      expect(result.authUrl).toContain('state=test-state');
      expect(result.authUrl).toContain('sell.inventory');
      expect(result.authUrl).toContain('sell.account');
      expect(result.authUrl).toContain('sell.fulfillment');
      expect(result.authUrl).toContain('commerce.identity.readonly');
      expect(result.state).toBe('test-state');
    });
  });

  describe('wrapTokenError', () => {
    it('formats Axios 401 error', () => {
      const axiosErr = Object.assign(new Error('Request failed'), {
        response: { status: 401 },
        isAxiosError: true,
      });
      const result = (svc as any).wrapTokenError('MyStore', axiosErr, 'hint text');
      expect(result).toBeInstanceOf(UnauthorizedException);
      expect(result.message).toContain('hint text');
    });

    it('passes through UnauthorizedException unchanged', () => {
      const orig = new UnauthorizedException('original');
      const result = (svc as any).wrapTokenError('MyStore', orig, 'hint');
      expect(result).toBe(orig);
    });

    it('wraps generic errors with hint and message', () => {
      const result = (svc as any).wrapTokenError('MyStore', new Error('timeout'), 'hint text');
      expect(result).toBeInstanceOf(UnauthorizedException);
      expect(result.message).toContain('hint text');
      expect(result.message).toContain('timeout');
    });
  });
});
