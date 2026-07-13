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

  it('falls back to catalog snapshot when no override', async () => {
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

    expect(result.publishRequest.title).toBe('TRW Brake Pad BP-123 OEM Used');
    expect(result.warnings).toContainEqual(
      expect.stringContaining('recomposed'),
    );
    expect(result.publishRequest.price).toBe(49.99);
  });

  it('prefers fitmentData make/year range over raw source columns when recomposing the title', async () => {
    // Regression test: production incident where a listing's raw source
    // column (listingRecord.cBrand) had a misspelled make ("Bently") and no
    // year was ever passed to the title composer, so the recomposed eBay
    // title read "Bently Continental Seat Module ... Used" — dropping the
    // year entirely and publishing a misspelled brand live on eBay.
    // catalog_products.fitmentData resolves make against the canonical
    // fitment_makes table (correct spelling) and carries the real
    // compatible year span, so it should win over the raw column.
    publishResolver.resolve.mockResolvedValue({
      snapshot: {
        catalogProductId: 'cp-1',
        listingRecordId: 'lr-1',
        sku: 'BNTLY-7130-Silver-D1-007',
        title: 'Bently Continental Seat Module 3D0959760C OEM Used',
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

    expect(result.publishRequest.title).toContain('Bentley');
    expect(result.publishRequest.title).not.toContain('Bently');
    expect(result.publishRequest.title).toContain('2003-2011');
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
