import { CatalogProductService } from './catalog-product.service.js';
import type { CatalogProduct } from './entities/catalog-product.entity.js';
import type { ListingRecord } from '../listings/listing-record.entity.js';

describe('CatalogProductService.syncToListingRecord', () => {
  const sku = 'BLA-TITLE-FIX-001';

  function makeService(opts?: {
    product?: Partial<CatalogProduct>;
    listings?: Partial<ListingRecord>[];
  }) {
    const product = {
      id: 'cp-1',
      sku,
      title: 'STALE Catalog Title That Should Not Stomp',
      brand: 'Ford',
      partType: 'Mirror',
      countryOfOrigin: 'US',
      description: 'desc',
      price: 99,
      quantity: 1,
      imageUrls: ['https://cdn.example.com/a.jpg'],
      conditionId: '3000',
      conditionLabel: 'Used',
      categoryId: '33696',
      categoryName: 'Mirrors',
      format: 'FixedPrice',
      duration: 'GTC',
      location: 'Dubai',
      shippingProfile: 'Ship',
      returnProfile: 'Return',
      paymentProfile: 'Pay',
      features: null,
      mpn: 'MPN-1',
      oemPartNumber: 'OEM-1',
      material: null,
      placement: 'Left',
      ...opts?.product,
    } as CatalogProduct;

    const listings = (opts?.listings ?? [
      {
        id: 'lr-1',
        customLabelSku: sku,
        title: '2015-2019 Ford F-150 Left Mirror FL3Z17682AA OEM Used',
        version: 3,
      },
    ]) as ListingRecord[];

    const productRepo = {
      findOneBy: jest.fn(async () => product),
      save: jest.fn(async (p: CatalogProduct) => p),
    };
    const listingRepo = {
      findBy: jest.fn(async () => listings),
      update: jest.fn(async () => ({ affected: listings.length })),
      save: jest.fn(async (rows: ListingRecord[]) => rows),
    };
    const storageService = {
      mirrorRemoteImageUrls: jest.fn(async (urls: string[]) => urls),
    };

    const svc = new CatalogProductService(
      productRepo as never,
      listingRepo as never,
      storageService as never,
    );

    return { svc, productRepo, listingRepo, product, listings };
  }

  it('does not overwrite listing title when PATCH only changes brand', async () => {
    const { svc, listingRepo } = makeService();

    await svc.update('cp-1', { brand: 'Ford Motor' });

    expect(listingRepo.update).toHaveBeenCalledTimes(1);
    const [, patch] = listingRepo.update.mock.calls[0] as [
      { customLabelSku: string },
      Partial<ListingRecord>,
    ];
    expect(patch).toEqual({ cBrand: 'Ford Motor' });
    expect(patch).not.toHaveProperty('title');
    expect(listingRepo.save).not.toHaveBeenCalled();
  });

  it('does not overwrite listing title when PATCH only changes imageUrls', async () => {
    const { svc, listingRepo } = makeService();

    await svc.update('cp-1', {
      imageUrls: ['https://cdn.example.com/new.jpg'],
    });

    const [, patch] = listingRepo.update.mock.calls[0] as [
      { customLabelSku: string },
      Partial<ListingRecord>,
    ];
    expect(patch).toEqual({
      itemPhotoUrl: 'https://cdn.example.com/new.jpg',
    });
    expect(patch).not.toHaveProperty('title');
  });

  it('syncs title to listings only when title is included in the PATCH', async () => {
    const { svc, listingRepo } = makeService();
    const newTitle =
      '2015-2019 Ford F-150 Left Mirror FL3Z17682AA OEM Used';

    await svc.update('cp-1', { title: newTitle, brand: 'Ford' });

    const [, patch] = listingRepo.update.mock.calls[0] as [
      { customLabelSku: string },
      Partial<ListingRecord>,
    ];
    expect(patch.title).toBe(newTitle);
    expect(patch.cBrand).toBe('Ford');
  });
});
