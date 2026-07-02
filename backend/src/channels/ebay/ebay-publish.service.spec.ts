import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { EbayPublishService, type PublishRequest } from './ebay-publish.service.js';

/* ── Helpers ── */

function createRepo<T extends Record<string, unknown>>() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    findOneByOrFail: jest.fn(),
    create: jest.fn((d: Partial<T>) => ({ id: 'new-id', ...d } as T)),
    save: jest.fn((d: T) => Promise.resolve({ id: 'saved-id', ...d } as T)),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
  } as unknown as Repository<T>;
}

function mockInventoryApi() {
  return {
    createOrReplaceItem: jest.fn().mockResolvedValue(undefined),
    createOffer: jest.fn().mockResolvedValue({ offerId: 'offer-123' }),
    updateOffer: jest.fn().mockResolvedValue(undefined),
    publishOffer: jest.fn().mockResolvedValue({ listingId: 'listing-456' }),
    setCompatibility: jest.fn().mockResolvedValue(undefined),
    withdrawOffer: jest.fn().mockResolvedValue(undefined),
    bulkUpdatePriceQuantity: jest.fn().mockResolvedValue(undefined),
    ensureMerchantLocation: jest.fn().mockResolvedValue('default-loc'),
    getOffersBySku: jest.fn().mockResolvedValue({ offers: [] }),
  };
}

function mockAuth() {
  return {
    getAccessToken: jest.fn().mockResolvedValue('test-token'),
    getApiBaseUrlForStore: jest.fn().mockResolvedValue('https://api.ebay.com'),
    getApiConfig: jest.fn().mockReturnValue({ baseUrl: 'https://api.ebay.com', sandbox: false }),
  };
}

function mockConfig(values: Record<string, string> = {}) {
  return { get: (key: string, fallback = '') => values[key] ?? fallback } as unknown as ConfigService;
}

function validRequest(overrides: Partial<PublishRequest> = {}): PublishRequest {
  return {
    listingId: 'listing-1',
    storeIds: ['store-1'],
    sku: 'SKU-001',
    title: 'Test Brake Pad',
    description: '<p>Great brake pad</p>',
    categoryId: '6028',
    condition: 'USED_EXCELLENT',
    price: 49.99,
    quantity: 5,
    imageUrls: ['https://img.example.com/1.jpg'],
    aspects: { Brand: ['TRW'], Type: ['Brake Pad'] },
    ...overrides,
  };
}

/* ── Tests ── */

describe('EbayPublishService', () => {
  let svc: EbayPublishService;
  let storeRepo: ReturnType<typeof createRepo>;
  let connectedAccountRepo: ReturnType<typeof createRepo>;
  let mpRepo: ReturnType<typeof createRepo>;
  let policyRepo: ReturnType<typeof createRepo>;
  let listingRepo: ReturnType<typeof createRepo>;
  let catalogRepo: ReturnType<typeof createRepo>;
  let inventoryApi: ReturnType<typeof mockInventoryApi>;
  let auth: ReturnType<typeof mockAuth>;

  beforeEach(() => {
    storeRepo = createRepo();
    connectedAccountRepo = createRepo();
    mpRepo = createRepo();
    policyRepo = createRepo();
    listingRepo = createRepo();
    catalogRepo = createRepo();
    inventoryApi = mockInventoryApi();
    auth = mockAuth();

    svc = new EbayPublishService(
      mockConfig() as ConfigService,
      inventoryApi as any,
      {} as any, // taxonomyApi
      auth as any,
      {} as any, // sellAccount
      { ensureCompliantReturnPolicy: jest.fn().mockResolvedValue({ action: 'picked', returnPolicyId: 'ret-1' }) } as any,
      { publish: jest.fn().mockResolvedValue({ success: true, offerId: 'sp-offer', listingId: 'sp-listing' }) } as any,
      { ensurePoliciesFresh: jest.fn().mockResolvedValue({ ok: true }) } as any,
      { ensureFreshAccessToken: jest.fn(), refreshTokenFromSellerpundit: jest.fn() } as any,
      { resolveMarketplaceForAccount: jest.fn().mockReturnValue('EBAY_US') } as any,
      { require: jest.fn().mockReturnValue({ currency: 'USD', locale: 'en_US', categoryTreeId: '0' }) } as any,
      storeRepo,
      connectedAccountRepo,
      mpRepo,
      policyRepo,
      listingRepo,
      catalogRepo,
    );
  });

  describe('publish', () => {
    it('throws BadRequestException when storeIds is empty', async () => {
      await expect(svc.publish(validRequest({ storeIds: [] }))).rejects.toThrow(BadRequestException);
    });

    it('throws when no images available', async () => {
      listingRepo.findOne = jest.fn().mockResolvedValue(null);
      catalogRepo.findOne = jest.fn().mockResolvedValue(null);

      await expect(svc.publish(validRequest({ imageUrls: [] }))).rejects.toThrow(/image/);
    });

    it('publishes to a store successfully via direct eBay', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'My Store',
        config: { marketplace: 'EBAY_US', locationKey: 'default-loc' },
        locationKey: 'default-loc',
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      listingRepo.findOne = jest.fn().mockResolvedValue({ cBrand: 'TRW' });

      const results = await svc.publish(validRequest());

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].listingId).toBe('listing-456');
      expect(inventoryApi.createOrReplaceItem).toHaveBeenCalled();
      expect(inventoryApi.createOffer).toHaveBeenCalled();
      expect(inventoryApi.publishOffer).toHaveBeenCalled();
    });

    it('returns error when store not found', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue(null);
      listingRepo.findOne = jest.fn().mockResolvedValue(null);

      const results = await svc.publish(validRequest());
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('not found');
    });

    it('sets compatibility data when fitment is provided', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'My Store',
        config: { marketplace: 'EBAY_MOTORS_US' },
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      listingRepo.findOne = jest.fn().mockResolvedValue(null);

      const req = validRequest({
        compatibility: {
          compatibleProducts: [{
            compatibilityProperties: [
              { name: 'Make', value: 'Toyota' },
              { name: 'Model', value: 'Camry' },
              { name: 'Year', value: '2018' },
            ],
          }],
        },
      });

      await svc.publish(req);
      expect(inventoryApi.setCompatibility).toHaveBeenCalledWith(
        'store-1',
        expect.any(String),
        req.compatibility,
      );
    });

    it('handles offer-already-exists (25002) by updating existing offer', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'My Store',
        config: { marketplace: 'EBAY_US', locationKey: 'default-loc' },
        locationKey: 'default-loc',
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      listingRepo.findOne = jest.fn().mockResolvedValue(null);

      const error25002 = Object.assign(new Error('Offer exists'), {
        response: {
          data: {
            errors: [{
              errorId: 25002,
              parameters: [{ name: 'offerId', value: 'existing-offer' }],
            }],
          },
        },
      });
      inventoryApi.createOffer = jest.fn().mockRejectedValue(error25002);

      const results = await svc.publish(validRequest());
      expect(inventoryApi.updateOffer).toHaveBeenCalledWith('store-1', 'existing-offer', expect.any(Object));
      expect(results[0].success).toBe(true);
    });

    it('processes multiple stores', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'Store A',
        config: { marketplace: 'EBAY_US' },
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      listingRepo.findOne = jest.fn().mockResolvedValue(null);

      const results = await svc.publish(validRequest({ storeIds: ['store-1', 'store-1'] }));
      expect(results).toHaveLength(2);
    });
  });

  describe('endListing', () => {
    it('calls withdrawOffer', async () => {
      await svc.endListing('store-1', 'offer-123');
      expect(inventoryApi.withdrawOffer).toHaveBeenCalledWith('store-1', 'offer-123');
    });
  });

  describe('updatePriceQuantity', () => {
    it('delegates to inventoryApi.bulkUpdatePriceQuantity', async () => {
      await svc.updatePriceQuantity('store-1', [
        { offerId: 'offer-1', price: 29.99, quantity: 10 },
      ]);
      expect(inventoryApi.bulkUpdatePriceQuantity).toHaveBeenCalledWith('store-1', expect.any(Array));
    });
  });

  describe('stubPublishRequest', () => {
    it('creates minimal request with listing ID as SKU', () => {
      const req = svc.stubPublishRequest('listing-123', ['store-1']);
      expect(req.listingId).toBe('listing-123');
      expect(req.sku).toBe('listing-123');
      expect(req.storeIds).toEqual(['store-1']);
      expect(req.condition).toBe('NEW'); // placeholder
      expect(req.price).toBe(0);
    });
  });

  describe('publishByListingIds', () => {
    it('throws when storeIds empty', async () => {
      await expect(svc.publishByListingIds(['l-1'], [])).rejects.toThrow(BadRequestException);
    });
  });

  describe('buildInventoryItem (private)', () => {
    it('maps condition correctly', () => {
      const item = (svc as any).buildInventoryItem(
        validRequest({ condition: 'USED_EXCELLENT' }),
        { config: { marketplace: 'EBAY_US' } },
      );
      expect(item.condition).toBe('USED_EXCELLENT');
      expect(item.availability.shipToLocationAvailability.quantity).toBe(5);
    });

    it('localizes aspects for DE marketplace', () => {
      const item = (svc as any).buildInventoryItem(
        validRequest({ aspects: { Brand: ['Bosch'], Type: ['Filter'] } }),
        { config: { marketplace: 'EBAY_DE' } },
      );
      // Should have German aspect names
      expect(item.product.aspects).toBeDefined();
    });
  });

  describe('buildOffer (private)', () => {
    it('uses GTC listing duration for FIXED_PRICE', () => {
      const offer = (svc as any).buildOffer(
        validRequest(),
        { config: { marketplace: 'EBAY_US' } },
      );
      expect(offer.listingDuration).toBe('GTC');
      expect(offer.format).toBe('FIXED_PRICE');
      expect(offer.pricingSummary.price.value).toBe('49.99');
    });
  });

  describe('fallbackConditionForCategory (private)', () => {
    it('maps USED_GOOD to USED_EXCELLENT', () => {
      const result = (svc as any).fallbackConditionForCategory(validRequest({ condition: 'USED_GOOD' }));
      expect(result).toBe('USED_EXCELLENT');
    });

    it('returns undefined for NEW condition', () => {
      const result = (svc as any).fallbackConditionForCategory(validRequest({ condition: 'NEW' }));
      expect(result).toBeUndefined();
    });

    it('returns undefined for USED_EXCELLENT (already the fallback)', () => {
      const result = (svc as any).fallbackConditionForCategory(validRequest({ condition: 'USED_EXCELLENT' }));
      expect(result).toBeUndefined();
    });
  });

  describe('validateDirectOffer (private)', () => {
    it('returns error for missing fulfillment policy', () => {
      const error = (svc as any).validateDirectOffer(
        { listingPolicies: { paymentPolicyId: 'p', returnPolicyId: 'r' }, categoryId: '6028', merchantLocationKey: 'loc' },
        { storeName: 'Test' },
      );
      expect(error).toContain('fulfillment');
    });

    it('returns error for missing category', () => {
      const error = (svc as any).validateDirectOffer(
        { listingPolicies: { fulfillmentPolicyId: 'f', paymentPolicyId: 'p', returnPolicyId: 'r' }, categoryId: '', merchantLocationKey: 'loc' },
        { storeName: 'Test' },
      );
      expect(error).toContain('category');
    });

    it('returns null when all fields are valid', () => {
      const error = (svc as any).validateDirectOffer(
        { listingPolicies: { fulfillmentPolicyId: 'f', paymentPolicyId: 'p', returnPolicyId: 'r' }, categoryId: '6028', merchantLocationKey: 'loc' },
        { storeName: 'Test' },
      );
      expect(error).toBeNull();
    });
  });
});
