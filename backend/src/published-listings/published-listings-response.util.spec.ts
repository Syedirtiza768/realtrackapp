import {
  extractSalvageDetails,
  orderImageUrlsForConsumer,
  toPublishedListingApiResponse,
} from './published-listings-response.util.js';
import type { EbayPublishedListing } from './entities/ebay-published-listing.entity.js';

describe('published-listings-response.util', () => {
  it('orders ebay-hosted large images first', () => {
    const ordered = orderImageUrlsForConsumer([
      'https://cdn.example.com/a.jpg',
      'https://i.ebayimg.com/images/g/x/s-l140.jpg',
      'https://i.ebayimg.com/images/g/y/s-l140.jpg',
    ]);
    expect(ordered[0]).toContain('ebayimg.com');
    expect(ordered[0]).toContain('s-l1600');
    expect(ordered[ordered.length - 1]).toContain('cdn.example.com');
  });

  it('maps detail convenience fields from item specifics', () => {
    const listing = {
      id: '1',
      organizationId: 'org',
      storeId: 'store',
      ebayAccountId: 'acct',
      marketplaceId: 'EBAY_MOTORS_US',
      ebayItemId: '123',
      offerId: null,
      sku: 'SKU-1',
      title: 'Part',
      description: '<p>Hello <b>world</b></p>',
      categoryId: '33567',
      categoryName: null,
      price: '10.00',
      currency: 'USD',
      quantityAvailable: 1,
      quantitySold: 0,
      listingStatus: 'active',
      listingFormat: 'fixed_price',
      condition: 'Used',
      listingUrl: 'https://www.ebay.com/itm/123',
      imageUrls: ['https://i.ebayimg.com/images/g/x/s-l140.jpg'],
      itemSpecifics: {
        Brand: ['Toyota'],
        'Manufacturer Part Number': ['MPN-1'],
        'OE/OEM Number': ['OEM-1', 'OEM-2'],
        Mileage: '120000 miles',
        VIN: '1HGCM***',
      },
      shippingDetails: null,
      listingPolicies: null,
      compatibility: { compatibleProducts: [] },
      performanceMetrics: {},
      healthFlags: [],
      location: null,
      rawEbayResponse: null,
      accountDisplayName: 'Store',
      ebayStartTime: null,
      ebayEndTime: null,
      ebayLastModifiedAt: null,
      lastSyncedAt: new Date(),
      catalogProductId: null,
      ebayListingChannelId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as EbayPublishedListing;

    const mapped = toPublishedListingApiResponse(listing, {
      storeSlug: 'blackline',
    });
    expect(mapped.descriptionHtml).toContain('<p>Hello');
    expect(mapped.descriptionText).toBe('Hello world');
    expect(mapped.brand).toBe('Toyota');
    expect(mapped.mpn).toBe('MPN-1');
    expect(mapped.oeNumbers).toEqual(['OEM-1', 'OEM-2']);
    expect(mapped.storeSlug).toBe('blackline');
    expect(mapped.images[0].source).toBe('ebay');
    expect(mapped.salvageDetails?.mileage).toBe('120000');
    expect(mapped.salvageDetails?.vin).toBe('1HGCM***');
  });

  it('returns null salvageDetails when no provenance specifics exist', () => {
    expect(extractSalvageDetails({ Brand: ['x'] })).toBeNull();
  });
});
