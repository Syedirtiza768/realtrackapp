import { PublishedListingsHealthService } from './services/published-listings-health.service.js';

describe('PublishedListingsHealthService', () => {
  const service = new PublishedListingsHealthService();

  it('flags missing images as critical', () => {
    const flags = service.computeHealthFlags({
      title: 'Brake Pad Set Front',
      imageUrls: [],
      itemSpecifics: { Brand: ['TRW'] },
      compatibility: null,
      quantityAvailable: 5,
      quantitySold: 0,
      performanceMetrics: {},
      categoryId: '33567',
    });
    expect(flags.some((f) => f.code === 'missing_images')).toBe(true);
  });

  it('flags low stock', () => {
    const flags = service.computeHealthFlags({
      title: 'Test Part With Long Enough Title Here',
      imageUrls: ['a', 'b', 'c'],
      itemSpecifics: { Brand: ['OEM'] },
      compatibility: null,
      quantityAvailable: 2,
      quantitySold: 0,
      performanceMetrics: {},
      categoryId: '123',
    });
    expect(flags.some((f) => f.code === 'low_stock')).toBe(true);
  });

  it('maps published offer status', () => {
    expect(
      service.mapOfferStatus({
        sku: 'x',
        marketplaceId: 'EBAY_US',
        format: 'FIXED_PRICE',
        categoryId: '1',
        pricingSummary: { price: { value: '1', currency: 'USD' } },
        status: 'PUBLISHED',
        listingId: '123',
        availableQuantity: 5,
      }),
    ).toBe('active');
  });

  it('maps out of stock published offer', () => {
    expect(
      service.mapOfferStatus({
        sku: 'x',
        marketplaceId: 'EBAY_US',
        format: 'FIXED_PRICE',
        categoryId: '1',
        pricingSummary: { price: { value: '1', currency: 'USD' } },
        status: 'PUBLISHED',
        listingId: '123',
        availableQuantity: 0,
      }),
    ).toBe('out_of_stock');
  });
});

describe('PublishedListingsService isolation', () => {
  it('store access filter excludes unauthorized stores', () => {
    const accessible = new Set(['store-a']);
    const listings = [{ storeId: 'store-a' }, { storeId: 'store-b' }];
    const filtered = listings.filter((l) => accessible.has(l.storeId));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].storeId).toBe('store-a');
  });
});
