import type { Repository } from 'typeorm';
import type { ListingStoreOverride } from '../entities/listing-store-override.entity.js';
import type { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import type { EbayBusinessPolicy } from '../entities/ebay-business-policy.entity.js';
import type { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import type { CatalogPublishResolverService } from './catalog-publish-resolver.service.js';
import type { EbayMarketplaceConfigService } from './ebay-marketplace-config.service.js';
import type { EbayInventoryApiService } from '../../../channels/ebay/ebay-inventory-api.service.js';
import { ListingBuilderService } from './listing-builder.service.js';

/* ── Helpers ── */

function createRepo<T extends Record<string, unknown>>() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    create: jest.fn((d: Partial<T>) => ({ id: 'new-id', ...d }) as T),
    save: jest.fn((d: T) => Promise.resolve({ id: 'saved-id', ...d } as T)),
  } as unknown as Repository<T>;
}

/* ── Tests ── */

describe('ListingBuilderService', () => {
  let svc: ListingBuilderService;
  let overrideRepo: ReturnType<typeof createRepo<ListingStoreOverride>>;
  let mpRepo: ReturnType<typeof createRepo<EbayAccountMarketplace>>;
  let policyRepo: ReturnType<typeof createRepo<EbayBusinessPolicy>>;
  let accountRepo: ReturnType<typeof createRepo<ConnectedEbayAccount>>;
  let publishResolver: { resolve: jest.Mock };
  let marketplaceConfig: { require: jest.Mock; get: jest.Mock };
  let inventoryApi: { ensureMerchantLocation: jest.Mock };

  beforeEach(() => {
    overrideRepo = createRepo<ListingStoreOverride>();
    mpRepo = createRepo<EbayAccountMarketplace>();
    policyRepo = createRepo<EbayBusinessPolicy>();
    accountRepo = createRepo<ConnectedEbayAccount>();
    publishResolver = { resolve: jest.fn() };
    marketplaceConfig = {
      require: jest.fn().mockReturnValue({
        currency: 'USD',
        locale: 'en_US',
        supportsMotorsFitment: true,
      }),
      get: jest.fn().mockReturnValue({
        currency: 'USD',
        locale: 'en_US',
        supportsMotorsFitment: true,
      }),
    };
    inventoryApi = {
      ensureMerchantLocation: jest.fn().mockResolvedValue('default-loc'),
    };

    svc = new ListingBuilderService(
      overrideRepo,
      mpRepo,
      policyRepo,
      accountRepo,
      marketplaceConfig as unknown as EbayMarketplaceConfigService,
      publishResolver as unknown as CatalogPublishResolverService,
      inventoryApi as unknown as EbayInventoryApiService,
    );
  });

  it('returns blocking errors when catalog product not found', async () => {
    publishResolver.resolve.mockResolvedValue(null);

    const result = await svc.build({
      catalogProductId: 'missing',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(result.blockingErrors).toContainEqual(
      expect.stringContaining('not found'),
    );
  });

  it('applies title override from ListingStoreOverride', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'SKU-001',
        title: 'Original Title',
        description: '<p>Desc</p>',
        brand: 'TRW',
        mpn: 'BP-123',
        partType: 'Brake Pad',
        price: 49.99,
        quantity: 5,
        categoryId: '6028',
        conditionId: '3000',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      warnings: [],
    });
    overrideRepo.findOne = jest.fn().mockResolvedValue({
      titleOverride: 'Custom Title Override',
    });

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(result.publishRequest.title).toContain('Custom Title Override');
  });

  it('preserves the stored catalog title when no override exists', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'SKU-001',
        title: 'Catalog Title',
        description: '<p>Desc</p>',
        brand: 'TRW',
        mpn: 'BP-123',
        partType: 'Brake Pad',
        price: 49.99,
        quantity: 5,
        categoryId: '6028',
        conditionId: '3000',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      warnings: [],
    });
    overrideRepo.findOne = jest.fn().mockResolvedValue(null);

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(result.publishRequest.title).toBe('Catalog Title');
    expect(result.warnings).not.toContainEqual(
      expect.stringContaining('recomposed'),
    );
    expect(result.publishRequest.price).toBe(49.99);
  });

  it('keeps the reviewed system title instead of recomposing it at publish time', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'BNTLY-7130-Silver-D1-007',
        title: '2003-2011 Bentley Continental Seat Module 3D0959760C OEM Used',
        description: '<p>Desc</p>',
        brand: null,
        mpn: '3D0959760C',
        partType: 'Seat Module',
        price: 199.99,
        quantity: 1,
        categoryId: '33701',
        conditionId: '3000',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      listingRecord: {
        cBrand: 'Bently',
      },
      catalogProduct: {
        oemPartNumber: '3D0959760C',
        fitmentData: [
          { Make: 'Bentley', Model: 'Continental', Year: '2003' },
          { Make: 'Bentley', Model: 'Continental', Year: '2008' },
          { Make: 'Bentley', Model: 'Continental', Year: '2011' },
        ],
      },
      warnings: [],
    });
    overrideRepo.findOne = jest.fn().mockResolvedValue(null);

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(result.publishRequest.title).toBe(
      '2003-2011 Bentley Continental Seat Module 3D0959760C OEM Used',
    );
  });

  it('keeps the raw brand when fitmentData lists a different (platform-sharing) manufacturer', async () => {
    // Regression test from a DB-wide audit: fitmentData[0].Make is not
    // always the same manufacturer as the part itself — a Nissan part's
    // compatible-vehicle fitment rows can legitimately include Infiniti
    // (shared platform). Overriding "Nissan" with "Infiniti" here would be
    // a NEW mislabeling bug, not a fix — only same-make typos/formatting
    // variants (see isSameMakeVariant) should ever override the raw brand.
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'NISSAN-Q50-042',
        title: 'Nissan Altima Headlight Assembly',
        description: '<p>Desc</p>',
        brand: null,
        mpn: 'HL-9910',
        partType: 'Headlight Assembly',
        price: 89.99,
        quantity: 1,
        categoryId: '33710',
        conditionId: '3000',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      listingRecord: {
        cBrand: 'NISSAN',
      },
      catalogProduct: {
        oemPartNumber: 'HL-9910',
        fitmentData: [
          { Make: 'Infiniti', Model: 'Q50', Year: '2015' },
          { Make: 'Nissan', Model: 'Altima', Year: '2015' },
        ],
      },
      warnings: [],
    });
    overrideRepo.findOne = jest.fn().mockResolvedValue(null);

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(result.publishRequest.title).toContain('Nissan');
    expect(result.publishRequest.title).not.toContain('Infiniti');
  });

  it('resolves each listing profile name to the target account policy IDs', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'SKU-001',
        title: 'Reviewed Listing Title',
        description: '<p>Desc</p>',
        brand: 'TRW',
        price: 49.99,
        quantity: 1,
        categoryId: '9886',
        conditionId: '3000',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      listingRecord: {
        shippingProfileName: 'Shipping 4 KG',
        returnProfileName: 'Returns 30 Days',
        paymentProfileName: 'Managed Payments',
      },
      catalogProduct: {},
      warnings: [],
    });
    mpRepo.findOne = jest.fn().mockResolvedValue({
      defaultFulfillmentPolicyId: '10000000001',
      defaultReturnPolicyId: '10000000002',
      defaultPaymentPolicyId: '10000000003',
      defaultInventoryLocationKey: 'loc-1',
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
        policyType: 'return',
        name: 'Returns 30 Days',
        ebayPolicyId: '20000000002',
        isDefault: false,
        rawPayload: {},
      },
      {
        policyType: 'payment',
        name: 'Managed Payments',
        ebayPolicyId: '20000000003',
        isDefault: false,
        rawPayload: {},
      },
    ]);

    const result = await svc.build({
      catalogProductId: 'cp-1',
      sourceListingId: 'lr-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_MOTORS_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(publishResolver.resolve).toHaveBeenCalledWith('lr-1');
    expect(result.publishRequest.fulfillmentPolicyId).toBe('20000000001');
    expect(result.publishRequest.returnPolicyId).toBe('20000000002');
    expect(result.publishRequest.paymentPolicyId).toBe('20000000003');
    expect(result.publishRequest.requestedFulfillmentPolicyName).toBe(
      'Shipping 4 KG',
    );
    expect(result.blockingErrors).toEqual([]);
  });

  it('forwards a cache-missing profile name for strict eBay refresh', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'SKU-001',
        title: 'Reviewed Listing Title',
        description: '<p>Desc</p>',
        brand: 'TRW',
        price: 49.99,
        quantity: 1,
        categoryId: '9886',
        conditionId: '3000',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      listingRecord: { shippingProfileName: 'Missing Shipping Policy' },
      catalogProduct: {},
      warnings: [],
    });
    mpRepo.findOne = jest.fn().mockResolvedValue({
      defaultFulfillmentPolicyId: '10000000001',
      defaultReturnPolicyId: '10000000002',
      defaultPaymentPolicyId: '10000000003',
      defaultInventoryLocationKey: 'loc-1',
    });

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_MOTORS_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(result.publishRequest.requestedFulfillmentPolicyName).toBe(
      'Missing Shipping Policy',
    );
    expect(result.publishRequest.fulfillmentPolicyId).toBe('10000000001');
    expect(result.warnings).toContainEqual(
      expect.stringContaining('Missing Shipping Policy'),
    );
    expect(result.blockingErrors).toEqual([]);
  });

  it('adds blocking error for missing images', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'SKU-001',
        title: 'Title',
        description: '<p>Desc</p>',
        brand: 'TRW',
        mpn: 'BP-123',
        price: 49.99,
        quantity: 5,
        categoryId: '6028',
        imageUrls: [],
      },
      warnings: [],
    });
    overrideRepo.findOne = jest.fn().mockResolvedValue(null);

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(result.blockingErrors).toContainEqual(
      expect.stringContaining('image'),
    );
  });

  it('builds compatibility from fitmentData when present', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'SKU-001',
        title: 'Brake Pad',
        description: '<p>Desc</p>',
        brand: 'TRW',
        price: 49.99,
        quantity: 5,
        categoryId: '6028',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      catalogProduct: {
        fitmentData: [
          { Make: 'Toyota', Model: 'Camry', Year: '2018', MvlStatus: 'valid' },
        ],
      },
      warnings: [],
    });
    overrideRepo.findOne = jest.fn().mockResolvedValue(null);

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(
      result.publishRequest.compatibility?.compatibleProducts?.length,
    ).toBeGreaterThan(0);
  });

  it('falls back to fitmentRows when fitmentData is empty', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'SKU-001',
        title: 'Brake Pad',
        description: '<p>Desc</p>',
        brand: 'TRW',
        price: 49.99,
        quantity: 5,
        categoryId: '6028',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      catalogProduct: {
        fitmentData: null,
        fitmentRows: [
          {
            year: '2019',
            make: 'Honda',
            model: 'Civic',
            trim: 'LX',
            validationStatus: 'valid',
          },
        ],
      },
      warnings: [],
    });
    overrideRepo.findOne = jest.fn().mockResolvedValue(null);

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    const props =
      result.publishRequest.compatibility?.compatibleProducts?.[0]
        ?.compatibilityProperties;
    expect(props).toEqual(
      expect.arrayContaining([
        { name: 'Make', value: 'Honda' },
        { name: 'Model', value: 'Civic' },
        { name: 'Year', value: '2019' },
        { name: 'Trim', value: 'LX' },
      ]),
    );
  });

  it('skips rejected fitmentRows when building compatibility', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'SKU-001',
        title: 'Brake Pad',
        description: '<p>Desc</p>',
        brand: 'TRW',
        price: 49.99,
        quantity: 5,
        categoryId: '6028',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      catalogProduct: {
        fitmentData: [],
        fitmentRows: [
          {
            year: '2019',
            make: 'Honda',
            model: 'Civic',
            validationStatus: 'rejected',
          },
        ],
      },
      warnings: [],
    });
    overrideRepo.findOne = jest.fn().mockResolvedValue(null);

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(result.publishRequest.compatibility).toBeUndefined();
  });

  it('omits needs_review fitment instead of sending invalid eBay compatibility', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'SKU-001',
        title: 'Brake Pad',
        description: '<p>Desc</p>',
        brand: 'Mercedes-Benz',
        price: 49.99,
        quantity: 5,
        categoryId: '6028',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      catalogProduct: {
        fitmentData: [
          { Make: 'Mercedes-Benz', Model: '170', Year: '2008' },
        ],
        fitmentRows: [
          {
            year: '2008',
            make: 'Mercedes-Benz',
            model: '170',
            validationStatus: 'needs_review',
          },
        ],
      },
      warnings: [],
    });
    overrideRepo.findOne = jest.fn().mockResolvedValue(null);

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_MOTORS_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(result.publishRequest.compatibility).toBeUndefined();
  });

  it('prefers valid fitmentRows over status-blind fitmentData', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'SKU-001',
        title: 'Brake Pad',
        description: '<p>Desc</p>',
        brand: 'Mercedes-Benz',
        price: 49.99,
        quantity: 5,
        categoryId: '6028',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      catalogProduct: {
        fitmentData: [
          { Make: 'Mercedes-Benz', Model: '170', Year: '2008' },
        ],
        fitmentRows: [
          {
            year: '2008',
            make: 'Mercedes-Benz',
            model: 'C-Class',
            validationStatus: 'valid',
          },
        ],
      },
      warnings: [],
    });
    overrideRepo.findOne = jest.fn().mockResolvedValue(null);

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_MOTORS_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    const props =
      result.publishRequest.compatibility?.compatibleProducts?.[0]
        ?.compatibilityProperties;
    expect(props).toEqual(
      expect.arrayContaining([
        { name: 'Make', value: 'Mercedes-Benz' },
        { name: 'Model', value: 'C-Class' },
        { name: 'Year', value: '2008' },
      ]),
    );
  });

  it('uses GTC listing duration', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'SKU-001',
        title: 'Brake Pad',
        description: '<p>Desc</p>',
        brand: 'TRW',
        price: 49.99,
        quantity: 5,
        categoryId: '6028',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      warnings: [],
    });
    overrideRepo.findOne = jest.fn().mockResolvedValue(null);

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(result.publishRequest.listingDuration).toBe('GTC');
  });

  it('builds listing aspects with fallback Unbranded when brand missing', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'SKU-001',
        title: 'Brake Pad',
        description: '<p>Desc</p>',
        brand: null,
        mpn: 'BP-123',
        price: 49.99,
        quantity: 5,
        categoryId: '6028',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      warnings: [],
    });
    overrideRepo.findOne = jest.fn().mockResolvedValue(null);

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_US',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(result.publishRequest.aspects.Brand).toEqual(['Unbranded']);
    expect(result.warnings).toContainEqual(
      expect.stringContaining('Unbranded'),
    );
  });

  it('uses currency from marketplace config', async () => {
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'SKU-001',
        title: 'Brake Pad',
        description: '<p>Desc</p>',
        brand: 'TRW',
        price: 49.99,
        quantity: 5,
        categoryId: '6028',
        imageUrls: ['https://img.example.com/1.jpg'],
      },
      warnings: [],
    });
    overrideRepo.findOne = jest.fn().mockResolvedValue(null);
    marketplaceConfig.require.mockReturnValue({
      currency: 'EUR',
      locale: 'de_DE',
      supportsMotorsFitment: false,
    });

    const result = await svc.build({
      catalogProductId: 'cp-1',
      ebayAccountId: 'acct-1',
      marketplaceId: 'EBAY_DE',
      listingRecordId: 'lr-1',
      storeId: 'store-1',
    });

    expect(result.publishRequest.currency).toBe('EUR');
  });
});
