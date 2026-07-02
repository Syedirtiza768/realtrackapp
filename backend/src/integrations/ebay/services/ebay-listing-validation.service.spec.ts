import type { Repository } from 'typeorm';
import type { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import type { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import type { EbayAccountTokenService } from './ebay-account-token.service.js';
import type { SellerpunditPolicySyncService } from '../../sellerpundit/sellerpundit-policy-sync.service.js';
import type { SellerpunditTokenSyncService } from '../../sellerpundit/sellerpundit-token-sync.service.js';
import type { EbayInventoryApiService } from '../../../channels/ebay/ebay-inventory-api.service.js';
import type { CatalogPublishResolverService } from './catalog-publish-resolver.service.js';
import type { EbayMarketplaceConfigService } from './ebay-marketplace-config.service.js';
import { EbayListingValidationService } from './ebay-listing-validation.service.js';

/* ── Helpers ── */

function createRepo<T extends Record<string, unknown>>() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((d: Partial<T>) => ({ id: 'new-id', ...d } as T)),
    save: jest.fn((d: T) => Promise.resolve(d)),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    })),
  } as unknown as Repository<T>;
}

function mockSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    snapshot: {
      catalogProductId: 'cp-1',
      listingRecordId: 'lr-1',
      sku: 'SKU-001',
      title: 'Brake Pad TRW',
      description: '<p>Great brake pad</p>',
      brand: 'TRW',
      mpn: 'BP-123',
      partType: 'Brake Pad',
      price: 49.99,
      quantity: 5,
      categoryId: '6028',
      conditionId: '3000',
      imageUrls: ['https://img.example.com/1.jpg'],
      ...overrides,
    },
    warnings: [],
  };
}

/* ── Tests ── */

describe('EbayListingValidationService', () => {
  let svc: EbayListingValidationService;
  let accountRepo: ReturnType<typeof createRepo<ConnectedEbayAccount>>;
  let mpRepo: ReturnType<typeof createRepo<EbayAccountMarketplace>>;
  let tokens: { getValidAccessToken: jest.Mock };
  let sellerpunditPolicies: { ensurePoliciesFresh: jest.Mock };
  let sellerpunditTokens: { validateAccountEbayToken: jest.Mock };
  let inventoryApi: { ensureMerchantLocation: jest.Mock };
  let publishResolver: { resolve: jest.Mock };
  let marketplaceConfig: { get: jest.Mock };

  const baseParams = {
    organizationId: 'org-1',
    catalogProductId: 'cp-1',
    ebayAccountId: 'acct-1',
    marketplaceId: 'EBAY_US',
  };

  beforeEach(() => {
    accountRepo = createRepo<ConnectedEbayAccount>();
    mpRepo = createRepo<EbayAccountMarketplace>();
    tokens = { getValidAccessToken: jest.fn().mockResolvedValue('token') };
    sellerpunditPolicies = { ensurePoliciesFresh: jest.fn().mockResolvedValue({ ok: true }) };
    sellerpunditTokens = { validateAccountEbayToken: jest.fn().mockResolvedValue(true) };
    inventoryApi = { ensureMerchantLocation: jest.fn().mockResolvedValue('loc-1') };
    publishResolver = { resolve: jest.fn().mockResolvedValue(mockSnapshot()) };
    marketplaceConfig = {
      get: jest.fn().mockReturnValue({ requiresLocalizedDescription: false, supportsMotorsFitment: true }),
    };

    svc = new EbayListingValidationService(
      marketplaceConfig as unknown as EbayMarketplaceConfigService,
      tokens as unknown as EbayAccountTokenService,
      sellerpunditPolicies as unknown as SellerpunditPolicySyncService,
      sellerpunditTokens as unknown as SellerpunditTokenSyncService,
      inventoryApi as unknown as EbayInventoryApiService,
      publishResolver as unknown as CatalogPublishResolverService,
      accountRepo,
      mpRepo,
    );
  });

  it('returns blocked for missing account', async () => {
    accountRepo.findOne = jest.fn().mockResolvedValue(null);

    const result = await svc.validatePublish(baseParams);
    expect(result.status).toBe('blocked');
    expect(result.errors).toContainEqual(expect.stringContaining('not found'));
  });

  it('returns blocked for disabled account', async () => {
    accountRepo.findOne = jest.fn().mockResolvedValue({
      id: 'acct-1',
      connectionStatus: 'disabled',
    });

    const result = await svc.validatePublish(baseParams);
    expect(result.status).toBe('blocked');
    expect(result.errors).toContainEqual(expect.stringContaining('disabled'));
  });

  it('returns blocked for reconnect_required account', async () => {
    accountRepo.findOne = jest.fn().mockResolvedValue({
      id: 'acct-1',
      connectionStatus: 'reconnect_required',
      connectionSource: 'ebay',
    });

    const result = await svc.validatePublish(baseParams);
    expect(result.status).toBe('blocked');
    expect(result.errors).toContainEqual(expect.stringContaining('reconnection'));
    expect(result.requiredActions).toContain('reconnect_oauth');
  });

  it('requires all three policy IDs on marketplace row', async () => {
    accountRepo.findOne = jest.fn().mockResolvedValue({
      id: 'acct-1',
      connectionStatus: 'active',
      connectionSource: 'ebay',
    });
    mpRepo.findOne = jest.fn().mockResolvedValue({
      enabled: true,
      defaultFulfillmentPolicyId: null,
      defaultPaymentPolicyId: 'pp-1',
      defaultReturnPolicyId: 'rp-1',
      defaultInventoryLocationKey: 'loc-1',
    });

    const result = await svc.validatePublish(baseParams);
    expect(result.errors).toContainEqual(expect.stringContaining('fulfillment'));
  });

  it('requires inventory location', async () => {
    accountRepo.findOne = jest.fn().mockResolvedValue({
      id: 'acct-1',
      connectionStatus: 'active',
      connectionSource: 'ebay',
    });
    mpRepo.findOne = jest.fn().mockResolvedValue({
      enabled: true,
      defaultFulfillmentPolicyId: 'fp-1',
      defaultPaymentPolicyId: 'pp-1',
      defaultReturnPolicyId: 'rp-1',
      defaultInventoryLocationKey: null,
    });

    const result = await svc.validatePublish(baseParams);
    expect(result.errors).toContainEqual(expect.stringContaining('inventory location'));
  });

  it('errors for missing SKU', async () => {
    accountRepo.findOne = jest.fn().mockResolvedValue({
      id: 'acct-1',
      connectionStatus: 'active',
      connectionSource: 'ebay',
    });
    mpRepo.findOne = jest.fn().mockResolvedValue({
      enabled: true,
      defaultFulfillmentPolicyId: 'fp-1',
      defaultPaymentPolicyId: 'pp-1',
      defaultReturnPolicyId: 'rp-1',
      defaultInventoryLocationKey: 'loc-1',
    });
    publishResolver.resolve.mockResolvedValue(mockSnapshot({ sku: '' }));

    const result = await svc.validatePublish(baseParams);
    expect(result.errors).toContainEqual(expect.stringContaining('SKU'));
  });

  it('errors for invalid price', async () => {
    accountRepo.findOne = jest.fn().mockResolvedValue({
      id: 'acct-1',
      connectionStatus: 'active',
      connectionSource: 'ebay',
    });
    mpRepo.findOne = jest.fn().mockResolvedValue({
      enabled: true,
      defaultFulfillmentPolicyId: 'fp-1',
      defaultPaymentPolicyId: 'pp-1',
      defaultReturnPolicyId: 'rp-1',
      defaultInventoryLocationKey: 'loc-1',
    });
    publishResolver.resolve.mockResolvedValue(mockSnapshot({ price: 0 }));

    const result = await svc.validatePublish(baseParams);
    expect(result.errors).toContainEqual(expect.stringContaining('price'));
  });

  it('warns for long title', async () => {
    accountRepo.findOne = jest.fn().mockResolvedValue({
      id: 'acct-1',
      connectionStatus: 'active',
      connectionSource: 'ebay',
    });
    mpRepo.findOne = jest.fn().mockResolvedValue({
      enabled: true,
      defaultFulfillmentPolicyId: 'fp-1',
      defaultPaymentPolicyId: 'pp-1',
      defaultReturnPolicyId: 'rp-1',
      defaultInventoryLocationKey: 'loc-1',
    });
    publishResolver.resolve.mockResolvedValue(mockSnapshot({
      title: 'A'.repeat(100),
    }));

    const result = await svc.validatePublish(baseParams);
    expect(result.warnings).toContainEqual(expect.stringContaining('truncated'));
  });

  it('checks OAuth token validity at end', async () => {
    accountRepo.findOne = jest.fn().mockResolvedValue({
      id: 'acct-1',
      connectionStatus: 'active',
      connectionSource: 'ebay',
    });
    mpRepo.findOne = jest.fn().mockResolvedValue({
      enabled: true,
      defaultFulfillmentPolicyId: 'fp-1',
      defaultPaymentPolicyId: 'pp-1',
      defaultReturnPolicyId: 'rp-1',
      defaultInventoryLocationKey: 'loc-1',
    });
    tokens.getValidAccessToken.mockRejectedValue(new Error('token expired'));

    const result = await svc.validatePublish(baseParams);
    expect(result.errors).toContainEqual(expect.stringContaining('OAuth token'));
  });
});
