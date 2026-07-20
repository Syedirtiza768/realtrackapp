import {
  SingleListingFormService,
  PART_LOOKUP_MIN_VISION_IMAGES,
  type CreateIntakePartDto,
} from './single-listing-form.service.js';

/**
 * createIntakePart no longer requires photos at submission time — parts
 * save to inventory as drafts and can be enriched from OEM/MPN via the
 * eBay Browse API. Photos remain optional at intake and can be added on
 * Inventory before publish.
 */
describe('SingleListingFormService.createIntakePart — photos optional', () => {
  function buildService(): SingleListingFormService {
    const stub = {} as never;
    return new SingleListingFormService(
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
    );
  }

  function baseDto(imageUrls: string[] = []): CreateIntakePartDto {
    return {
      partNumber: 'ABC123',
      brand: 'Toyota',
      partType: 'OEM',
      conditionId: '3000',
      price: 25,
      imageUrls,
    };
  }

  it('does not reject a submission with zero photos on the photo-count gate', async () => {
    const service = buildService();
    await expect(service.createIntakePart(baseDto([]))).rejects.not.toThrow(
      new RegExp(`At least ${PART_LOOKUP_MIN_VISION_IMAGES} photos`),
    );
  });

  it('does not reject a submission with only one photo on the photo-count gate', async () => {
    const service = buildService();
    await expect(
      service.createIntakePart(baseDto(['https://cdn.example.com/a.jpg'])),
    ).rejects.not.toThrow(
      new RegExp(`At least ${PART_LOOKUP_MIN_VISION_IMAGES} photos`),
    );
  });
});

/**
 * Browse-first part detection: lookupPart must identify a part from the
 * eBay Browse API by OEM/MPN without any photos and without any AI call.
 */
describe('SingleListingFormService.lookupPart — eBay Browse primary', () => {
  const stub = {} as never;

  function buildService(overrides: {
    browseApi?: unknown;
    mvl?: unknown;
    config?: unknown;
  }): SingleListingFormService {
    return new SingleListingFormService(
      stub,
      stub,
      stub,
      stub,
      (overrides.config ?? stub) as never,
      (overrides.mvl ?? stub) as never,
      stub,
      stub,
      stub,
      (overrides.browseApi ?? stub) as never,
    );
  }

  it('identifies a part via Browse API with zero photos and zero AI cost', async () => {
    const browseApi = {
      searchByMpn: jest.fn().mockResolvedValue({
        found: true,
        items: [
          {
            itemId: 'v1|123|0',
            title: '2014-2017 Maserati Ghibli Fuse Box 2055402328 OEM Used',
            brand: 'Maserati',
            mpn: '2055402328',
            epid: '999',
            categoryId: '33596',
            categoryName: 'Fuses & Fuse Boxes',
            aspects: { Type: ['Fuse Box'], Brand: ['Maserati'] },
            fitmentHints: [
              { year: '2014', make: 'Maserati', model: 'Ghibli' },
            ],
          },
        ],
      }),
    };
    const mvl = {
      resolveCanonicalMakeModel: jest.fn().mockResolvedValue({
        make: 'Maserati',
        model: 'Ghibli',
        mvlMatched: true,
      }),
    };

    const service = buildService({ browseApi, mvl });
    const result = await service.lookupPart({
      partNumber: '2055402328',
      brand: 'Maserati',
    });

    expect(result.source).toBe('ebay_browse');
    expect(result.partName).toBe('Fuse Box');
    expect(result.category).toBe('Fuses & Fuse Boxes');
    expect(result.estimatedCostUsd).toBe(0);
    expect(result.confidence).toBe('high');
    expect(result.mvlMatched).toBe(true);
    expect(browseApi.searchByMpn).toHaveBeenCalled();
  });

  it('falls through to AI paths when Browse finds nothing', async () => {
    const browseApi = {
      searchByMpn: jest.fn().mockResolvedValue({ found: false, items: [] }),
    };
    // No OPENAI_API_KEY configured → the AI fallback gate must throw,
    // proving Browse ran first and the flow reached the fallback.
    const config = { get: (_k: string, d?: string) => d ?? '' };

    const service = buildService({ browseApi, config });
    await expect(
      service.lookupPart({ partNumber: 'ZZZ-NOT-ON-EBAY' }),
    ).rejects.toThrow(/AI lookup is unavailable/);
    // Called twice: once with brand hint (none here → single call)
    expect(browseApi.searchByMpn).toHaveBeenCalledTimes(1);
  });
});
