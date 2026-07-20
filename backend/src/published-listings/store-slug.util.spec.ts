import {
  normalizeStoreSlug,
  parseStoreSlugQuery,
  EBAY_STORE_SLUG_ALIASES,
} from './store-slug.util.js';

describe('store-slug.util', () => {
  it('normalizes eBay storefront URLs and aliases', () => {
    expect(normalizeStoreSlug('salvagea')).toBe('salvagea');
    expect(normalizeStoreSlug('https://www.ebay.com/str/salvagea')).toBe(
      'salvagea',
    );
    expect(
      normalizeStoreSlug('https://www.ebay.com/str/blacklineusedautoparts/'),
    ).toBe('blacklineusedautoparts');
  });

  it('parses comma-separated storeSlug query', () => {
    expect(parseStoreSlugQuery('salvagea,blackline')).toEqual([
      'salvagea',
      'blackline',
    ]);
    expect(parseStoreSlugQuery(' salvagea , blacklineusedautoparts ')).toEqual([
      'salvagea',
      'blacklineusedautoparts',
    ]);
  });

  it('maps known slugs to RealTrack store IDs', () => {
    expect(EBAY_STORE_SLUG_ALIASES.salvagea).toContain(
      '3b84b063-3811-481f-a61d-f7846a03558f',
    );
    expect(EBAY_STORE_SLUG_ALIASES.blackline).toContain(
      'd16199c4-55b5-429e-ad27-892bed94e00d',
    );
  });
});
