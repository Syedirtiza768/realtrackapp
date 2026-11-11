import { EbayBrowseApiService } from './ebay-browse-api.service.js';
import type { EbayAuthService } from './ebay-auth.service.js';
import type { EbayItem, EbaySearchResult } from './ebay-api.types.js';

interface BrowseParserTestAccess {
  parseVehicleString(
    text: string,
  ): { year?: string; make?: string; model?: string } | null;
}

interface BrowseRetryTestAccess {
  withRateLimitRetry<T>(
    label: string,
    fn: () => Promise<T>,
    maxAttempts?: number,
  ): Promise<T>;
}

describe('EbayBrowseApiService exact MPN lookup', () => {
  let service: EbayBrowseApiService;

  beforeEach(() => {
    const auth = {
      getApiConfig: jest
        .fn()
        .mockReturnValue({ baseUrl: 'https://api.ebay.com' }),
    } as unknown as EbayAuthService;
    service = new EbayBrowseApiService(auth);
  });

  it('keeps repeated single make/model aspects paired with every compatible year', async () => {
    const summary = {
      itemId: 'v1|123|0',
      title: 'Toyota BP-123 Brake Pad',
      price: { value: '25.00', currency: 'USD' },
      condition: 'Used',
      conditionId: '3000',
      itemWebUrl: 'https://www.ebay.com/itm/123',
      seller: {
        username: 'seller-a',
        feedbackPercentage: '99.9',
        feedbackScore: 1000,
      },
    };
    const searchSpy = jest.spyOn(service, 'search').mockResolvedValue({
      total: 1,
      offset: 0,
      limit: 1,
      itemSummaries: [summary],
    } as EbaySearchResult);
    const getItemSpy = jest.spyOn(service, 'getItem').mockResolvedValue({
      ...summary,
      description: 'Used brake pad',
      localizedAspects: [
        { name: 'Brand', value: 'Toyota' },
        { name: 'Manufacturer Part Number', value: 'BP-123' },
        { name: 'Compatible Year', value: '2014' },
        { name: 'Compatible Year', value: '2015' },
        { name: 'Compatible Year', value: '2016' },
        { name: 'Compatible Make', value: 'Toyota' },
        { name: 'Compatible Model', value: 'Camry' },
      ],
    } as EbayItem);

    const result = await service.searchByMpn('Toyota', 'BP-123', {
      marketplaceId: 'EBAY_AU',
    });

    expect(searchSpy).toHaveBeenCalledWith({
      q: 'Toyota BP-123',
      limit: 10,
      categoryIds: undefined,
      marketplaceId: 'EBAY_AU',
    });
    expect(getItemSpy).toHaveBeenCalledWith('v1|123|0', 'EBAY_AU');
    expect(result.items[0]).toMatchObject({
      brand: 'Toyota',
      mpn: 'BP-123',
      fitmentHints: [
        { year: '2014', make: 'Toyota', model: 'Camry' },
        { year: '2015', make: 'Toyota', model: 'Camry' },
        { year: '2016', make: 'Toyota', model: 'Camry' },
      ],
    });
  });

  it('parses year ranges from a Compatible Vehicles aspect', () => {
    const parser = service as unknown as BrowseParserTestAccess;

    expect(parser.parseVehicleString('2014-2016 Toyota Camry')).toEqual({
      year: '2014-2016',
      make: 'Toyota',
      model: 'Camry',
    });
  });

  it('does not retry 429 when the caller selects fail-fast behavior', async () => {
    const retry = (
      service as unknown as BrowseRetryTestAccess
    ).withRateLimitRetry.bind(service);
    const request = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue({ response: { status: 429 } });

    await expect(retry('interactive MPN lookup', request, 1)).rejects.toEqual({
      response: { status: 429 },
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('passes fail-fast rate-limit behavior through interactive MPN lookup', async () => {
    const searchSpy = jest.spyOn(service, 'search').mockResolvedValue({
      total: 1,
      offset: 0,
      limit: 1,
      itemSummaries: [
        {
          itemId: 'v1|456|0',
          title: 'Toyota BP-123 Brake Pad',
        },
      ],
    } as EbaySearchResult);
    const getItemSpy = jest.spyOn(service, 'getItem').mockResolvedValue({
      itemId: 'v1|456|0',
      title: 'Toyota BP-123 Brake Pad',
      localizedAspects: [
        { name: 'Brand', value: 'Toyota' },
        { name: 'Manufacturer Part Number', value: 'BP-123' },
      ],
    } as EbayItem);

    await service.searchByMpn('Toyota', 'BP-123', {
      retryOnRateLimit: false,
    });

    expect(searchSpy).toHaveBeenCalledWith({
      q: 'Toyota BP-123',
      limit: 10,
      categoryIds: undefined,
      marketplaceId: undefined,
      retryOnRateLimit: false,
    });
    expect(getItemSpy).toHaveBeenCalledWith('v1|456|0', undefined, false);
  });
});
