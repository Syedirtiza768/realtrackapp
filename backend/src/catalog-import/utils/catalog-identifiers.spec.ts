import { normalizeCatalogUpc } from './catalog-identifiers.js';

describe('normalizeCatalogUpc', () => {
  it('returns trimmed real UPC values unchanged', () => {
    expect(normalizeCatalogUpc('012345678905')).toBe('012345678905');
    expect(normalizeCatalogUpc('  012345678905 ')).toBe('012345678905');
  });

  it.each([
    'Does not apply',
    'does not apply',
    '  DOES NOT APPLY ',
    'N/A',
    'n/a',
    'NA',
    'none',
    '-',
    'null',
    '',
    '   ',
  ])('treats placeholder %j as no UPC', (value) => {
    expect(normalizeCatalogUpc(value)).toBeNull();
  });

  it('returns null for missing values', () => {
    expect(normalizeCatalogUpc(undefined)).toBeNull();
    expect(normalizeCatalogUpc(null)).toBeNull();
    expect(normalizeCatalogUpc(12345)).toBeNull();
  });
});
