import {
  buildEbayListingDescription,
  buildEbayListingTitle,
  stripListingHtmlBoilerplate,
  truncateEbayDescription,
  truncateEbayTitle,
  sanitizeEbayDescription,
  EBAY_OFFER_DESCRIPTION_MAX_LENGTH,
} from './ebay-listing-text.util.js';

describe('ebay-listing-text.util', () => {
  it('truncates long titles to 80 characters', () => {
    const long =
      '2008 Mercedes-Benz C350 W204 Front Left Headlight Assembly OEM Used Genuine Part';
    const result = truncateEbayTitle(long);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result.length).toBeGreaterThan(0);
  });

  it('builds fallback title from brand and MPN when title is empty', () => {
    const { title, warnings } = buildEbayListingTitle({
      brand: 'Mercedes-Benz',
      mpn: '2048208661',
    });
    expect(title).toBe('Mercedes-Benz 2048208661');
    expect(warnings.some((w) => w.includes('generated'))).toBe(true);
  });

  it('uses SKU when title and metadata are missing', () => {
    const { title } = buildEbayListingTitle({ sku: 'SKU-12345' });
    expect(title).toBe('SKU-12345');
  });

  it('generates fallback description when empty', () => {
    const { description, warnings } = buildEbayListingDescription({
      title: 'Mercedes Headlight',
      sku: 'BLA-00644',
    });
    expect(description.length).toBeGreaterThanOrEqual(1);
    expect(description.length).toBeLessThanOrEqual(
      EBAY_OFFER_DESCRIPTION_MAX_LENGTH,
    );
    expect(description).toContain('Mercedes Headlight');
    expect(warnings.some((w) => w.includes('empty'))).toBe(true);
  });

  it('strips style blocks and truncates long HTML descriptions', () => {
    const style = '<style>.x{color:red}</style>';
    const body = '<p>Part details</p>'.repeat(600);
    const raw = style + body;
    expect(raw.length).toBeGreaterThan(EBAY_OFFER_DESCRIPTION_MAX_LENGTH);

    const { description, warnings } = buildEbayListingDescription({
      description: raw,
      title: 'Test Part',
    });

    expect(stripListingHtmlBoilerplate(raw).startsWith('<p>')).toBe(true);
    expect(description.length).toBeLessThanOrEqual(
      EBAY_OFFER_DESCRIPTION_MAX_LENGTH,
    );
    expect(description.length).toBeGreaterThanOrEqual(1);
    expect(
      warnings.some((w) => w.includes('truncated') || w.includes('style')),
    ).toBe(true);
  });

  it('truncateEbayDescription respects max length', () => {
    const long = 'A'.repeat(5000);
    const result = truncateEbayDescription(long);
    expect(result.length).toBeLessThanOrEqual(
      EBAY_OFFER_DESCRIPTION_MAX_LENGTH,
    );
  });

  it('sanitizeEbayDescription delegates to builder', () => {
    const result = sanitizeEbayDescription('', {
      title: 'Brake Pad',
      sku: 'BP-1',
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result).toContain('Brake Pad');
  });
});
