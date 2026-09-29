import {
  buildPartsBazarPushItem,
  PARTSBAZAR_MAX_PAYLOAD_BYTES,
  type PartsBazarCatalogSource,
  type PartsBazarListingSource,
} from './partsbazar360-listing.mapper.js';

const context = { marketplaceId: 'EBAY_MOTORS_US', currency: 'USD' };

function listing(
  overrides: Partial<PartsBazarListingSource> = {},
): PartsBazarListingSource {
  return {
    id: 'listing-1',
    title: 'BMW X5 Front Bumper Cover',
    customLabelSku: 'SKU-1',
    categoryName: null,
    startPrice: '149.99',
    startPriceNum: null,
    quantity: '2',
    quantityNum: null,
    itemPhotoUrl: 'https://i.ebayimg.com/images/g/abc/s-l1600.jpg',
    conditionId: '3000',
    conditionLabel: null,
    description: 'Genuine OEM bumper cover.',
    cBrand: 'BMW',
    cType: 'Bumper Cover',
    cManufacturerPartNumber: '51117292',
    cOeOemPartNumber: '51117292, 51117293',
    cMaterial: null,
    cPlacement: 'Front',
    countryOfOrigin: null,
    manufacturerName: null,
    pUpc: null,
    status: 'published',
    ebayListingId: null,
    ...overrides,
  };
}

function catalog(
  overrides: Partial<PartsBazarCatalogSource> = {},
): PartsBazarCatalogSource {
  return {
    sku: 'SKU-1',
    title: 'Catalog title',
    description: null,
    optimizedTitle: null,
    optimizedDescription: null,
    brand: null,
    mpn: null,
    oemPartNumber: null,
    partType: null,
    placement: null,
    material: null,
    countryOfOrigin: null,
    price: null,
    quantity: null,
    conditionId: null,
    conditionLabel: null,
    categoryName: 'Bumpers & Reinforcements',
    imageUrls: [],
    fitmentData: null,
    fitmentRows: null,
    ebayItemId: null,
    ...overrides,
  };
}

function mapped(
  l = listing(),
  c: PartsBazarCatalogSource | null = null,
  o = {},
) {
  const result = buildPartsBazarPushItem(l, c, { ...context, ...o });
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result;
}

describe('buildPartsBazarPushItem', () => {
  it('maps a listing record to the published-listing shaped payload', () => {
    const { item, warnings } = mapped();

    expect(item.sourceListingId).toBe('listing-1');
    expect(item.listing).toMatchObject({
      title: 'BMW X5 Front Bumper Cover',
      sku: 'SKU-1',
      price: '149.99',
      currency: 'USD',
      quantityAvailable: 2,
      listingStatus: 'active',
      marketplaceId: 'EBAY_MOTORS_US',
      brand: 'BMW',
      mpn: '51117292',
      oeNumbers: ['51117292', '51117293'],
      imageUrls: ['https://i.ebayimg.com/images/g/abc/s-l1600.jpg'],
      ebayItemId: null,
      listingUrl: null,
      compatibility: null,
    });
    expect(item.listing.itemSpecifics).toMatchObject({
      Brand: 'BMW',
      MPN: '51117292',
      Type: 'Bumper Cover',
      'Placement on Vehicle': 'Front',
    });
    expect(warnings).toEqual([]);
  });

  it('sends several OE numbers as separate values, never one comma-joined string', () => {
    const { listing: payload } = mapped().item;
    expect(payload.oeNumbers).toEqual(['51117292', '51117293']);
    expect(payload.itemSpecifics['OE/OEM Part Number']).toEqual([
      '51117292',
      '51117293',
    ]);
  });

  it('sends a single OE number as a plain string', () => {
    const { listing: payload } = mapped(
      listing({ cOeOemPartNumber: '51117292' }),
    ).item;
    expect(payload.itemSpecifics['OE/OEM Part Number']).toBe('51117292');
  });

  it('does not leak the eBay "Does not apply" UPC placeholder into specifics', () => {
    expect(mapped().item.listing.itemSpecifics).not.toHaveProperty('UPC');
  });

  it('applies overrides for price, title and quantity', () => {
    const { item } = mapped(listing(), null, {
      overrides: { price: 99, title: 'Override Title', quantity: 7 },
    });
    expect(item.listing).toMatchObject({
      price: '99.00',
      title: 'Override Title',
      quantityAvailable: 7,
    });
  });

  it.each([
    ['1000', 'NEW', 'New'],
    ['3000', 'USED', 'Used Excellent'],
    ['7000', 'FOR_PARTS', 'For Parts Or Not Working'],
    ['2500', 'REFURBISHED', 'Seller Refurbished'],
  ])('maps condition %s to quality tier %s', (conditionId, tier, label) => {
    const { item } = mapped(listing({ conditionId }));
    expect(item.hints.qualityTier).toBe(tier);
    expect(item.listing.condition).toBe(label);
  });

  it('flags new parts as aftermarket unless an OE number backs them', () => {
    const noOe = mapped(
      listing({ conditionId: '1000', cOeOemPartNumber: null }),
    ).item.hints;
    expect(noOe).toMatchObject({
      qualityTier: 'NEW',
      partSource: 'AFTERMARKET',
      partType: 'AFTERMARKET',
    });

    const withOe = mapped(listing({ conditionId: '1000' })).item.hints;
    expect(withOe).toMatchObject({
      partSource: 'OEM',
      partType: 'UNCLASSIFIED',
    });
  });

  it('leaves partSource/partType unset for used parts so the receiver keeps its salvage defaults', () => {
    const { hints } = mapped(listing({ conditionId: '3000' })).item;
    expect(hints).toEqual({ qualityTier: 'USED' });
  });

  it('warns and assumes Used when no condition is recorded', () => {
    const { item, warnings } = mapped(listing({ conditionId: null }));
    expect(item.hints.qualityTier).toBe('USED');
    expect(warnings).toContain('Listing has no condition; published as Used');
  });

  it('falls back to the catalog product for missing listing fields', () => {
    const { item } = mapped(
      listing({
        title: null,
        description: null,
        cBrand: null,
        itemPhotoUrl: null,
        startPrice: null,
      }),
      catalog({
        optimizedTitle: 'Optimized Bumper Title',
        optimizedDescription: 'Optimized description',
        brand: 'Bosch',
        price: 80,
        imageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
      }),
    );
    expect(item.listing).toMatchObject({
      title: 'Optimized Bumper Title',
      description: 'Optimized description',
      brand: 'Bosch',
      price: '80.00',
      categoryName: 'Bumpers & Reinforcements',
      imageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    });
  });

  it('uses pre-resolved public photo URLs verbatim instead of the stored ones', () => {
    const { item } = mapped(
      listing(),
      catalog({ imageUrls: ['https://private.s3.amazonaws.com/a.jpg'] }),
      {
        imageUrls: ['https://rt.example.test/api/storage/serve/a.webp'],
      },
    );
    expect(item.listing.imageUrls).toEqual([
      'https://rt.example.test/api/storage/serve/a.webp',
    ]);
  });

  it('refuses when resolution left no photos, even though stored URLs exist', () => {
    const result = buildPartsBazarPushItem(
      listing(),
      catalog({ imageUrls: ['https://private.s3.amazonaws.com/a.jpg'] }),
      {
        ...context,
        imageUrls: [],
      },
    );
    expect(result.ok).toBe(false);
  });

  it('drops temp-path S3 images, which are cleaned up and would dead-link', () => {
    const { item } = mapped(
      listing({ itemPhotoUrl: null }),
      catalog({
        imageUrls: [
          'https://bucket.s3.amazonaws.com/temp/u1/a.jpg',
          'https://bucket.s3.amazonaws.com/durable/a.jpg',
        ],
      }),
    );
    expect(item.listing.imageUrls).toEqual([
      'https://bucket.s3.amazonaws.com/durable/a.jpg',
    ]);
  });

  it('links the eBay listing when the item is also live on eBay', () => {
    const { item } = mapped(listing({ ebayListingId: '123456789012' }));
    expect(item.listing.ebayItemId).toBe('123456789012');
    expect(item.listing.listingUrl).toBe(
      'https://www.ebay.com/itm/123456789012',
    );
  });

  it.each(['sold', 'delisted', 'archived'] as const)(
    'marks a %s listing as ended so the receiver takes it off sale',
    (status) => {
      expect(mapped(listing({ status })).item.listing.listingStatus).toBe(
        'ended',
      );
    },
  );

  describe('refuses listings the storefront could not sell', () => {
    it.each([
      ['no title', listing({ title: null }), 'no title'],
      ['no price', listing({ startPrice: null }), 'no price'],
      ['zero price', listing({ startPrice: '0' }), 'no price'],
      ['no image', listing({ itemPhotoUrl: null }), 'image'],
      [
        'only a temp image',
        listing({ itemPhotoUrl: 'https://b.s3.amazonaws.com/temp/x.jpg' }),
        'image',
      ],
    ])('%s', (_label, l, reason) => {
      const result = buildPartsBazarPushItem(l, null, context);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain(reason);
    });
  });

  describe('fitment', () => {
    const validRow = (year: number) => ({
      make: 'BMW',
      model: 'X5',
      year: String(year),
      MvlStatus: 'valid',
    });

    it('publishes only validated fitment rows as compatibleProducts', () => {
      const { item } = mapped(
        listing(),
        catalog({
          fitmentRows: [
            validRow(2016),
            {
              make: 'BMW',
              model: 'Z4',
              year: '2010',
              MvlStatus: 'needs_review',
            },
          ],
        }),
      );
      const rows = item.listing.compatibility?.compatibleProducts ?? [];
      expect(rows).toHaveLength(1);
      expect(rows[0].compatibilityProperties).toEqual(
        expect.arrayContaining([
          { name: 'Make', value: 'BMW' },
          { name: 'Model', value: 'X5' },
          { name: 'Year', value: '2016' },
        ]),
      );
    });

    it('sends null (not guessed) fitment when nothing is validated', () => {
      const { item } = mapped(
        listing(),
        catalog({
          fitmentRows: [
            {
              make: 'BMW',
              model: 'X5',
              year: '2016',
              MvlStatus: 'needs_review',
            },
          ],
        }),
      );
      expect(item.listing.compatibility).toBeNull();
    });
  });

  describe('payload size budget', () => {
    const many = Array.from({ length: 4000 }, (_, i) =>
      validRowFor(1980 + (i % 40), i),
    );

    function validRowFor(year: number, n: number) {
      return {
        make: 'BMW',
        model: `Model ${n}`,
        year: String(year),
        MvlStatus: 'valid',
      };
    }

    it('trims description and fitment rows to stay under the receiver body limit', () => {
      const { item, warnings } = mapped(
        listing({ description: 'x'.repeat(200_000) }),
        catalog({ fitmentRows: many }),
      );
      const bytes = Buffer.byteLength(JSON.stringify(item.listing), 'utf8');
      expect(bytes).toBeLessThanOrEqual(PARTSBAZAR_MAX_PAYLOAD_BYTES);
      expect(item.listing.description!.length).toBeLessThanOrEqual(8_000);
      expect(
        item.listing.compatibility!.compatibleProducts.length,
      ).toBeGreaterThan(0);
      expect(warnings.join(' ')).toMatch(/shortened|reduced/);
    });
  });
});
