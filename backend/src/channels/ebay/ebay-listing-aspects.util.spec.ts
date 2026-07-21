import {
  buildListingAspects,
  EBAY_ASPECT_VALUE_MAX_LENGTH,
  isUsedEbayCondition,
  localizeAspectsForMarketplace,
  localizeAspectName,
  sanitizeListingAspects,
  truncateEbayAspectValue,
} from './ebay-listing-aspects.util.js';

describe('ebay-listing-aspects.util', () => {
  it('adds Brand and MPN when missing', () => {
    const aspects = buildListingAspects({
      brand: 'MERCEDES',
      mpn: 'E000251',
      partType: 'Glass',
    });
    expect(aspects.Brand).toEqual(['MERCEDES']);
    expect(aspects.MPN).toEqual(['E000251']);
    expect(aspects.Type).toEqual(['Glass']);
  });

  it('does not overwrite existing aspect values', () => {
    const aspects = buildListingAspects({
      brand: 'OTHER',
      existing: { Brand: ['OEM'] },
    });
    expect(aspects.Brand).toEqual(['OEM']);
  });

  it('truncates Type (and existing aspects) to eBay 65-char limit', () => {
    const longType =
      'Flat Contact Housing With Contact Locking Mechanism For Models With Seat Occupied Indicator';
    expect(longType.length).toBeGreaterThan(EBAY_ASPECT_VALUE_MAX_LENGTH);

    const fromPartType = buildListingAspects({ partType: longType });
    expect(fromPartType.Type![0].length).toBeLessThanOrEqual(
      EBAY_ASPECT_VALUE_MAX_LENGTH,
    );
    expect(fromPartType.Type![0]).toMatch(/Flat Contact Housing/);

    const fromExisting = buildListingAspects({
      existing: { Type: [longType] },
    });
    expect(fromExisting.Type![0].length).toBeLessThanOrEqual(
      EBAY_ASPECT_VALUE_MAX_LENGTH,
    );

    expect(
      truncateEbayAspectValue(longType).length,
    ).toBeLessThanOrEqual(EBAY_ASPECT_VALUE_MAX_LENGTH);
    expect(
      sanitizeListingAspects({ Type: [longType] }).Type![0].length,
    ).toBeLessThanOrEqual(EBAY_ASPECT_VALUE_MAX_LENGTH);
  });

  it('detects used conditions', () => {
    expect(isUsedEbayCondition('USED_GOOD')).toBe(true);
    expect(isUsedEbayCondition('NEW')).toBe(false);
  });

  it('localizes Brand to Hersteller for EBAY_DE', () => {
    expect(localizeAspectName('Brand', 'EBAY_DE')).toBe('Hersteller');
    expect(localizeAspectName('Brand', 'EBAY_US')).toBe('Brand');
    expect(
      localizeAspectsForMarketplace(
        { Brand: ['Toyota'], MPN: ['123'] },
        'EBAY_DE',
      ),
    ).toEqual({
      Hersteller: ['Toyota'],
      Herstellernummer: ['123'],
    });
  });
});
