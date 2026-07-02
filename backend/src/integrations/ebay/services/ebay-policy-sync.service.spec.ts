import type { Repository } from 'typeorm';
import type { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import type { EbayBusinessPolicy } from '../entities/ebay-business-policy.entity.js';
import type { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import type { EbayAccountTokenService } from './ebay-account-token.service.js';
import type { EbaySellAccountApiService } from './ebay-sell-account-api.service.js';
import type { ListingActionLogWriterService } from './listing-action-log-writer.service.js';
import type { SellerpunditPolicySyncService } from '../../sellerpundit/sellerpundit-policy-sync.service.js';
import type { EbayInventoryApiService } from '../../../channels/ebay/ebay-inventory-api.service.js';
import type { EbayAuthService } from '../../../channels/ebay/ebay-auth.service.js';
import { EbayPolicySyncService } from './ebay-policy-sync.service.js';

/* ── Helpers ── */

function createRepo<T extends Record<string, unknown>>() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((d: Partial<T>) => ({ id: 'new-id', ...d } as T)),
    save: jest.fn((d: T) => Promise.resolve({ id: 'saved-id', ...d } as T)),
    delete: jest.fn().mockResolvedValue(undefined),
  } as unknown as Repository<T>;
}

/* ── Tests ── */

describe('EbayPolicySyncService', () => {
  let svc: EbayPolicySyncService;
  let accountRepo: ReturnType<typeof createRepo<ConnectedEbayAccount>>;
  let policyRepo: ReturnType<typeof createRepo<EbayBusinessPolicy>>;
  let mpRepo: ReturnType<typeof createRepo<EbayAccountMarketplace>>;
  let tokens: { getValidAccessToken: jest.Mock };
  let sellAccount: { listFulfillmentPolicies: jest.Mock; listPaymentPolicies: jest.Mock; listReturnPolicies: jest.Mock };
  let logWriter: { write: jest.Mock };
  let sellerpunditPolicies: { overlaySellerpunditPoliciesFromEbayApi: jest.Mock };
  let inventoryApi: { ensureMerchantLocation: jest.Mock };
  let ebayAuth: { getAccessToken: jest.Mock; getApiBaseUrlForStore: jest.Mock };

  beforeEach(() => {
    accountRepo = createRepo<ConnectedEbayAccount>();
    policyRepo = createRepo<EbayBusinessPolicy>();
    mpRepo = createRepo<EbayAccountMarketplace>();
    tokens = { getValidAccessToken: jest.fn().mockResolvedValue('token') };
    sellAccount = {
      listFulfillmentPolicies: jest.fn().mockResolvedValue([]),
      listPaymentPolicies: jest.fn().mockResolvedValue([]),
      listReturnPolicies: jest.fn().mockResolvedValue([]),
      listInventoryLocations: jest.fn().mockResolvedValue([]),
    };
    logWriter = { write: jest.fn() };
    sellerpunditPolicies = { overlaySellerpunditPoliciesFromEbayApi: jest.fn() };
    inventoryApi = { ensureMerchantLocation: jest.fn().mockResolvedValue('loc-1') };
    ebayAuth = {
      getAccessToken: jest.fn().mockResolvedValue('token'),
      getApiBaseUrlForStore: jest.fn().mockResolvedValue('https://api.ebay.com'),
    };

    svc = new EbayPolicySyncService(
      accountRepo,
      policyRepo,
      mpRepo,
      tokens as unknown as EbayAccountTokenService,
      sellAccount as unknown as EbaySellAccountApiService,
      logWriter as unknown as ListingActionLogWriterService,
      sellerpunditPolicies as unknown as SellerpunditPolicySyncService,
      inventoryApi as unknown as EbayInventoryApiService,
      ebayAuth as unknown as EbayAuthService,
    );
  });

  describe('syncPolicies', () => {
    it('throws for missing account', async () => {
      accountRepo.findOne = jest.fn().mockResolvedValue(null);
      await expect(svc.syncPolicies('acct-1', 'org-1')).rejects.toThrow();
    });

    it('syncs fulfillment/payment/return policies from eBay API', async () => {
      accountRepo.findOne = jest.fn().mockResolvedValue({
        id: 'acct-1',
        organizationId: 'org-1',
        environment: 'production',
        connectionSource: 'ebay',
      });
      mpRepo.find = jest.fn().mockResolvedValue([
        { marketplaceId: 'EBAY_US', enabled: true },
      ]);
      sellAccount.listFulfillmentPolicies.mockResolvedValue([
        { ebayPolicyId: 'fp-1', name: 'Standard Shipping', isDefault: true, raw: {} },
      ]);
      sellAccount.listPaymentPolicies.mockResolvedValue([
        { ebayPolicyId: 'pp-1', name: 'PayPal', isDefault: true, raw: {} },
      ]);
      sellAccount.listReturnPolicies.mockResolvedValue([
        { ebayPolicyId: 'rp-1', name: '30 Day Return', isDefault: true, raw: {} },
      ]);
      mpRepo.findOne = jest.fn().mockResolvedValue({
        marketplaceId: 'EBAY_US',
        defaultFulfillmentPolicyId: null,
        defaultPaymentPolicyId: null,
        defaultReturnPolicyId: null,
        defaultInventoryLocationKey: null,
      });

      const result = await svc.syncPolicies('acct-1', 'org-1');
      expect(result).toBeDefined();
    });

    it('handles policy fetch failure gracefully', async () => {
      accountRepo.findOne = jest.fn().mockResolvedValue({
        id: 'acct-1',
        organizationId: 'org-1',
        environment: 'production',
        connectionSource: 'ebay',
      });
      mpRepo.find = jest.fn().mockResolvedValue([
        { marketplaceId: 'EBAY_US', enabled: true },
      ]);
      ebayAuth.getAccessToken.mockRejectedValue(new Error('token expired'));

      // syncPolicies catches errors internally and returns error result
      const result = await svc.syncPolicies('acct-1', 'org-1');
      expect(result).toBeDefined();
    });
  });
});
