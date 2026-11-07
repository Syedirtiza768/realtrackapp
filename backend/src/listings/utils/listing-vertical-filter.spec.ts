import { BadRequestException } from '@nestjs/common';
import { listingVerticalFilter } from './listing-vertical-filter.js';

describe('listingVerticalFilter', () => {
  it('returns null when no vertical is requested', () => {
    expect(listingVerticalFilter(undefined)).toBeNull();
    expect(listingVerticalFilter(null)).toBeNull();
    expect(listingVerticalFilter('')).toBeNull();
    expect(listingVerticalFilter('   ')).toBeNull();
  });

  it('matches legacy NULL-vertical rows for automotive', () => {
    const filter = listingVerticalFilter('automotive');
    expect(filter?.sql).toBe(
      '(r.vertical = :listingVertical OR r.vertical IS NULL)',
    );
    expect(filter?.params).toEqual({ listingVertical: 'automotive' });
  });

  it('matches only the named vertical for other verticals', () => {
    expect(listingVerticalFilter('fashion')).toEqual({
      sql: 'r.vertical = :listingVertical',
      params: { listingVertical: 'fashion' },
    });
    expect(listingVerticalFilter('business_industrial')?.params).toEqual({
      listingVertical: 'business_industrial',
    });
  });

  it('uses the alias it is given', () => {
    expect(listingVerticalFilter('fashion', 'listing')?.sql).toBe(
      'listing.vertical = :listingVertical',
    );
  });

  it('rejects unknown verticals', () => {
    expect(() => listingVerticalFilter('boats')).toThrow(BadRequestException);
  });
});
