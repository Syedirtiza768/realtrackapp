import axios from 'axios';
import { ChannelConnection } from '../../../channels/entities/channel-connection.entity.js';
import { Store } from '../../../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayOAuthToken } from '../entities/ebay-oauth-token.entity.js';
import {
  EbayIntegrationsOAuthService,
  EbayOAuthCallbackFailure,
  identityMatchesAccount,
  isPlaceholderEbayUserId,
} from './ebay-integrations-oauth.service.js';
import type { EbayOAuthPendingPayload } from './ebay-oauth-state.store.js';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const mockedGet = axios.get as jest.Mock;

const ACCOUNT_ID = '6629dbd3-0de8-48ad-b304-521661f307f6';
const ORG_ID = 'ac9d11b5-0000-0000-0000-000000000000';

function repo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((d: Record<string, unknown>) => ({ ...d })),
    save: jest.fn((d: Record<string, unknown>) =>
      Promise.resolve({ id: 'saved-id', ...d }),
    ),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

function existingAccount(overrides: Partial<ConnectedEbayAccount> = {}) {
  return {
    id: ACCOUNT_ID,
    organizationId: ORG_ID,
    channelConnectionId: 'conn-1',
    primaryStoreId: 'store-1',
    ebayUserId: 'unknown_1789469864613',
    ebayUsername: null,
    accountDisplayName: 'Artistic Haul',
    environment: 'production',
    connectionStatus: 'reconnect_required',
    connectionSource: 'native_oauth',
    ...overrides,
  } as ConnectedEbayAccount;
}

function setup(pending: Partial<EbayOAuthPendingPayload> = {}) {
  const payload: EbayOAuthPendingPayload = {
    userId: 'user-1',
    organizationId: ORG_ID,
    internalStoreId: null,
    marketplaceId: 'EBAY_US',
    environment: 'production',
    scopes: [],
    accountDisplayName: 'Artistic Haul',
    vertical: 'fashion',
    reconnectAccountId: ACCOUNT_ID,
    ...pending,
  };
  const stateStore = { consume: jest.fn().mockResolvedValue(payload) };
  const tokenService = {
    exchangeCode: jest.fn().mockResolvedValue({
      tokens: {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresAt: '2026-11-12T20:00:00.000Z',
        scope: 'https://api.ebay.com/oauth/api_scope',
      },
    }),
    getDefaultScopes: jest.fn().mockReturnValue([]),
  };
  const encryption = { encrypt: jest.fn((v: string) => `enc:${v}`) };
  const logWriter = { write: jest.fn().mockResolvedValue(undefined) };
  const policySync = {
    syncPolicies: jest.fn().mockResolvedValue({ synced: 0, message: '' }),
  };
  const connectionRepo = repo();
  const storeRepo = repo();
  const accountRepo = repo();
  const oauthRepo = repo();
  const mpRepo = repo();
  const policyRepo = repo();

  // Transaction-scoped repositories, keyed by entity.
  const txRepos = new Map<unknown, ReturnType<typeof repo>>([
    [EbayOAuthToken, repo()],
    [ChannelConnection, repo()],
    [ConnectedEbayAccount, repo()],
    [Store, repo()],
  ]);
  const dataSource = {
    transaction: jest.fn(
      async (cb: (m: { getRepository: (e: unknown) => unknown }) => unknown) =>
        cb({ getRepository: (e: unknown) => txRepos.get(e) }),
    ),
    createQueryRunner: jest.fn(),
  };

  const service = new EbayIntegrationsOAuthService(
    stateStore as never,
    tokenService as never,
    encryption as never,
    { all: jest.fn().mockReturnValue([]), require: jest.fn() } as never,
    dataSource as never,
    logWriter as never,
    policySync as never,
    connectionRepo as never,
    storeRepo as never,
    accountRepo as never,
    oauthRepo as never,
    mpRepo as never,
    policyRepo as never,
  );
  return {
    service,
    accountRepo,
    storeRepo,
    policyRepo,
    dataSource,
    txRepos,
    logWriter,
  };
}

/** Route axios.get by URL: identity answer and per-type policy lists. */
function ebayAnswers(opts: {
  identity?: { userId?: string; username?: string } | 'fail';
  policies?: Record<string, string[]>;
}) {
  mockedGet.mockImplementation((url: string) => {
    if (url.includes('/commerce/identity/v1/user/')) {
      if (opts.identity === 'fail' || !opts.identity)
        return Promise.reject(
          Object.assign(new Error('404'), { response: { status: 404 } }),
        );
      return Promise.resolve({ data: opts.identity });
    }
    const match = /\/sell\/account\/v1\/(\w+)_policy$/.exec(url);
    if (match) {
      const type = match[1];
      const ids = opts.policies?.[type] ?? [];
      const list = `${type}Policies`;
      const idField = `${type}PolicyId`;
      return Promise.resolve({
        data: { [list]: ids.map((id) => ({ [idField]: id })) },
      });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

describe('EbayIntegrationsOAuthService reconnect', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedGet.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('calls the Identity API on apiz.ebay.com', async () => {
    const t = setup();
    t.accountRepo.findOne.mockResolvedValueOnce(
      existingAccount({ ebayUserId: 'seller-123' }),
    );
    ebayAnswers({
      identity: { userId: 'seller-123', username: 'artistichaul' },
    });
    await t.service.handleCallback({ code: 'c', state: 's' });
    expect(mockedGet).toHaveBeenCalledWith(
      'https://apiz.ebay.com/commerce/identity/v1/user/',
      expect.anything(),
    );
  });

  it('refreshes tokens on the same account and creates no new store or account', async () => {
    const t = setup();
    t.accountRepo.findOne.mockResolvedValueOnce(
      existingAccount({ ebayUserId: 'seller-123' }),
    );
    ebayAnswers({
      identity: { userId: 'seller-123', username: 'artistichaul' },
    });

    const result = await t.service.handleCallback({ code: 'c', state: 's' });

    expect(result).toEqual({
      connectedEbayAccountId: ACCOUNT_ID,
      redirectUrl: '/fashion/stores',
    });
    expect(t.dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(t.storeRepo.create).not.toHaveBeenCalled();
    expect(t.accountRepo.create).not.toHaveBeenCalled();

    const tokenSave = t.txRepos.get(EbayOAuthToken)!.save.mock.calls[0][0];
    expect(tokenSave).toMatchObject({
      ebayAccountId: ACCOUNT_ID,
      accessTokenEncrypted: 'enc:new-access',
      refreshTokenEncrypted: 'enc:new-refresh',
      reconnectRequired: false,
    });
    expect(t.txRepos.get(ConnectedEbayAccount)!.update).toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.objectContaining({
        connectionStatus: 'active',
        ebayUsername: 'artistichaul',
      }),
    );
    expect(t.txRepos.get(ChannelConnection)!.update).toHaveBeenCalledWith(
      'conn-1',
      expect.objectContaining({ status: 'active', lastError: null }),
    );
    expect(t.logWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ebay_account_reconnected',
        afterSnapshot: expect.objectContaining({ verifiedBy: 'ebay_user_id' }),
      }),
    );
  });

  it('rejects a login as a different seller and changes nothing', async () => {
    const t = setup();
    t.accountRepo.findOne.mockResolvedValueOnce(
      existingAccount({ ebayUserId: 'seller-123' }),
    );
    ebayAnswers({ identity: { userId: 'someone-else' } });

    const err = await t.service
      .handleCallback({ code: 'c', state: 's' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(EbayOAuthCallbackFailure);
    expect(err).toMatchObject({
      reason: 'conflict',
      redirectPath: '/fashion/stores',
    });
    expect((err as EbayOAuthCallbackFailure).userMessage).toMatch(
      /different seller than "Artistic Haul"/,
    );
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('verifies a placeholder-ID account by cached policy IDs and adopts the real seller ID', async () => {
    const t = setup();
    t.accountRepo.findOne
      .mockResolvedValueOnce(existingAccount()) // the account being reconnected
      .mockResolvedValueOnce(null); // no other account holds the real ID
    t.policyRepo.find.mockResolvedValueOnce([
      {
        ebayAccountId: ACCOUNT_ID,
        marketplaceId: 'EBAY_US',
        policyType: 'fulfillment',
        ebayPolicyId: 'F-1',
      },
      {
        ebayAccountId: ACCOUNT_ID,
        marketplaceId: 'EBAY_US',
        policyType: 'return',
        ebayPolicyId: 'R-1',
      },
    ]);
    const store = { id: 'store-1', config: { marketplace: 'EBAY_US' } };
    t.txRepos.get(Store)!.findOne.mockResolvedValueOnce(store);
    ebayAnswers({
      identity: { userId: 'seller-123' },
      policies: { fulfillment: ['F-1', 'F-2'] },
    });

    await t.service.handleCallback({ code: 'c', state: 's' });

    expect(t.txRepos.get(ConnectedEbayAccount)!.update).toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.objectContaining({ ebayUserId: 'seller-123' }),
    );
    expect(t.txRepos.get(Store)!.save).toHaveBeenCalledWith(
      expect.objectContaining({
        ebayUserId: 'seller-123',
        externalStoreId: 'seller-123',
        config: { marketplace: 'EBAY_US', ebayUserId: 'seller-123' },
      }),
    );
    expect(t.logWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        afterSnapshot: expect.objectContaining({
          verifiedBy: 'business_policies',
        }),
      }),
    );
  });

  it('rejects a placeholder-ID account when the login sees none of its policies', async () => {
    const t = setup();
    t.accountRepo.findOne.mockResolvedValueOnce(existingAccount());
    t.policyRepo.find.mockResolvedValueOnce([
      {
        ebayAccountId: ACCOUNT_ID,
        marketplaceId: 'EBAY_US',
        policyType: 'fulfillment',
        ebayPolicyId: 'F-1',
      },
    ]);
    ebayAnswers({ identity: 'fail', policies: { fulfillment: ['X-9'] } });

    const err = await t.service
      .handleCallback({ code: 'c', state: 's' })
      .catch((e: unknown) => e);

    expect(err).toMatchObject({ reason: 'conflict' });
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('fails closed when nothing can confirm the seller', async () => {
    const t = setup();
    t.accountRepo.findOne.mockResolvedValueOnce(existingAccount());
    t.policyRepo.find.mockResolvedValueOnce([]);
    ebayAnswers({ identity: 'fail' });

    const err = await t.service
      .handleCallback({ code: 'c', state: 's' })
      .catch((e: unknown) => e);

    expect(err).toMatchObject({ reason: 'conflict' });
    expect((err as EbayOAuthCallbackFailure).userMessage).toMatch(
      /Cannot confirm/,
    );
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('refuses to adopt a seller ID another connection already holds', async () => {
    const t = setup();
    t.accountRepo.findOne
      .mockResolvedValueOnce(existingAccount())
      .mockResolvedValueOnce({
        id: 'other',
        accountDisplayName: 'Primewardrobeusa',
      });
    t.policyRepo.find.mockResolvedValueOnce([
      {
        ebayAccountId: ACCOUNT_ID,
        marketplaceId: 'EBAY_US',
        policyType: 'payment',
        ebayPolicyId: 'P-1',
      },
    ]);
    ebayAnswers({
      identity: { userId: 'seller-123' },
      policies: { payment: ['P-1'] },
    });

    const err = await t.service
      .handleCallback({ code: 'c', state: 's' })
      .catch((e: unknown) => e);

    expect((err as EbayOAuthCallbackFailure).userMessage).toMatch(
      /already connected in this workspace as "Primewardrobeusa"/,
    );
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('treats unknown_* and empty IDs as placeholders', () => {
    expect(isPlaceholderEbayUserId('unknown_1789469864613')).toBe(true);
    expect(isPlaceholderEbayUserId('unknown')).toBe(true);
    expect(isPlaceholderEbayUserId('')).toBe(true);
    expect(isPlaceholderEbayUserId('seller-123')).toBe(false);
  });
});

describe('identityMatchesAccount', () => {
  it('matches the Identity user ID, or the username against the stored ID or username', () => {
    const acct = (ebayUserId: string, ebayUsername: string | null = null) => ({
      ebayUserId,
      ebayUsername,
    });
    const id = { userId: 'opaque-1', username: 'BlacklineAutoParts' };
    expect(identityMatchesAccount(acct('opaque-1'), id)).toBe(true);
    expect(identityMatchesAccount(acct('blacklineautoparts'), id)).toBe(true);
    expect(
      identityMatchesAccount(acct('unknown_1', 'blacklineautoparts'), id),
    ).toBe(true);
    expect(identityMatchesAccount(acct('unknown_1'), id)).toBe(false);
    expect(identityMatchesAccount(acct('someone-else'), id)).toBe(false);
    expect(
      identityMatchesAccount(acct('unknown_1'), {
        userId: null,
        username: null,
      }),
    ).toBe(false);
  });
});

/**
 * "Sign in with eBay" (no reconnectAccountId): a seller the workspace already
 * has, including a disconnected one, must be re-authorized in place, never
 * given a second store.
 */
describe('EbayIntegrationsOAuthService connect for an existing seller', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedGet.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  const connectSetup = () =>
    setup({
      reconnectAccountId: null,
      vertical: 'automotive',
      marketplaceId: 'EBAY_MOTORS_US',
      accountDisplayName: 'eBay store',
    });

  it('re-authorizes a disconnected account with the same seller ID and creates no store', async () => {
    const t = connectSetup();
    t.accountRepo.find.mockResolvedValueOnce([
      existingAccount({
        ebayUserId: 'seller-123',
        connectionStatus: 'disabled',
      }),
    ]);
    ebayAnswers({ identity: { userId: 'seller-123', username: 'kslv' } });

    const result = await t.service.handleCallback({ code: 'c', state: 's' });

    expect(result).toEqual({
      connectedEbayAccountId: ACCOUNT_ID,
      redirectUrl: '/settings/integrations/ebay',
    });
    expect(t.dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(t.storeRepo.create).not.toHaveBeenCalled();
    expect(t.accountRepo.create).not.toHaveBeenCalled();
    expect(t.txRepos.get(ConnectedEbayAccount)!.update).toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.objectContaining({ connectionStatus: 'active' }),
    );
    expect(t.logWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ebay_account_reconnected',
        afterSnapshot: expect.objectContaining({
          via: 'connect',
          verifiedBy: 'ebay_user_id',
        }),
      }),
    );
  });

  it('matches an account that stored the username as its seller ID and adopts the real ID', async () => {
    const t = connectSetup();
    t.accountRepo.find.mockResolvedValueOnce([
      existingAccount({ ebayUserId: 'blacklineautoparts' }),
    ]);
    t.txRepos.get(Store)!.findOne.mockResolvedValueOnce({
      id: 'store-1',
      config: {},
    });
    ebayAnswers({
      identity: { userId: 'opaque-9', username: 'BlacklineAutoParts' },
    });

    await t.service.handleCallback({ code: 'c', state: 's' });

    expect(t.dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(t.txRepos.get(ConnectedEbayAccount)!.update).toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.objectContaining({ ebayUserId: 'opaque-9' }),
    );
    expect(t.txRepos.get(Store)!.save).toHaveBeenCalledWith(
      expect.objectContaining({ ebayUserId: 'opaque-9' }),
    );
  });

  it('finds a placeholder-ID account by its cached policy IDs', async () => {
    const t = connectSetup();
    t.accountRepo.find.mockResolvedValueOnce([
      existingAccount({ id: 'acct-a', ebayUserId: 'unknown_1' }),
      existingAccount({ id: 'acct-b', ebayUserId: 'unknown_2' }),
    ]);
    t.policyRepo.find.mockResolvedValueOnce([
      {
        ebayAccountId: 'acct-a',
        marketplaceId: 'EBAY_US',
        policyType: 'payment',
        ebayPolicyId: 'P-A',
      },
      {
        ebayAccountId: 'acct-b',
        marketplaceId: 'EBAY_US',
        policyType: 'payment',
        ebayPolicyId: 'P-B',
      },
    ]);
    ebayAnswers({
      identity: { userId: 'seller-b' },
      policies: { payment: ['P-B', 'P-NEW'] },
    });

    const result = await t.service.handleCallback({ code: 'c', state: 's' });

    expect(result.connectedEbayAccountId).toBe('acct-b');
    expect(t.dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(t.txRepos.get(ConnectedEbayAccount)!.update).toHaveBeenCalledWith(
      'acct-b',
      expect.objectContaining({
        connectionStatus: 'active',
        ebayUserId: 'seller-b',
      }),
    );
  });

  it('prefers the active account when one seller already has duplicates', async () => {
    const t = connectSetup();
    t.accountRepo.find.mockResolvedValueOnce([
      existingAccount({
        id: 'old-disabled',
        ebayUserId: 'unknown_1',
        connectionStatus: 'disabled',
      }),
      existingAccount({
        id: 'live',
        ebayUserId: 'unknown_2',
        connectionStatus: 'active',
      }),
    ]);
    t.policyRepo.find.mockResolvedValueOnce([
      {
        ebayAccountId: 'old-disabled',
        marketplaceId: 'EBAY_MOTORS_US',
        policyType: 'return',
        ebayPolicyId: 'R-1',
      },
      {
        ebayAccountId: 'live',
        marketplaceId: 'EBAY_MOTORS_US',
        policyType: 'return',
        ebayPolicyId: 'R-1',
      },
    ]);
    ebayAnswers({ identity: 'fail', policies: { return: ['R-1'] } });

    const result = await t.service.handleCallback({ code: 'c', state: 's' });

    expect(result.connectedEbayAccountId).toBe('live');
    expect(t.dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('refuses to save a placeholder store when eBay returns no seller ID and nothing matches', async () => {
    const t = connectSetup();
    t.accountRepo.find.mockResolvedValueOnce([
      existingAccount({ ebayUserId: 'unknown_1' }),
    ]);
    t.policyRepo.find.mockResolvedValueOnce([
      {
        ebayAccountId: ACCOUNT_ID,
        marketplaceId: 'EBAY_US',
        policyType: 'payment',
        ebayPolicyId: 'P-1',
      },
    ]);
    ebayAnswers({ identity: 'fail', policies: { payment: ['P-OTHER'] } });

    const err = await t.service
      .handleCallback({ code: 'c', state: 's' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(EbayOAuthCallbackFailure);
    expect((err as EbayOAuthCallbackFailure).userMessage).toMatch(
      /did not return the seller account ID/,
    );
    expect(t.dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('still creates a store for a genuinely new seller', async () => {
    const t = connectSetup();
    t.accountRepo.find.mockResolvedValueOnce([
      existingAccount({ ebayUserId: 'seller-123' }),
    ]);
    const saved: unknown[] = [];
    t.dataSource.createQueryRunner.mockReturnValue({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn((d: Record<string, unknown>) => {
          saved.push(d);
          return Promise.resolve({ id: `new-${saved.length}`, ...d });
        }),
      },
    });
    ebayAnswers({ identity: { userId: 'brand-new', username: 'newshop' } });

    const result = await t.service.handleCallback({ code: 'c', state: 's' });

    expect(t.dataSource.createQueryRunner).toHaveBeenCalled();
    expect(t.storeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ ebayUserId: 'brand-new' }),
    );
    expect(result.connectedEbayAccountId).toBe('new-3');
  });
});
