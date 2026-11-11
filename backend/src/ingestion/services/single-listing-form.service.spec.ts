import {
  SingleListingFormService,
  type CreateIntakePartDto,
} from './single-listing-form.service.js';
import { SKU_PREFIX } from '../constants/automotive-oem-brands.js';

describe('SingleListingFormService SKU allocation', () => {
  it('uses the BLAP namespace for newly allocated Add Part SKUs', () => {
    expect(SKU_PREFIX).toBe('BLAP');
  });
});

/** Photo-optional drafts save independently of optional image lookups. */
describe('SingleListingFormService.createIntakePart — photos optional', () => {
  function buildService(imageLookup: Promise<Array<{ cdnUrl: string }>>) {
    let savedListing: Record<string, unknown> | null = null;
    const listingRepo = {
      query: jest.fn().mockResolvedValue([{ nextval: '1' }]),
      create: jest.fn((value) => value),
      save: jest.fn(async (value: Record<string, unknown>) => {
        savedListing = { id: 'listing-1', ...value };
        return savedListing;
      }),
      findOne: jest.fn(async () => savedListing),
    };
    const catalogProductRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value: Record<string, unknown>) => ({
        id: 'catalog-1',
        ...value,
      })),
      findOne: jest.fn(),
    };
    const imageAssetRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue([]),
    };
    const storageService = {
      mirrorRemoteImageUrls: jest.fn(async (urls: string[]) => urls),
      isTempKey: jest.fn().mockReturnValue(false),
    };
    const imageDriveService = {
      findByPartNumber: jest.fn(() => imageLookup),
    };
    const queue = { add: jest.fn().mockResolvedValue(undefined) };

    const service = new SingleListingFormService(
      listingRepo as never,
      catalogProductRepo as never,
      imageAssetRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      storageService as never,
      imageDriveService as never,
      {} as never,
      {} as never,
      queue as never,
    );

    return { service, listingRepo, imageDriveService };
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

  it('saves a zero-photo draft without waiting for Image Drive', async () => {
    let finishLookup!: (images: Array<{ cdnUrl: string }>) => void;
    const imageLookup = new Promise<Array<{ cdnUrl: string }>>((resolve) => {
      finishLookup = resolve;
    });
    const { service, listingRepo, imageDriveService } =
      buildService(imageLookup);

    const result = await service.createIntakePart(baseDto([]));

    expect(result.listing.status).toBe('draft');
    expect(result.listing.itemPhotoUrl).toBeNull();
    expect(listingRepo.save).toHaveBeenCalledTimes(1);
    expect(imageDriveService.findByPartNumber).toHaveBeenCalledWith('ABC123');

    finishLookup([]);
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('saves a one-photo draft and skips the optional Image Drive search', async () => {
    const { service, listingRepo, imageDriveService } = buildService(
      Promise.resolve([]),
    );
    const photo = 'https://cdn.example.com/a.jpg';

    const result = await service.createIntakePart(baseDto([photo]));

    expect(result.listing.status).toBe('draft');
    expect(result.listing.itemPhotoUrl).toBe(photo);
    expect(listingRepo.save).toHaveBeenCalledTimes(1);
    expect(imageDriveService.findByPartNumber).not.toHaveBeenCalled();
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
      stub,
      (overrides.browseApi ?? stub) as never,
      stub,
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
            fitmentHints: [{ year: '2014', make: 'Maserati', model: 'Ghibli' }],
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
    expect(browseApi.searchByMpn).toHaveBeenCalledWith(
      'Maserati',
      '2055402328',
      { limit: 10, retryOnRateLimit: false },
    );
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
