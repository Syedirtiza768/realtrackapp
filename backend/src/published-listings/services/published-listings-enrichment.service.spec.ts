import { PublishedListingsEnrichmentService } from './published-listings-enrichment.service.js';

describe('PublishedListingsEnrichmentService', () => {
  const tradingApi = { getItemDetails: jest.fn() };
  const browseApi = { getItemByLegacyId: jest.fn() };
  const inventoryApi = { getCompatibility: jest.fn() };

  const service = new PublishedListingsEnrichmentService(
    tradingApi as never,
    browseApi as never,
    inventoryApi as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('needs enrichment when only one image and compatibility unchecked', () => {
    expect(
      service.needsEnrichment({
        storeId: 's',
        ebayItemId: '123',
        imageUrls: ['https://example.com/1.jpg'],
        compatibility: null,
      }),
    ).toBe(true);
  });

  it('does not need enrichment when images and compatibility are present', () => {
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
      }),
    ).toBe(false);
  });

  it('does not need compatibility re-fetch when checked empty', () => {
    expect(
      service.needsEnrichment({
        storeId: 's',
        ebayItemId: '123',
        imageUrls: ['a', 'b', 'c'],
        compatibility: { compatibleProducts: [] },
      }),
    ).toBe(false);
  });

  it('enriches via Trading GetItem then Browse fallback', async () => {
    tradingApi.getItemDetails.mockResolvedValue({
      imageUrls: ['https://i.ebayimg.com/1.jpg', 'https://i.ebayimg.com/2.jpg'],
      compatibility: null,
      description: null,
    });
    browseApi.getItemByLegacyId.mockResolvedValue({
      image: { imageUrl: 'https://i.ebayimg.com/1.jpg' },
      additionalImages: [{ imageUrl: 'https://i.ebayimg.com/3.jpg' }],
      compatibleProducts: [
        {
          compatibilityProperties: [
            { name: 'Year', value: '2018' },
            { name: 'Make', value: 'BMW' },
          ],
        },
      ],
    });

    const result = await service.enrichListing({
      storeId: 'store-1',
      ebayItemId: '287416311728',
      imageUrls: ['https://i.ebayimg.com/1.jpg'],
      compatibility: null,
    });

    expect(result.imageUrls.length).toBeGreaterThanOrEqual(2);
    expect(result.compatibility?.compatibleProducts).toHaveLength(1);
    expect(result.sources).toContain('trading_getitem');
    expect(result.sources).toContain('browse_api');
  });
});
