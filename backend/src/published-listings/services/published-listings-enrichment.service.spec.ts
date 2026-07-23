import { PublishedListingsEnrichmentService } from './published-listings-enrichment.service.js';

describe('PublishedListingsEnrichmentService', () => {
  const tradingApi = { getItemDetails: jest.fn() };
  const browseApi = { getItemByLegacyId: jest.fn() };
  const inventoryApi = { getCompatibility: jest.fn() };
  const pageScrape = {
    isEnabled: jest.fn(() => false),
    scrapeListingPage: jest.fn(),
  };

  const service = new PublishedListingsEnrichmentService(
    tradingApi as never,
    browseApi as never,
    inventoryApi as never,
    pageScrape as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    pageScrape.isEnabled.mockReturnValue(false);
  });

  it('needs enrichment when only one image and compatibility unchecked', () => {
    expect(
      service.needsEnrichment({
        storeId: 's',
        ebayItemId: '123',
        imageUrls: ['https://example.com/1.jpg'],
        compatibility: null,
        description: '<p>ok</p>',
        itemSpecifics: { Brand: ['x'] },
      }),
    ).toBe(true);
  });

  it('needs enrichment when description or item specifics are missing', () => {
    expect(
      service.needsEnrichment({
        storeId: 's',
        ebayItemId: '123',
        imageUrls: ['a', 'b', 'c'],
        compatibility: { compatibleProducts: [] },
        description: null,
        itemSpecifics: {},
      }),
    ).toBe(true);
  });

  it('does not need enrichment when images, compat, description, and specifics are present', () => {
    expect(
      service.needsEnrichment({
        storeId: 's',
        ebayItemId: '123',
        imageUrls: ['a', 'b'],
        compatibility: {
          compatibleProducts: [
            {
              compatibilityProperties: [
                { name: 'Year', value: '2015' },
                { name: 'Make', value: 'Jeep' },
              ],
            },
          ],
        },
        description: '<p>Full description</p>',
        itemSpecifics: { Brand: ['Jeep'] },
      }),
    ).toBe(false);
  });

  it('needs enrichment when listing URL is on a non-English eBay host', () => {
    expect(
      service.needsEnrichment({
        storeId: 's',
        ebayItemId: '123',
        listingUrl: 'https://www.ebay.de/itm/123',
        imageUrls: ['a', 'b'],
        compatibility: { compatibleProducts: [] },
        description: '<p>Vollständige Beschreibung</p>',
        itemSpecifics: { Marke: ['BMW'] },
      }),
    ).toBe(true);
  });

  it('replaces German locale with English title/url via Browse US', async () => {
    browseApi.getItemByLegacyId.mockResolvedValue({
      title: 'BMW Control Arm OEM Used',
      description: '<p>English description</p>',
      image: { imageUrl: 'https://i.ebayimg.com/images/g/1/s-l1600.jpg' },
      additionalImages: [
        { imageUrl: 'https://i.ebayimg.com/images/g/2/s-l1600.jpg' },
      ],
      localizedAspects: [{ name: 'Brand', value: 'BMW' }],
    });

    const result = await service.enrichListing({
      storeId: 'store-1',
      ebayItemId: '287416311728',
      listingUrl: 'https://www.ebay.de/itm/287416311728',
      title: 'BMW Querlenker Original gebraucht',
      imageUrls: [
        'https://i.ebayimg.com/images/g/1/s-l1600.jpg',
        'https://i.ebayimg.com/images/g/2/s-l1600.jpg',
      ],
      compatibility: { compatibleProducts: [] },
      description: '<p>Deutsche Beschreibung</p>',
      itemSpecifics: { Marke: ['BMW'] },
      skipTrading: true,
    });

    expect(tradingApi.getItemDetails).not.toHaveBeenCalled();
    expect(result.title).toBe('BMW Control Arm OEM Used');
    expect(result.listingUrl).toBe('https://www.ebay.com/itm/287416311728');
    expect(result.description).toBe('<p>English description</p>');
    expect(result.sources).toContain('browse_api');
  });

  it('enriches via Trading GetItem then Browse fallback', async () => {
    tradingApi.getItemDetails.mockResolvedValue({
      imageUrls: [
        'https://i.ebayimg.com/images/g/1/s-l140.jpg',
        'https://i.ebayimg.com/images/g/2/s-l140.jpg',
      ],
      compatibility: null,
      description: '<p>From GetItem</p>',
      itemSpecifics: {
        Brand: ['BMW'],
        'Manufacturer Part Number': ['MPN-1'],
      },
    });
    browseApi.getItemByLegacyId.mockResolvedValue({
      image: { imageUrl: 'https://i.ebayimg.com/images/g/1/s-l140.jpg' },
      additionalImages: [
        { imageUrl: 'https://i.ebayimg.com/images/g/3/s-l140.jpg' },
      ],
      compatibleProducts: [
        {
          compatibilityProperties: [
            { name: 'Year', value: '2018' },
            { name: 'Make', value: 'BMW' },
          ],
        },
      ],
      localizedAspects: [{ name: 'Type', value: 'Control Arm' }],
    });

    const result = await service.enrichListing({
      storeId: 'store-1',
      ebayItemId: '287416311728',
      imageUrls: ['https://i.ebayimg.com/images/g/1/s-l140.jpg'],
      compatibility: null,
      description: null,
      itemSpecifics: {},
    });

    expect(result.imageUrls.length).toBeGreaterThanOrEqual(2);
    expect(result.imageUrls[0]).toContain('s-l1600');
    expect(result.compatibility?.compatibleProducts).toHaveLength(1);
    expect(result.description).toBe('<p>From GetItem</p>');
    expect(result.itemSpecifics.Brand).toEqual(['BMW']);
    expect(result.sources).toContain('trading_getitem');
    expect(result.sources).toContain('browse_api');
  });

  it('falls back to listing page scrape when Trading skipped and Browse thin', async () => {
    pageScrape.isEnabled.mockReturnValue(true);
    browseApi.getItemByLegacyId.mockRejectedValue(new Error('browse down'));
    pageScrape.scrapeListingPage.mockResolvedValue({
      title: 'Scraped English Title',
      imageUrls: [
        'https://i.ebayimg.com/images/g/a/s-l1600.jpg',
        'https://i.ebayimg.com/images/g/b/s-l1600.jpg',
        'https://i.ebayimg.com/images/g/c/s-l1600.jpg',
      ],
      descriptionHtml: '<p>Scraped description</p>',
      descriptionText: 'Scraped description',
      itemSpecifics: { Brand: ['ScrapedBrand'] },
      compatibility: {
        compatibleProducts: [
          {
            compatibilityProperties: [
              { name: 'Year', value: '2017' },
              { name: 'Make', value: 'Ford' },
              { name: 'Model', value: 'Focus' },
            ],
          },
        ],
      },
      sources: ['html_ebayimg'],
    });

    const result = await service.enrichListing({
      storeId: 'store-1',
      ebayItemId: '111',
      listingUrl: 'https://www.ebay.com/itm/111',
      imageUrls: ['https://i.ebayimg.com/images/g/a/s-l140.jpg'],
      compatibility: null,
      description: null,
      itemSpecifics: {},
      skipTrading: true,
    });

    expect(tradingApi.getItemDetails).not.toHaveBeenCalled();
    expect(result.description).toContain('Scraped description');
    expect(result.itemSpecifics.Brand).toEqual(['ScrapedBrand']);
    expect(result.imageUrls.length).toBeGreaterThanOrEqual(3);
    expect(result.sources).toContain('listing_page_scrape');
  });
});
