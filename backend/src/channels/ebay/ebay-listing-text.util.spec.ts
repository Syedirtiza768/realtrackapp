import {
  buildEbayListingDescription,
  buildEbayListingTitle,
  buildStructuredEbayTitle,
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
    expect(title).toBe('Mercedes-Benz 2048208661 OEM Used');
    expect(warnings.some((w) => w.includes('composed'))).toBe(true);
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

describe('buildStructuredEbayTitle', () => {
  it('assembles the full house structure with the OEM Used suffix', () => {
    const title = buildStructuredEbayTitle({
      yearRange: '2012-2018',
      make: 'Audi',
      model: 'A6',
      generation: 'C7',
      position: 'Front Left',
      partName: 'Hood Hinge Cover Cap',
      oemPartNumber: '4G9827279',
    });
    expect(title).toBe(
      '2012-2018 Audi A6 C7 Front Left Hood Hinge Cover Cap 4G9827279 OEM Used',
    );
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith('OEM Used')).toBe(true);
  });

  it('omits empty segments and still ends with OEM Used', () => {
    expect(
      buildStructuredEbayTitle({
        yearRange: '2012-2018',
        make: 'Audi',
        partName: 'Rear Third Brake Light',
        oemPartNumber: '4G9945097',
      }),
    ).toBe('2012-2018 Audi Rear Third Brake Light 4G9945097 OEM Used');
  });

  it('returns empty string when no body segments are provided', () => {
    expect(buildStructuredEbayTitle({})).toBe('');
  });

  it('drops position first when over the limit, keeping the OEM Used suffix', () => {
    const title = buildStructuredEbayTitle({
      yearRange: '2012-2018',
      make: 'Audi',
      model: 'A6',
      generation: 'C7',
      position: 'Front Left',
      partName: 'Hood Hinge Cover Cap Trim Panel Molding',
      oemPartNumber: '4G9827279',
    });
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith('OEM Used')).toBe(true);
    expect(title).not.toContain('Front Left');
    expect(title).toContain('4G9827279');
    expect(title.startsWith('2012-2018 Audi')).toBe(true);
  });

  it('drops optional segments down to essentials when the body is very long', () => {
    const title = buildStructuredEbayTitle({
      yearRange: '2012-2018',
      make: 'Audi',
      model: 'A6',
      generation: 'C7',
      position: 'Front Left',
      partName: 'X'.repeat(70),
      oemPartNumber: '4G9827279',
    });
    expect(title).toBe('2012-2018 Audi 4G9827279 OEM Used');
    expect(title.length).toBeLessThanOrEqual(80);
  });

  it('drops the OEM Used suffix when even essentials barely fit without it', () => {
    // essentials core = "2012-2018 Audi " (15) + 60-char OEM = 75 chars; with
    // suffix that is 84 (>80), so the suffix is omitted.
    const title = buildStructuredEbayTitle({
      yearRange: '2012-2018',
      make: 'Audi',
      oemPartNumber: '4G9' + '8'.repeat(57),
    });
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title).not.toContain('OEM Used');
    expect(title.startsWith('2012-2018 Audi')).toBe(true);
  });

  it('truncates an oversized essentials core on a word boundary keeping the suffix', () => {
    const title = buildStructuredEbayTitle({
      yearRange: '2012-2018',
      make: 'Audi',
      oemPartNumber: '4G9' + '8'.repeat(97),
    });
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith('OEM Used')).toBe(true);
    expect(title.startsWith('2012-2018 Audi')).toBe(true);
  });

  it('caps a multi-value oemPartNumber to its first entry instead of starving out year/model/part name', () => {
    // Regression test: production incident where a part with 5 superseding
    // OEM numbers joined into one comma-separated field ("8K0837440J,
    // 8K0837440E, 8K0837440D, 8K0837440G, 8K0837440H") consumed nearly the
    // whole 80-char budget on its own. Because yearRange/make/oemPartNumber
    // are never dropped (see EBAY_TITLE_DROPPABLE_KEYS), this silently
    // published a title with no year, model, or part name at all — just
    // "AUDI 8K0837440J, 8K0837440E, ... OEM Used". Only the first OEM number
    // is needed for buyer search; the rest belong in item specifics.
    const title = buildStructuredEbayTitle({
      yearRange: '2010-2016',
      make: 'Audi',
      model: 'A4',
      partName: 'Window Channel',
      oemPartNumber:
        '8K0837440J, 8K0837440E, 8K0837440D, 8K0837440G, 8K0837440H',
    });
    expect(title).toBe('2010-2016 Audi A4 Window Channel 8K0837440J OEM Used');
    expect(title.length).toBeLessThanOrEqual(80);
  });
});

describe('buildEbayListingTitle structured composition', () => {
  it('preserves the reviewed stored title when structured fields are also present', () => {
    const { title, warnings } = buildEbayListingTitle({
      title: 'Some old free-text title 4G9827279',
      make: 'Audi',
      model: 'A6',
      position: 'Front Left',
      partName: 'Hood Hinge Cover Cap',
      oemPartNumber: '4G9827279',
    });
    expect(title).toBe('Some old free-text title 4G9827279');
    expect(warnings.some((w) => w.includes('recomposed'))).toBe(false);
  });

  it('composes without a warning when no title was present', () => {
    const { title, warnings } = buildEbayListingTitle({
      make: 'Audi',
      partName: 'Fog Light',
      oemPartNumber: '8T0941699E',
    });
    expect(title).toBe('Audi Fog Light 8T0941699E OEM Used');
    expect(warnings.some((w) => w.includes('empty'))).toBe(true);
    expect(warnings.some((w) => w.includes('recomposed'))).toBe(false);
  });

  it('leads with an explicit year range when provided', () => {
    const { title } = buildEbayListingTitle({
      yearRange: '2012-2018',
      make: 'Audi',
      model: 'A6',
      partName: 'Control Module',
      oemPartNumber: '4H0907163A',
    });
    expect(title).toBe('2012-2018 Audi A6 Control Module 4H0907163A OEM Used');
  });

  it('honors a title override verbatim and skips composition', () => {
    const { title, warnings } = buildEbayListingTitle({
      title: 'Stored title',
      titleOverride: 'Manual Override Title 4G9827279',
      make: 'Audi',
      partName: 'Hood Hinge Cover Cap',
      oemPartNumber: '4G9827279',
    });
    expect(title).toBe('Manual Override Title 4G9827279');
    expect(warnings.some((w) => w.includes('recomposed'))).toBe(false);
  });

  it('falls back to the stored title when no structured signal is present', () => {
    const { title } = buildEbayListingTitle({
      title: 'Pre-existing Hand-Written Title',
    });
    expect(title).toBe('Pre-existing Hand-Written Title');
  });
});
