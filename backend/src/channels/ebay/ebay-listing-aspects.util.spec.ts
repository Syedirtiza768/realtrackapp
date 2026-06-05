import {
  buildListingAspects,
  isUsedEbayCondition,
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

  it('detects used conditions', () => {
    expect(isUsedEbayCondition('USED_GOOD')).toBe(true);
    expect(isUsedEbayCondition('NEW')).toBe(false);
  });
});
