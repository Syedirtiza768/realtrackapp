import { BadRequestException } from '@nestjs/common';
import {
  SingleListingFormService,
  PART_LOOKUP_MIN_VISION_IMAGES,
  type CreateIntakePartDto,
} from './single-listing-form.service.js';

/**
 * Focused test for the photo-count gate at submission time
 * (createIntakePart). Photos are still required to CREATE a part because
 * eBay listings can't publish without them — but part identification no
 * longer depends on images (eBay Browse API by OEM/MPN is the primary
 * detector, vision is a fallback), so inadequate photo coverage no longer
 * permanently fails enrichment.
 *
 * The gate runs before any repository/AI dependency is touched, so the
 * service can be constructed with stub dependencies rather than a full
 * NestJS TestingModule.
 */
describe('SingleListingFormService.createIntakePart — photo gate', () => {
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

  function baseDto(imageUrls: string[]): CreateIntakePartDto {
    return {
      partNumber: 'ABC123',
      brand: 'Toyota',
      partType: 'OEM',
      conditionId: '3000',
      price: 25,
      imageUrls,
    };
  }

  it('rejects a submission with zero photos', async () => {
    const service = buildService();
    await expect(service.createIntakePart(baseDto([]))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a submission with only one photo', async () => {
    const service = buildService();
    await expect(
      service.createIntakePart(baseDto(['https://cdn.example.com/a.jpg'])),
    ).rejects.toThrow(
      new RegExp(`At least ${PART_LOOKUP_MIN_VISION_IMAGES} photos`),
    );
  });

  it('does not reject on the photo-count gate once the minimum is met', async () => {
    const service = buildService();
    await expect(
      service.createIntakePart(
        baseDto([
          'https://cdn.example.com/label.jpg',
          'https://cdn.example.com/overall.jpg',
        ]),
      ),
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
