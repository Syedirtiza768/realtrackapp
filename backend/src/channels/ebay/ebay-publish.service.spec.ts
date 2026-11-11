import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import {
  EbayPublishService,
  type PublishRequest,
} from './ebay-publish.service.js';
import { conflictSafeSkuFor } from './ebay-sku.util.js';

/* ── Helpers ── */

function createRepo<T extends Record<string, unknown>>() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    findOneByOrFail: jest.fn(),
    create: jest.fn((d: Partial<T>) => ({ id: 'new-id', ...d }) as T),
    save: jest.fn((d: T) => Promise.resolve({ id: 'saved-id', ...d } as T)),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
  } as unknown as Repository<T>;
}

function mockInventoryApi() {
  let compatibility: { compatibleProducts: unknown[] } = {
    compatibleProducts: [],
  };
  let item: Record<string, unknown> | null = null;
  let offer: Record<string, unknown> | null = null;
  const notFound = Object.assign(new Error('status code 404'), {
    response: { status: 404 },
  });
  return {
    createOrReplaceItem: jest
      .fn()
      .mockImplementation((_storeId, _sku, payload) => {
        item = payload;
        return Promise.resolve(undefined);
      }),
    getItem: jest
      .fn()
      .mockImplementation(() =>
        item ? Promise.resolve(item) : Promise.reject(notFound),
      ),
    createOffer: jest.fn().mockImplementation((_storeId, payload) => {
      offer = { ...payload, offerId: 'offer-123' };
      return Promise.resolve({ offerId: 'offer-123' });
    }),
    updateOffer: jest.fn().mockImplementation((_storeId, _offerId, payload) => {
      offer = { ...(offer ?? {}), ...payload, offerId: 'offer-123' };
      return Promise.resolve(undefined);
    }),
    publishOffer: jest.fn().mockResolvedValue({ listingId: 'listing-456' }),
    setCompatibility: jest
      .fn()
      .mockImplementation((_storeId, _sku, payload) => {
        compatibility = payload;
        return Promise.resolve(undefined);
      }),
    getCompatibility: jest
      .fn()
      .mockImplementation(() => Promise.resolve(compatibility)),
    deleteCompatibility: jest.fn().mockImplementation(() => {
      compatibility = { compatibleProducts: [] };
      return Promise.resolve(undefined);
    }),
    getOffer: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(offer ?? { offerId: 'offer-123' }),
      ),
    withdrawOffer: jest.fn().mockResolvedValue(undefined),
    deleteOffer: jest.fn().mockResolvedValue(undefined),
    deleteItem: jest.fn().mockImplementation(() => {
      item = null;
      return Promise.resolve(undefined);
    }),
    bulkUpdatePriceQuantity: jest.fn().mockResolvedValue(undefined),
    ensureMerchantLocation: jest
      .fn()
      .mockImplementation((_storeId, preferredKey) =>
        Promise.resolve(preferredKey ?? 'default-loc'),
      ),
    getOffersBySku: jest.fn().mockResolvedValue({ offers: [] }),
  };
}

function mockAuth() {
  return {
    getAccessToken: jest.fn().mockResolvedValue('test-token'),
    getApiBaseUrlForStore: jest.fn().mockResolvedValue('https://api.ebay.com'),
    getApiConfig: jest
      .fn()
      .mockReturnValue({ baseUrl: 'https://api.ebay.com', sandbox: false }),
  };
}

function mockEbayMediaApi() {
  return {
    hostImages: jest
      .fn()
      .mockImplementation((_storeId: string, imageUrls: string[]) =>
        Promise.resolve(
          imageUrls.map((url) => `https://i.ebayimg.com/hosted${url}`),
        ),
      ),
  };
}

function mockConfig(values: Record<string, string> = {}) {
  return {
    get: (key: string, fallback = '') => values[key] ?? fallback,
  } as unknown as ConfigService;
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
  describe('conflictSafeSkuFor', () => {
    it('maps canonical BLA SKUs to a deterministic postfix-free BLAP SKU', () => {
      expect(conflictSafeSkuFor('BLA-19279')).toBe('BLAP-19279');
      expect(conflictSafeSkuFor('BLA-A2123520202')).toBe('BLAP-A2123520202');
    });

    it('does not stack the BLAP namespace or create an invalid SKU', () => {
      // Non-BLA families (including BLAP-* itself) get the bounded,
      // hash-suffixed namespace; callers must still prove it is unused.
      const blapAlternate = conflictSafeSkuFor('BLAP-19279');
      expect(blapAlternate).toMatch(/^BLAP-19279-RT[A-Z0-9]{7}$/);
      expect(conflictSafeSkuFor('SKU-19279')).toMatch(
        /^SKU-19279-RT[A-Z0-9]{7}$/,
      );
      expect(conflictSafeSkuFor(`BLA-${'x'.repeat(50)}`)).toBeNull();
    });
  });

  describe('remote SKU ownership', () => {
    it('reclaims an unpublished orphan without changing the source projection', async () => {
      const store = {
        id: 'store-1',
        storeName: 'Test Store',
        config: { marketplace: 'EBAY_MOTORS_US' },
        ebayMarketplaceId: 'EBAY_MOTORS_US',
      };
      const account = {
        id: 'account-1',
        primaryStoreId: 'store-1',
        connectionSource: 'native_oauth',
      };
      inventoryApi.getItem.mockResolvedValue({
        product: { title: 'Stale unpublished item' },
      });
      inventoryApi.getOffersBySku.mockResolvedValue({ offers: [], total: 0 });
      catalogRepo.findOne = jest.fn().mockResolvedValue({ id: 'catalog-1' });
      listingRepo.findOne = jest.fn().mockResolvedValue(null);
      channelRepo.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        (svc as any).assertRemoteSkuOwnership(
          'store-1',
          store,
          validRequest({ sku: 'AUD-Q7-1712-CC-G' }),
          account,
        ),
      ).resolves.toBeUndefined();
    });
  });

  let svc: EbayPublishService;
  let storeRepo: ReturnType<typeof createRepo>;
  let connectedAccountRepo: ReturnType<typeof createRepo>;
  let mpRepo: ReturnType<typeof createRepo>;
  let policyRepo: ReturnType<typeof createRepo>;
  let channelRepo: ReturnType<typeof createRepo>;
  let listingRepo: ReturnType<typeof createRepo>;
  let catalogRepo: ReturnType<typeof createRepo>;
  let ebayCategoryRepo: ReturnType<typeof createRepo>;
  let inventoryApi: ReturnType<typeof mockInventoryApi>;
  let tradingApi: {
    addFixedPriceItem: jest.Mock;
    reviseFixedPriceItem: jest.Mock;
    relistFixedPriceItem: jest.Mock;
    getItemDetails: jest.Mock;
  };
  let auth: ReturnType<typeof mockAuth>;
  let ebayMedia: ReturnType<typeof mockEbayMediaApi>;
  let compatibilityReconciler: {
    syncInventory: jest.Mock;
    refreshPublishedOffer: jest.Mock;
    syncLiveListing: jest.Mock;
  };
  let marketplaceConfig: { require: jest.Mock };
  let taxonomyApi: {
    getCompatibilityProperties: jest.Mock;
    getCategorySubtree: jest.Mock;
  };

  beforeEach(() => {
    storeRepo = createRepo();
    connectedAccountRepo = createRepo();
    mpRepo = createRepo();
    policyRepo = createRepo();
    channelRepo = createRepo();
    listingRepo = createRepo();
    catalogRepo = createRepo();
    ebayCategoryRepo = createRepo();
    inventoryApi = mockInventoryApi();
    tradingApi = {
      addFixedPriceItem: jest
        .fn()
        .mockResolvedValue({ itemId: 'trading-listing-456' }),
      reviseFixedPriceItem: jest.fn().mockResolvedValue(undefined),
      relistFixedPriceItem: jest
        .fn()
        .mockResolvedValue({ itemId: 'trading-relisted-789' }),
      getItemDetails: jest
        .fn()
        .mockResolvedValue({ listingStatus: 'Completed' }),
    };
    auth = mockAuth();
    ebayMedia = mockEbayMediaApi();
    compatibilityReconciler = {
      syncInventory: jest
        .fn()
        .mockImplementation((storeId, sku, payload) =>
          payload
            ? inventoryApi.setCompatibility(storeId, sku, payload)
            : inventoryApi.deleteCompatibility(storeId, sku),
        ),
      refreshPublishedOffer: jest.fn().mockResolvedValue('listing-456'),
      syncLiveListing: jest.fn(),
    };
    marketplaceConfig = {
      require: jest.fn().mockImplementation((marketplaceId: string) => ({
        currency: marketplaceId === 'EBAY_DE' ? 'EUR' : 'USD',
        locale: marketplaceId === 'EBAY_DE' ? 'de_DE' : 'en_US',
        categoryTreeId: marketplaceId === 'EBAY_DE' ? '77' : '0',
        supportsMotorsFitment: marketplaceId !== 'EBAY_DE',
      })),
    };
    taxonomyApi = {
      getCompatibilityProperties: jest.fn().mockResolvedValue([]),
      getCategorySubtree: jest.fn().mockRejectedValue(new Error('not cached')),
    };

    svc = new EbayPublishService(
      // Trading API is the production default for new listings. Most of this
      // suite exercises the Inventory API path, so pin it explicitly; tests
      // that cover Trading override `config` (see 'Trading API selection').
      mockConfig({ EBAY_LISTING_API_MODE: 'inventory' }),
      inventoryApi as any,
      tradingApi as any,
      taxonomyApi as any,
      {} as any, // taxonomyCache
      auth as any,
      {} as any, // sellAccount
      {
        ensureCompliantReturnPolicy: jest
          .fn()
          .mockResolvedValue({ action: 'picked', returnPolicyId: 'ret-1' }),
      } as any,
      {
        publish: jest.fn().mockResolvedValue({
          success: true,
          offerId: 'sp-offer',
          listingId: 'sp-listing',
        }),
      } as any,
      { ensurePoliciesFresh: jest.fn().mockResolvedValue({ ok: true }) } as any,
      {
        ensureFreshAccessToken: jest.fn(),
        refreshTokenFromSellerpundit: jest.fn(),
      } as any,
      {
        resolveMarketplaceForAccount: jest.fn().mockReturnValue('EBAY_US'),
      } as any,
      marketplaceConfig as any,
      {} as any, // mvlService
      storeRepo as any,
      connectedAccountRepo as any,
      mpRepo as any,
      policyRepo as any,
      channelRepo as any,
      listingRepo as any,
      catalogRepo as any,
      ebayCategoryRepo as any,
      ebayMedia as any,
      compatibilityReconciler as any,
    );
  });

  describe('publish', () => {
    it('throws BadRequestException when storeIds is empty', async () => {
      await expect(svc.publish(validRequest({ storeIds: [] }))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when no images available', async () => {
      listingRepo.findOne = jest.fn().mockResolvedValue(null);
      catalogRepo.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        svc.publish(validRequest({ imageUrls: [] })),
      ).rejects.toThrow(/image/);
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
      expect(
        compatibilityReconciler.refreshPublishedOffer,
      ).toHaveBeenCalledWith('store-1', 'offer-123', 'SKU-001', undefined);
      expect(compatibilityReconciler.syncLiveListing).not.toHaveBeenCalled();
      expect(ebayMedia.hostImages).toHaveBeenCalledWith('store-1', [
        'https://img.example.com/1.jpg',
      ]);
      expect(
        inventoryApi.createOrReplaceItem.mock.calls[0][2].product.imageUrls,
      ).toEqual(['https://i.ebayimg.com/hostedhttps://img.example.com/1.jpg']);
    });

    it('revises an active Inventory API offer without calling publish again', async () => {
      const store = {
        id: 'store-1',
        storeName: 'My Store',
        config: {
          marketplace: 'EBAY_US',
          locationKey: 'default-loc',
          fulfillmentPolicyId: 'fp-1',
          paymentPolicyId: 'pp-1',
          returnPolicyId: 'rp-1',
        },
        locationKey: 'default-loc',
      };
      const req = validRequest({
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
        merchantLocationKey: 'default-loc',
      });
      const channel = {
        internalSku: req.sku,
        ebayInventorySku: req.sku,
        offerId: 'offer-123',
        listingId: 'listing-456',
      };
      inventoryApi.getOffer.mockResolvedValue({
        offerId: 'offer-123',
        sku: req.sku,
        marketplaceId: 'EBAY_US',
        status: 'PUBLISHED',
        listingId: 'listing-456',
        merchantLocationKey: 'default-loc',
        listingPolicies: {
          fulfillmentPolicyId: 'fp-1',
          paymentPolicyId: 'pp-1',
          returnPolicyId: 'rp-1',
        },
      });

      const result = await (svc as any).reviseExistingInventoryListing(
        store,
        'store-1',
        req,
        null,
        channel,
      );

      expect(result).toMatchObject({
        success: true,
        offerId: 'offer-123',
        listingId: 'listing-456',
      });
      expect(inventoryApi.createOrReplaceItem).toHaveBeenCalledWith(
        'store-1',
        req.sku,
        expect.any(Object),
      );
      expect(inventoryApi.updateOffer).toHaveBeenCalledWith(
        'store-1',
        'offer-123',
        expect.objectContaining({ sku: req.sku }),
      );
      expect(inventoryApi.publishOffer).not.toHaveBeenCalled();
      expect(tradingApi.reviseFixedPriceItem).not.toHaveBeenCalled();
    });

    it('republishes the same Inventory API offer only when eBay says it is unpublished', async () => {
      const store = {
        id: 'store-1',
        storeName: 'My Store',
        config: {
          marketplace: 'EBAY_US',
          locationKey: 'default-loc',
          fulfillmentPolicyId: 'fp-1',
          paymentPolicyId: 'pp-1',
          returnPolicyId: 'rp-1',
        },
        locationKey: 'default-loc',
      };
      const req = validRequest({
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
        merchantLocationKey: 'default-loc',
      });
      const channel = {
        internalSku: req.sku,
        ebayInventorySku: req.sku,
        offerId: 'offer-123',
        listingId: 'ended-listing-123',
      };
      inventoryApi.getOffer.mockResolvedValue({
        offerId: 'offer-123',
        sku: req.sku,
        marketplaceId: 'EBAY_US',
        status: 'UNPUBLISHED',
        merchantLocationKey: 'default-loc',
        listingPolicies: {
          fulfillmentPolicyId: 'fp-1',
          paymentPolicyId: 'pp-1',
          returnPolicyId: 'rp-1',
        },
      });

      const result = await (svc as any).reviseExistingInventoryListing(
        store,
        'store-1',
        req,
        null,
        channel,
      );

      expect(result).toMatchObject({
        success: true,
        offerId: 'offer-123',
        listingId: 'listing-456',
      });
      expect(inventoryApi.updateOffer).toHaveBeenCalledWith(
        'store-1',
        'offer-123',
        expect.objectContaining({ sku: req.sku }),
      );
      expect(inventoryApi.publishOffer).toHaveBeenCalledWith(
        'store-1',
        'offer-123',
      );
      expect(channel.listingId).toBe('listing-456');
    });

    it('replaces only an unavailable unpublished offer and keeps its Inventory SKU', async () => {
      const store = {
        id: 'store-1',
        storeName: 'My Store',
        config: {
          marketplace: 'EBAY_US',
          locationKey: 'default-loc',
          fulfillmentPolicyId: 'fp-1',
          paymentPolicyId: 'pp-1',
          returnPolicyId: 'rp-1',
        },
        locationKey: 'default-loc',
      };
      const req = validRequest({
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
        merchantLocationKey: 'default-loc',
      });
      const channel = {
        internalSku: req.sku,
        ebayInventorySku: req.sku,
        offerId: 'stale-offer',
        listingId: 'ended-listing-123',
      };
      const unavailable = Object.assign(
        new Error('This Offer is not available.'),
        {
          response: {
            data: {
              errors: [
                {
                  errorId: 25713,
                  message: 'This Offer is not available.',
                },
              ],
            },
          },
        },
      );
      inventoryApi.getOffer.mockResolvedValue({
        offerId: 'stale-offer',
        sku: req.sku,
        marketplaceId: 'EBAY_US',
        status: 'UNPUBLISHED',
        merchantLocationKey: 'default-loc',
        listingPolicies: {
          fulfillmentPolicyId: 'fp-1',
          paymentPolicyId: 'pp-1',
          returnPolicyId: 'rp-1',
        },
      });
      inventoryApi.updateOffer.mockRejectedValueOnce(unavailable);
      inventoryApi.createOffer.mockResolvedValueOnce({
        offerId: 'fresh-offer',
      });

      const result = await (svc as any).reviseExistingInventoryListing(
        store,
        'store-1',
        req,
        null,
        channel,
      );

      expect(result).toMatchObject({
        success: true,
        offerId: 'fresh-offer',
        listingId: 'listing-456',
      });
      expect(inventoryApi.deleteOffer).toHaveBeenCalledWith(
        'store-1',
        'stale-offer',
      );
      expect(inventoryApi.deleteItem).not.toHaveBeenCalled();
      expect(inventoryApi.createOffer).toHaveBeenCalledWith(
        'store-1',
        expect.objectContaining({ sku: req.sku }),
      );
      expect(inventoryApi.publishOffer).toHaveBeenCalledWith(
        'store-1',
        'fresh-offer',
      );
      expect(channel.offerId).toBe('fresh-offer');
      expect(channel.ebayInventorySku).toBe(req.sku);
    });

    it('reuses a verified existing offer after GetOffer reports an ended listing unavailable', async () => {
      const store = {
        id: 'store-1',
        storeName: 'My Store',
        config: {
          marketplace: 'EBAY_US',
          locationKey: 'default-loc',
          fulfillmentPolicyId: 'fp-1',
          paymentPolicyId: 'pp-1',
          returnPolicyId: 'rp-1',
        },
        locationKey: 'default-loc',
      };
      const req = validRequest({
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
        merchantLocationKey: 'default-loc',
      });
      const channel = {
        internalSku: req.sku,
        ebayInventorySku: req.sku,
        offerId: 'stale-offer',
        listingId: 'ended-listing-123',
      };
      const unavailable = Object.assign(
        new Error('This Offer is not available.'),
        {
          response: {
            data: {
              errors: [
                {
                  errorId: 25713,
                  message: 'This Offer is not available.',
                },
              ],
            },
          },
        },
      );
      const offerExists = Object.assign(
        new Error('Offer entity already exists.'),
        {
          response: {
            data: {
              errors: [
                {
                  errorId: 25002,
                  message: 'Offer entity already exists.',
                  parameters: [{ name: 'offerId', value: 'existing-offer' }],
                },
              ],
            },
          },
        },
      );
      const existingOffer = {
        ...(svc as any).buildOffer(req, store),
        offerId: 'existing-offer',
        status: 'PUBLISHED',
        listing: {
          listingId: 'listing-789',
          listingStatus: 'ACTIVE',
        },
      };
      inventoryApi.getOffer
        .mockRejectedValueOnce(unavailable)
        .mockResolvedValue(existingOffer);
      inventoryApi.createOffer.mockRejectedValueOnce(offerExists);
      tradingApi.getItemDetails.mockResolvedValue({
        listingStatus: 'Completed',
      });

      const result = await (svc as any).reviseExistingInventoryListing(
        store,
        'store-1',
        req,
        null,
        channel,
      );

      expect(result).toMatchObject({
        success: true,
        offerId: 'existing-offer',
        listingId: 'listing-789',
      });
      expect(tradingApi.getItemDetails).toHaveBeenCalledWith(
        'store-1',
        'ended-listing-123',
        'EBAY_US',
      );
      expect(inventoryApi.updateOffer).toHaveBeenCalledWith(
        'store-1',
        'existing-offer',
        expect.objectContaining({ sku: req.sku }),
      );
      expect(inventoryApi.publishOffer).not.toHaveBeenCalled();
      expect(channel.offerId).toBe('existing-offer');
      expect(channel.listingId).toBe('listing-789');
    });

    it('does not replace an unavailable offer while its linked listing is active', async () => {
      const store = {
        id: 'store-1',
        storeName: 'My Store',
        config: {
          marketplace: 'EBAY_US',
          locationKey: 'default-loc',
          fulfillmentPolicyId: 'fp-1',
          paymentPolicyId: 'pp-1',
          returnPolicyId: 'rp-1',
        },
        locationKey: 'default-loc',
      };
      const req = validRequest({
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
        merchantLocationKey: 'default-loc',
      });
      const channel = {
        internalSku: req.sku,
        ebayInventorySku: req.sku,
        offerId: 'stale-offer',
        listingId: 'possibly-active-listing',
      };
      const unavailable = Object.assign(
        new Error('This Offer is not available.'),
        {
          response: {
            data: {
              errors: [
                {
                  errorId: 25713,
                  message: 'This Offer is not available.',
                },
              ],
            },
          },
        },
      );
      inventoryApi.getOffer.mockRejectedValueOnce(unavailable);
      tradingApi.getItemDetails.mockResolvedValue({ listingStatus: 'Active' });

      const result = await (svc as any).reviseExistingInventoryListing(
        store,
        'store-1',
        req,
        null,
        channel,
      );

      expect(result).toMatchObject({ success: false });
      expect(result.error).toContain('ACTIVE');
      expect(inventoryApi.deleteOffer).not.toHaveBeenCalled();
      expect(inventoryApi.createOffer).not.toHaveBeenCalled();
    });

    it('uses the channel’s stored effective eBay SKU when it differs from the catalog SKU', async () => {
      const store = {
        id: 'store-1',
        storeName: 'My Store',
        config: {
          marketplace: 'EBAY_US',
          locationKey: 'default-loc',
          fulfillmentPolicyId: 'fp-1',
          paymentPolicyId: 'pp-1',
          returnPolicyId: 'rp-1',
        },
        locationKey: 'default-loc',
      };
      const req = validRequest({
        sku: 'BLA-18762',
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
        merchantLocationKey: 'default-loc',
      });
      const channel = {
        internalSku: 'BLA-18762',
        ebayInventorySku: 'BLAP-18762',
        offerId: 'offer-123',
        listingId: 'listing-456',
      };
      inventoryApi.getOffer.mockResolvedValue({
        offerId: 'offer-123',
        sku: 'BLAP-18762',
        marketplaceId: 'EBAY_US',
        status: 'PUBLISHED',
        listingId: 'listing-456',
        merchantLocationKey: 'default-loc',
        listingPolicies: {
          fulfillmentPolicyId: 'fp-1',
          paymentPolicyId: 'pp-1',
          returnPolicyId: 'rp-1',
        },
      });

      const result = await (svc as any).reviseExistingInventoryListing(
        store,
        'store-1',
        req,
        null,
        channel,
      );

      expect(result).toMatchObject({
        success: true,
        effectiveSku: 'BLAP-18762',
        listingId: 'listing-456',
      });
      expect(inventoryApi.createOrReplaceItem).toHaveBeenCalledWith(
        'store-1',
        'BLAP-18762',
        expect.any(Object),
      );
      expect(inventoryApi.updateOffer).toHaveBeenCalledWith(
        'store-1',
        'offer-123',
        expect.objectContaining({ sku: 'BLAP-18762' }),
      );
      expect(channel.internalSku).toBe('BLA-18762');
      expect(channel.ebayInventorySku).toBe('BLAP-18762');
    });

    it('routes mapped Inventory API listings through the Inventory API in Trading mode', async () => {
      const store = {
        id: 'store-1',
        storeName: 'My Store',
        config: {
          marketplace: 'EBAY_US',
          locationKey: 'default-loc',
          fulfillmentPolicyId: 'fp-1',
          paymentPolicyId: 'pp-1',
          returnPolicyId: 'rp-1',
        },
        locationKey: 'default-loc',
      };
      const account = {
        id: 'account-1',
        primaryStoreId: 'store-1',
        connectionSource: 'native_oauth',
      };
      const channel = {
        internalSku: 'SKU-001',
        ebayInventorySku: 'SKU-001',
        offerId: 'offer-123',
        listingId: 'listing-456',
      };
      const req = validRequest({
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
        merchantLocationKey: 'default-loc',
      });
      (svc as any).config = mockConfig({ EBAY_LISTING_API_MODE: 'trading' });
      (svc as any).categoryRequiresCompatibility = jest
        .fn()
        .mockResolvedValue(false);
      (svc as any).enrichPoliciesFromMarketplace = jest
        .fn()
        .mockResolvedValue(req);
      storeRepo.findOneBy = jest.fn().mockResolvedValue(store);
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(account);
      channelRepo.findOne = jest.fn().mockResolvedValue(channel);
      inventoryApi.getOffer.mockResolvedValue({
        offerId: 'offer-123',
        sku: req.sku,
        marketplaceId: 'EBAY_US',
        status: 'PUBLISHED',
        listingId: 'listing-456',
        merchantLocationKey: 'default-loc',
        listingPolicies: {
          fulfillmentPolicyId: 'fp-1',
          paymentPolicyId: 'pp-1',
          returnPolicyId: 'rp-1',
        },
      });

      const result = await (svc as any).publishToStore('store-1', req);

      expect(result).toMatchObject({
        success: true,
        offerId: 'offer-123',
        listingId: 'listing-456',
      });
      expect(inventoryApi.updateOffer).toHaveBeenCalled();
      expect(inventoryApi.publishOffer).not.toHaveBeenCalled();
      expect(tradingApi.addFixedPriceItem).not.toHaveBeenCalled();
      expect(tradingApi.reviseFixedPriceItem).not.toHaveBeenCalled();
    });

    it('recovers the catalog custom label SKU when the listing row is unavailable', async () => {
      listingRepo.findOne = jest.fn().mockResolvedValue(null);
      catalogRepo.findOne = jest.fn().mockResolvedValue({
        id: 'listing-1',
        sku: 'JAGUAR-6281-TAIL-2',
      });

      const enriched = await (svc as any).enrichPublishRequest(
        validRequest({ sku: 'listing-1' }),
      );

      expect(enriched.sku).toBe('JAGUAR-6281-TAIL-2');
    });

    it('fails closed when the eBay SKU belongs to an unrelated remote item', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'My Store',
        config: { marketplace: 'EBAY_US', locationKey: 'default-loc' },
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      listingRepo.findOne = jest.fn().mockResolvedValue({ cBrand: 'TRW' });
      catalogRepo.findOne = jest.fn().mockResolvedValue({
        id: 'catalog-1',
        sku: 'SKU-001',
      });
      inventoryApi.getItem.mockResolvedValue({
        sku: 'SKU-001',
        product: {
          title: 'Unrelated Cadillac Part',
          imageUrls: ['https://img.example.com/unrelated.jpg'],
        },
        condition: 'USED_EXCELLENT',
        availability: { shipToLocationAvailability: { quantity: 1 } },
      });
      inventoryApi.getOffersBySku.mockResolvedValue({
        offers: [{ offerId: 'other-offer', listingId: 'other-listing' }],
        total: 1,
      });

      const results = await svc.publish(validRequest());

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('SKU collision');
      expect(inventoryApi.createOrReplaceItem).not.toHaveBeenCalled();
      expect(inventoryApi.createOffer).not.toHaveBeenCalled();
    });

    it('uses BLAP without a postfix when a canonical BLA SKU is occupied', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'My Store',
        config: { marketplace: 'EBAY_US', locationKey: 'default-loc' },
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      listingRepo.findOne = jest.fn().mockResolvedValue({ cBrand: 'TRW' });
      inventoryApi.getItem.mockResolvedValueOnce({
        sku: 'BLA-19279',
        product: { title: 'Unrelated remote part', imageUrls: [] },
      });

      const results = await svc.publish(validRequest({ sku: 'BLA-19279' }));

      expect(results[0]).toMatchObject({
        success: true,
        effectiveSku: 'BLAP-19279',
      });
      expect(inventoryApi.createOrReplaceItem.mock.calls[0][1]).toBe(
        'BLAP-19279',
      );
      expect(inventoryApi.createOffer.mock.calls[0][1].sku).toBe('BLAP-19279');
    });

    it('does not publish a store when eBay image hosting fails', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'My Store',
        config: { marketplace: 'EBAY_US' },
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      ebayMedia.hostImages.mockRejectedValueOnce(
        new Error('eBay Picture Services unavailable'),
      );

      const results = await svc.publish(validRequest());

      expect(results[0]).toMatchObject({
        success: false,
        error: 'eBay Picture Services unavailable',
      });
      expect(inventoryApi.createOrReplaceItem).not.toHaveBeenCalled();
    });

    it('resolves a Motors parent category to a verified leaf before creating the offer', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'Motors Store',
        config: { marketplace: 'EBAY_MOTORS_US', locationKey: 'default-loc' },
        locationKey: 'default-loc',
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      listingRepo.findOne = jest.fn().mockResolvedValue(null);
      taxonomyApi.getCategorySubtree.mockResolvedValue({
        categorySubtreeNode: {
          category: { categoryId: '33707', categoryName: 'Controls' },
          categoryTreeNodeLevel: 3,
          leafCategoryTreeNode: false,
          childCategoryTreeNodes: [
            {
              category: {
                categoryId: '33716',
                categoryName: 'Switches & Controls',
              },
              categoryTreeNodeLevel: 4,
              leafCategoryTreeNode: true,
            },
          ],
        },
      });

      const results = await svc.publish(validRequest({ categoryId: '33707' }));

      expect(results[0].success).toBe(true);
      const offer = inventoryApi.createOffer.mock.calls[0][1];
      expect(offer.categoryId).toBe('33716');
    });

    it('uses and persists the known Motors leaf fallback when taxonomy is unavailable', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'Motors Store',
        config: { marketplace: 'EBAY_MOTORS_US', locationKey: 'default-loc' },
        locationKey: 'default-loc',
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      listingRepo.findOne = jest.fn().mockResolvedValue({
        id: 'listing-1',
        customLabelSku: 'SKU-001',
      });
      catalogRepo.findOne = jest.fn().mockResolvedValue({
        id: 'catalog-1',
        sku: 'SKU-001',
        optimizationPayload: {},
      });

      const results = await svc.publish(validRequest({ categoryId: '33707' }));

      expect(results[0].success).toBe(true);
      const offer = inventoryApi.createOffer.mock.calls[0][1];
      expect(offer.categoryId).toBe('9886');
      expect(catalogRepo.update).toHaveBeenCalledWith(
        'catalog-1',
        expect.objectContaining({
          categoryId: '9886',
          categoryName: 'Other Car & Truck Parts & Accessories',
        }),
      );
      expect(listingRepo.update).toHaveBeenCalledWith(
        { customLabelSku: 'SKU-001' },
        expect.objectContaining({ categoryId: '9886' }),
      );
    });

    it('fills a missing Motors category before creating a Trading API listing', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'Motors Store',
        config: { marketplace: 'EBAY_MOTORS_US', locationKey: 'default-loc' },
        locationKey: 'default-loc',
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      (inventoryApi as any).getLocation = jest.fn().mockResolvedValue({
        name: 'Warehouse',
        location: { address: { country: 'US' } },
      });

      const results = await svc.publish(
        validRequest({
          categoryId: '',
          aspects: { Brand: ['FEBEST'], Type: ['Brake Pad'] },
        }),
      );

      expect(results[0]).toMatchObject({
        success: true,
        listingId: 'trading-listing-456',
      });
      expect(tradingApi.addFixedPriceItem).toHaveBeenCalledWith(
        'store-1',
        expect.objectContaining({ categoryId: '9886' }),
        'EBAY_MOTORS_US',
      );
      expect(listingRepo.update).toHaveBeenCalledWith(
        { customLabelSku: 'SKU-001' },
        expect.objectContaining({
          categoryId: '9886',
          categoryName: 'Other Car & Truck Parts & Accessories',
        }),
      );
    });

    it('repairs a legacy motorcycle category when the listing text identifies a car coolant hose', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'Motors Store',
        config: { marketplace: 'EBAY_MOTORS_US', locationKey: 'default-loc' },
        locationKey: 'default-loc',
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      listingRepo.findOne = jest.fn().mockResolvedValue({
        id: 'listing-1',
        customLabelSku: 'SKU-001',
        title: 'FEBI 103451 Coolant Hose with quick coupling BMW X5',
        cType: 'AFTERMARKET',
        categoryId: '177983',
        categoryName: 'Radiators',
      });
      catalogRepo.findOne = jest.fn().mockResolvedValue({
        id: 'catalog-1',
        sku: 'SKU-001',
        title: '2006-2013 BMW X5 Coolant Hose',
        partType: 'AFTERMARKET',
        categoryId: '177983',
        categoryName: 'Radiators',
        optimizationPayload: {},
      });
      taxonomyApi.getCategorySubtree.mockResolvedValue({
        categorySubtreeNode: {
          category: { categoryId: '33601', categoryName: 'Coolant Hoses' },
          categoryTreeNodeLevel: 5,
          leafCategoryTreeNode: true,
        },
      });

      const results = await svc.publish(
        validRequest({
          title: 'FEBI 103451 Coolant Hose with quick coupling BMW X5',
          categoryId: '177983',
        }),
      );

      expect(results[0].success).toBe(true);
      expect(inventoryApi.createOffer.mock.calls[0][1].categoryId).toBe(
        '33601',
      );
      expect(catalogRepo.update).toHaveBeenCalledWith(
        'catalog-1',
        expect.objectContaining({
          categoryId: '33601',
          categoryName: 'Coolant Hoses',
        }),
      );
      expect(listingRepo.update).toHaveBeenCalledWith(
        { customLabelSku: 'SKU-001' },
        expect.objectContaining({
          categoryId: '33601',
          categoryName: 'Coolant Hoses',
        }),
      );
    });

    it('keeps the reviewed request title even when structured fields differ', async () => {
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
      listingRepo.findOne = jest.fn().mockResolvedValue({
        cBrand: 'Lincon',
        cType: 'Wiper Switch',
        cOeOemPartNumber: 'SW-7032',
        extractedModel: 'MKS',
      });
      catalogRepo.findOne = jest.fn().mockResolvedValue({
        fitmentData: [
          { Make: 'Lincoln', Model: 'MKS', Year: '2013' },
          { Make: 'Lincoln', Model: 'MKS', Year: '2013' },
        ],
      });

      const results = await svc.publish(validRequest());

      expect(results[0].success).toBe(true);
      const itemArg = inventoryApi.createOrReplaceItem.mock.calls[0][2];
      expect(itemArg.product.title).toBe('Test Brake Pad');
    });

    it('preserves an explicit zero quantity for an out-of-stock listing', async () => {
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
      listingRepo.findOne = jest.fn().mockResolvedValue({
        id: 'listing-1',
        customLabelSku: 'SKU-001',
        quantity: '0',
        cBrand: 'TRW',
      });

      await svc.publish(validRequest({ quantity: 0 }));

      const itemArg = inventoryApi.createOrReplaceItem.mock.calls[0][2];
      expect(itemArg.availability.shipToLocationAvailability.quantity).toBe(0);
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
          compatibleProducts: [
            {
              compatibilityProperties: [
                { name: 'Make', value: 'Toyota' },
                { name: 'Model', value: 'Camry' },
                { name: 'Year', value: '2018' },
              ],
            },
          ],
        },
      });

      await svc.publish(req);
      expect(inventoryApi.setCompatibility).toHaveBeenCalledWith(
        'store-1',
        expect.any(String),
        req.compatibility,
      );
    });

    it('derives compatibility from catalog product fitment when listing record has none', async () => {
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
      listingRepo.findOne = jest.fn().mockResolvedValue({
        id: 'l-1',
        customLabelSku: 'SKU-001',
        title: 'Brake Pad',
        description: '<p>Desc</p>',
        cBrand: 'TRW',
      });
      catalogRepo.findOne = jest.fn().mockResolvedValue({
        id: 'cp-1',
        sku: 'SKU-001',
        fitmentData: [
          {
            Make: 'Toyota',
            Model: 'Camry',
            Year: '2018',
            Trim: 'LE',
            MvlStatus: 'valid',
          },
        ],
      });

      const req = validRequest({ compatibility: undefined });

      await svc.publish(req);
      expect(inventoryApi.setCompatibility).toHaveBeenCalledWith(
        'store-1',
        expect.any(String),
        {
          compatibleProducts: [
            {
              compatibilityProperties: [
                { name: 'Make', value: 'Toyota' },
                { name: 'Model', value: 'Camry' },
                { name: 'Year', value: '2018' },
                { name: 'Trim', value: 'LE' },
              ],
            },
          ],
        },
      );
    });

    it('omits compatibility for a marketplace that does not support Motors fitment', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'German Store',
        config: { marketplace: 'EBAY_DE', locationKey: 'default-loc' },
        locationKey: 'default-loc',
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      listingRepo.findOne = jest.fn().mockResolvedValue(null);

      await svc.publish(
        validRequest({
          compatibility: {
            compatibleProducts: [
              {
                compatibilityProperties: [
                  { name: 'Make', value: 'Mini' },
                  { name: 'Model', value: 'Cooper' },
                  { name: 'Year', value: '2018' },
                ],
              },
            ],
          },
        }),
      );

      expect(inventoryApi.setCompatibility).not.toHaveBeenCalled();
      expect(inventoryApi.publishOffer).toHaveBeenCalled();
    });

    // Since a7b1b9f0 (2026-07-12) a fitment-capable Motors category without
    // structured rows publishes with description-only fitment and a warning
    // instead of being blocked (docs/decisions.md). Stale structured rows must
    // still be cleared so eBay does not keep compatibility from a prior publish.
    it('publishes a fitment-capable Motors category without structured rows after clearing stale compatibility', async () => {
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
      catalogRepo.findOne = jest.fn().mockResolvedValue(null);
      taxonomyApi.getCompatibilityProperties.mockResolvedValue([
        { propertyName: 'Year', localizedPropertyName: 'Year' },
        { propertyName: 'Make', localizedPropertyName: 'Make' },
        { propertyName: 'Model', localizedPropertyName: 'Model' },
      ]);

      const results = await svc.publish(
        validRequest({ compatibility: undefined }),
      );

      expect(results[0].success).toBe(true);
      expect(compatibilityReconciler.syncInventory).toHaveBeenCalledWith(
        'store-1',
        'SKU-001',
        undefined,
      );
      expect(inventoryApi.setCompatibility).not.toHaveBeenCalled();
      expect(inventoryApi.publishOffer).toHaveBeenCalled();
    });

    it('does not publish when eBay compatibility readback is missing rows', async () => {
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
      inventoryApi.getCompatibility = jest.fn().mockResolvedValue({
        compatibleProducts: [],
      });
      // Readback verification lives in EbayCompatibilityReconciliationService
      // (covered by its own spec); simulate its failure here so this suite
      // asserts the publish flow stops before publishOffer.
      compatibilityReconciler.syncInventory.mockRejectedValue(
        new BadRequestException(
          'eBay compatibility verification failed for SKU SKU-001 (Inventory API): ' +
            '1 expected row(s) missing and 0 stale row(s) present.',
        ),
      );

      const results = await svc.publish(
        validRequest({
          compatibility: {
            compatibleProducts: [
              {
                compatibilityProperties: [
                  { name: 'Year', value: '2018' },
                  { name: 'Make', value: 'Toyota' },
                  { name: 'Model', value: 'Camry' },
                ],
              },
            ],
          },
        }),
      );

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('compatibility verification failed');
      expect(inventoryApi.publishOffer).not.toHaveBeenCalled();
    });

    it('retries invalid compatibilities with validated core vehicle fields', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'My Store',
        config: { marketplace: 'EBAY_MOTORS_US', locationKey: 'default-loc' },
        locationKey: 'default-loc',
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      listingRepo.findOne = jest.fn().mockResolvedValue(null);

      const compatibility = {
        compatibleProducts: [
          {
            compatibilityProperties: [
              { name: 'Make', value: 'BMW' },
              { name: 'Model', value: 'X5' },
              { name: 'Year', value: '2008' },
              { name: 'Trim', value: 'xDrive30i' },
              { name: 'Engine', value: '2996 ccm, 200 KW, 272 PS' },
            ],
            notes: 'Platform E70',
          },
        ],
      };
      const invalidCompatibilities = Object.assign(
        new Error('All compatibilities are invalid'),
        {
          response: {
            data: {
              errors: [
                {
                  errorId: 25002,
                  message:
                    'A user error has occurred. All compatibilities are invalid, Item not listed.',
                },
              ],
            },
          },
        },
      );
      inventoryApi.publishOffer = jest
        .fn()
        .mockRejectedValueOnce(invalidCompatibilities)
        .mockResolvedValueOnce({ listingId: 'listing-456' });

      const results = await svc.publish(validRequest({ compatibility }));

      const coreCompatibility = {
        compatibleProducts: [
          {
            compatibilityProperties: [
              { name: 'Make', value: 'BMW' },
              { name: 'Model', value: 'X5' },
              { name: 'Year', value: '2008' },
            ],
          },
        ],
      };
      expect(results[0].success).toBe(true);
      expect(inventoryApi.setCompatibility).toHaveBeenNthCalledWith(
        1,
        'store-1',
        expect.any(String),
        compatibility,
      );
      expect(inventoryApi.setCompatibility).toHaveBeenNthCalledWith(
        2,
        'store-1',
        expect.any(String),
        coreCompatibility,
      );
      expect(
        compatibilityReconciler.refreshPublishedOffer,
      ).toHaveBeenLastCalledWith(
        'store-1',
        'offer-123',
        'SKU-001',
        coreCompatibility,
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
            errors: [
              {
                errorId: 25002,
                parameters: [{ name: 'offerId', value: 'existing-offer' }],
              },
            ],
          },
        },
      });
      inventoryApi.createOffer = jest.fn().mockRejectedValue(error25002);

      const results = await svc.publish(validRequest());
      expect(inventoryApi.updateOffer).toHaveBeenCalledWith(
        'store-1',
        'existing-offer',
        expect.any(Object),
      );
      expect(results[0].success).toBe(true);
    });

    // The purge-and-recreate 25713 recovery was superseded on 2026-09-30
    // (CHANGELOG): recovery now runs only on the mapped-channel revise path
    // after eBay confirms the listing ended, and never deletes the Inventory
    // item. A fresh publish must fail closed instead.
    it('fails closed without purging inventory when a fresh offer is reported unavailable', async () => {
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
      inventoryApi.publishOffer.mockRejectedValueOnce(
        Object.assign(new Error('This Offer is not available.'), {
          response: {
            data: {
              errors: [
                { errorId: 25713, message: 'This Offer is not available.' },
              ],
            },
          },
        }),
      );

      const results = await svc.publish(validRequest());

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('This Offer is not available');
      expect(inventoryApi.deleteItem).not.toHaveBeenCalled();
      expect(inventoryApi.deleteOffer).not.toHaveBeenCalled();
      expect(inventoryApi.createOffer).toHaveBeenCalledTimes(1);
      expect(inventoryApi.publishOffer).toHaveBeenCalledTimes(1);
    });

    it('processes multiple stores', async () => {
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'Store A',
        config: { marketplace: 'EBAY_US' },
      });
      connectedAccountRepo.findOne = jest.fn().mockResolvedValue(null);
      listingRepo.findOne = jest.fn().mockResolvedValue(null);

      const results = await svc.publish(
        validRequest({ storeIds: ['store-1', 'store-1'] }),
      );
      expect(results).toHaveLength(2);
    });
  });

  describe('endListing', () => {
    it('calls withdrawOffer', async () => {
      await svc.endListing('store-1', 'offer-123');
      expect(inventoryApi.withdrawOffer).toHaveBeenCalledWith(
        'store-1',
        'offer-123',
      );
    });
  });

  describe('updatePriceQuantity', () => {
    it('delegates to inventoryApi.bulkUpdatePriceQuantity', async () => {
      await svc.updatePriceQuantity('store-1', [
        { offerId: 'offer-1', price: 29.99, quantity: 10 },
      ]);
      expect(inventoryApi.bulkUpdatePriceQuantity).toHaveBeenCalledWith(
        'store-1',
        expect.any(Array),
      );
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

  describe('Trading API selection', () => {
    it('publishes the verified Fashion warehouse address to Trading', async () => {
      (svc as any).config = mockConfig();
      storeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'store-1',
        storeName: 'Fashion Store',
        config: { marketplace: 'EBAY_US' },
        verticalConfig: { enabledVerticals: ['fashion'] },
        locationKey: 'AE_Dubai',
        fulfillmentPolicyId: 'fp-1',
        paymentPolicyId: 'pp-1',
        returnPolicyId: 'rp-1',
      });
      (inventoryApi as any).getLocation = jest.fn().mockResolvedValue({
        merchantLocationKey: 'US_Dallas_75234',
        merchantLocationStatus: 'ENABLED',
        name: 'Prime Wardrobe warehouse',
        location: {
          address: {
            city: 'Dallas',
            stateOrProvince: 'TX',
            postalCode: '75234',
            country: 'US',
          },
        },
      });

      const [result] = await svc.publish(
        validRequest({ merchantLocationKey: 'US_Dallas_75234' }),
      );

      expect(result.success).toBe(true);
      expect(tradingApi.addFixedPriceItem).toHaveBeenCalledWith(
        'store-1',
        expect.objectContaining({
          location: 'Dallas, TX',
          postalCode: '75234',
          country: 'US',
        }),
        'EBAY_US',
      );
    });

    it('defaults new listings to Trading API when no mode is configured', () => {
      (svc as any).config = mockConfig();
      expect(
        (svc as any).shouldUseTradingApi(
          validRequest({ aspects: { Brand: ['TRW'] } }),
        ),
      ).toBe(true);
    });

    it('routes FEBEST by brand even when the global mode is inventory', () => {
      expect(
        (svc as any).shouldUseTradingApi(
          validRequest({ aspects: { Brand: ['FEBEST'] } }),
        ),
      ).toBe(true);
      expect(
        (svc as any).shouldUseTradingApi(
          validRequest({ aspects: { Brand: ['TRW'] } }),
        ),
      ).toBe(false);
    });

    it('accepts the Trading API revise response without a timing-sensitive GetItem readback', async () => {
      const store = { id: 'store-1', storeName: 'Test Store' } as any;
      const channel = {
        listingId: 'listing-legacy-123',
        internalSku: 'OLD-SKU',
        channelPrice: '1.00',
        channelQuantity: 1,
        listingStatus: 'published',
        lastErrorCode: 'previous-error',
        lastErrorMessage: 'previous failure',
      } as any;
      const req = validRequest({ currency: 'USD' });

      const result = await (svc as any).reviseExistingTradingListing(
        store,
        'store-1',
        req,
        null,
        'EBAY_MOTORS_US',
        channel,
      );

      expect(tradingApi.reviseFixedPriceItem).toHaveBeenCalledWith(
        'store-1',
        'listing-legacy-123',
        expect.objectContaining({ title: req.title, quantity: req.quantity }),
        'EBAY_MOTORS_US',
      );
      expect(tradingApi.getItemDetails).not.toHaveBeenCalled();
      expect(channelRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          internalSku: req.sku,
          listingStatus: 'published',
          lastErrorCode: null,
          lastErrorMessage: null,
        }),
      );
      expect(result).toMatchObject({
        success: true,
        listingId: 'listing-legacy-123',
        effectiveSku: req.sku,
      });
    });

    it('re-lists an ended legacy listing on error 291 and stores its new item ID', async () => {
      tradingApi.reviseFixedPriceItem.mockRejectedValueOnce(
        new Error(
          'ReviseFixedPriceItem failed (291): You are not allowed to revise ended listings.',
        ),
      );
      const store = { id: 'store-1', storeName: 'Test Store' } as any;
      const channel = {
        listingId: 'listing-ended-123',
        listingUrl: 'https://www.ebay.com/itm/listing-ended-123',
        internalSku: 'OLD-SKU',
        channelPrice: '1.00',
        channelQuantity: 1,
        listingStatus: 'published',
      } as any;
      const req = validRequest({ currency: 'USD' });

      const result = await (svc as any).reviseExistingTradingListing(
        store,
        'store-1',
        req,
        null,
        'EBAY_MOTORS_US',
        channel,
      );

      expect(tradingApi.relistFixedPriceItem).toHaveBeenCalledWith(
        'store-1',
        'listing-ended-123',
        expect.objectContaining({ title: req.title, quantity: req.quantity }),
        'EBAY_MOTORS_US',
      );
      expect(channelRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: 'trading-relisted-789',
          listingUrl: 'https://www.ebay.com/itm/trading-relisted-789',
          listingStatus: 'published',
        }),
      );
      expect(result).toMatchObject({
        success: true,
        listingId: 'trading-relisted-789',
        effectiveSku: req.sku,
      });
    });

    it('does not re-list when a Trading API revise fails with another error', async () => {
      tradingApi.reviseFixedPriceItem.mockRejectedValueOnce(
        new Error('ReviseFixedPriceItem failed (240): policy restriction.'),
      );

      const result = await (svc as any).reviseExistingTradingListing(
        { id: 'store-1', storeName: 'Test Store' },
        'store-1',
        validRequest({ currency: 'USD' }),
        null,
        'EBAY_MOTORS_US',
        { listingId: 'listing-legacy-123' },
      );

      expect(tradingApi.relistFixedPriceItem).not.toHaveBeenCalled();
      expect(result).toMatchObject({ success: false });
    });
  });

  describe('publishByListingIds', () => {
    it('throws when storeIds empty', async () => {
      await expect(svc.publishByListingIds(['l-1'], [])).rejects.toThrow(
        BadRequestException,
      );
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
      const offer = (svc as any).buildOffer(validRequest(), {
        config: { marketplace: 'EBAY_US' },
      });
      expect(offer.listingDuration).toBe('GTC');
      expect(offer.format).toBe('FIXED_PRICE');
      expect(offer.pricingSummary.price.value).toBe('49.99');
    });
  });

  describe('fallbackConditionForCategory (private)', () => {
    it('maps USED_GOOD to USED_EXCELLENT', () => {
      const result = (svc as any).fallbackConditionForCategory(
        validRequest({ condition: 'USED_GOOD' }),
      );
      expect(result).toBe('USED_EXCELLENT');
    });

    it('returns undefined for NEW condition', () => {
      const result = (svc as any).fallbackConditionForCategory(
        validRequest({ condition: 'NEW' }),
      );
      expect(result).toBeUndefined();
    });

    it('returns undefined for USED_EXCELLENT (already the fallback)', () => {
      const result = (svc as any).fallbackConditionForCategory(
        validRequest({ condition: 'USED_EXCELLENT' }),
      );
      expect(result).toBeUndefined();
    });
  });

  describe('validateDirectOffer (private)', () => {
    it('returns error for missing fulfillment policy', () => {
      const error = (svc as any).validateDirectOffer(
        {
          listingPolicies: { paymentPolicyId: 'p', returnPolicyId: 'r' },
          categoryId: '6028',
          merchantLocationKey: 'loc',
        },
        { storeName: 'Test' },
      );
      expect(error).toContain('fulfillment');
    });

    it('returns error for missing category', () => {
      const error = (svc as any).validateDirectOffer(
        {
          listingPolicies: {
            fulfillmentPolicyId: 'f',
            paymentPolicyId: 'p',
            returnPolicyId: 'r',
          },
          categoryId: '',
          merchantLocationKey: 'loc',
        },
        { storeName: 'Test' },
      );
      expect(error).toContain('category');
    });

    it('returns null when all fields are valid', () => {
      const error = (svc as any).validateDirectOffer(
        {
          listingPolicies: {
            fulfillmentPolicyId: 'f',
            paymentPolicyId: 'p',
            returnPolicyId: 'r',
          },
          categoryId: '6028',
          merchantLocationKey: 'loc',
        },
        { storeName: 'Test' },
      );
      expect(error).toBeNull();
    });
  });

  describe('business policy resolution', () => {
    const account = {
      id: 'acct-1',
      connectionSource: 'native_oauth',
      organizationId: 'org-1',
    };
    const store = {
      id: 'store-1',
      storeName: 'My Store',
      ebayMarketplaceId: 'EBAY_US',
      config: { marketplace: 'EBAY_US' },
      locationKey: 'loc-1',
    };

    it('prefers exact profile-name matches and does not rewrite store defaults', async () => {
      mpRepo.findOne = jest.fn().mockResolvedValue({
        enabled: true,
        defaultInventoryLocationKey: 'loc-1',
        defaultFulfillmentPolicyId: '10000000001',
        defaultPaymentPolicyId: '10000000002',
        defaultReturnPolicyId: '10000000003',
      });
      policyRepo.find = jest.fn().mockResolvedValue([
        {
          policyType: 'fulfillment',
          name: 'Shipping 4 KG',
          ebayPolicyId: '20000000001',
          isDefault: false,
          rawPayload: {},
        },
        {
          policyType: 'payment',
          name: 'Managed Payments',
          ebayPolicyId: '20000000002',
          isDefault: false,
          rawPayload: {},
        },
        {
          policyType: 'return',
          name: 'Returns 30 Days',
          ebayPolicyId: '20000000003',
          isDefault: false,
          rawPayload: {},
        },
      ]);

      const result = await (svc as any).enrichPoliciesFromMarketplace(
        account,
        store,
        validRequest({
          fulfillmentPolicyId: '10000000001',
          paymentPolicyId: '10000000002',
          returnPolicyId: '10000000003',
          requestedFulfillmentPolicyName: 'shipping 4 kg',
          requestedPaymentPolicyName: 'Managed Payments',
          requestedReturnPolicyName: 'Returns 30 Days',
          merchantLocationKey: 'loc-1',
        }),
      );

      expect(result.fulfillmentPolicyId).toBe('20000000001');
      expect(result.paymentPolicyId).toBe('20000000002');
      expect(result.returnPolicyId).toBe('20000000003');
      expect(mpRepo.save).not.toHaveBeenCalled();
    });

    it('revalidates a persisted eBay location key before publishing', async () => {
      const mpRow = {
        enabled: true,
        defaultInventoryLocationKey: 'stale-location',
        defaultFulfillmentPolicyId: '10000000001',
        defaultPaymentPolicyId: '10000000002',
        defaultReturnPolicyId: '10000000003',
      };
      mpRepo.findOne = jest.fn().mockResolvedValue(mpRow);
      inventoryApi.ensureMerchantLocation.mockResolvedValue('AE_Dubai');

      const result = await (svc as any).enrichPoliciesFromMarketplace(
        account,
        store,
        validRequest({
          merchantLocationKey: 'stale-location',
          fulfillmentPolicyId: '10000000001',
          paymentPolicyId: '10000000002',
          returnPolicyId: '10000000003',
        }),
      );

      expect(inventoryApi.ensureMerchantLocation).toHaveBeenCalledWith(
        'store-1',
        'stale-location',
      );
      expect(result.merchantLocationKey).toBe('AE_Dubai');
      expect(mpRow.defaultInventoryLocationKey).toBe('AE_Dubai');
      expect(mpRepo.save).toHaveBeenCalledWith(mpRow);
    });

    it('normalizes a persisted USA default before publishing', async () => {
      const mpRow = {
        enabled: true,
        defaultInventoryLocationKey: 'USA',
        defaultFulfillmentPolicyId: '10000000001',
        defaultPaymentPolicyId: '10000000002',
        defaultReturnPolicyId: '10000000003',
      };
      mpRepo.findOne = jest.fn().mockResolvedValue(mpRow);
      inventoryApi.ensureMerchantLocation.mockResolvedValue('AE_Dubai');

      const result = await (svc as any).enrichPoliciesFromMarketplace(
        account,
        store,
        validRequest({
          merchantLocationKey: 'USA',
          fulfillmentPolicyId: '10000000001',
          paymentPolicyId: '10000000002',
          returnPolicyId: '10000000003',
        }),
      );

      // ensureMerchantLocation owns legacy-key normalization (USA/default →
      // AE_Dubai, UAE-only verification); see ebay-inventory-location.util.spec.
      expect(inventoryApi.ensureMerchantLocation).toHaveBeenCalledWith(
        'store-1',
        'USA',
      );
      expect(result.merchantLocationKey).toBe('AE_Dubai');
      expect(mpRow.defaultInventoryLocationKey).toBe('AE_Dubai');
      expect(mpRepo.save).toHaveBeenCalledWith(mpRow);
    });

    const namedPoliciesWithoutShipping = [
      {
        policyType: 'payment',
        name: 'Managed Payments',
        ebayPolicyId: '20000000002',
        isDefault: false,
        rawPayload: {},
      },
      {
        policyType: 'return',
        name: 'Returns 30 Days',
        ebayPolicyId: '20000000003',
        isDefault: false,
        rawPayload: {},
      },
    ];
    const missingShippingRequest = () =>
      validRequest({
        requestedFulfillmentPolicyName: 'Missing Shipping Policy',
        requestedPaymentPolicyName: 'Managed Payments',
        requestedReturnPolicyName: 'Returns 30 Days',
        merchantLocationKey: 'loc-1',
      });

    // Since 2026-08-08 (e7de0fed) a named profile missing on the target store
    // falls back to that marketplace's default policy, so cross-store
    // publishes (e.g. US listing → EBAY_DE account) use the target's own
    // policies instead of an ID from another account.
    it('falls back to the marketplace default when a named profile is missing', async () => {
      mpRepo.findOne = jest.fn().mockResolvedValue({
        enabled: true,
        defaultInventoryLocationKey: 'loc-1',
        defaultFulfillmentPolicyId: '10000000001',
        defaultPaymentPolicyId: '10000000002',
        defaultReturnPolicyId: '10000000003',
      });
      policyRepo.find = jest
        .fn()
        .mockResolvedValue(namedPoliciesWithoutShipping);

      const result = await (svc as any).enrichPoliciesFromMarketplace(
        account,
        store,
        missingShippingRequest(),
      );

      expect(result.fulfillmentPolicyId).toBe('10000000001');
      expect(result.paymentPolicyId).toBe('20000000002');
      expect(result.returnPolicyId).toBe('20000000003');
    });

    it('blocks a missing named profile when no default policy is set', async () => {
      mpRepo.findOne = jest.fn().mockResolvedValue({
        enabled: true,
        defaultInventoryLocationKey: 'loc-1',
      });
      policyRepo.find = jest
        .fn()
        .mockResolvedValue(namedPoliciesWithoutShipping);

      await expect(
        (svc as any).enrichPoliciesFromMarketplace(
          account,
          store,
          missingShippingRequest(),
        ),
      ).rejects.toThrow(/Missing Shipping Policy/);
    });
  });
});
