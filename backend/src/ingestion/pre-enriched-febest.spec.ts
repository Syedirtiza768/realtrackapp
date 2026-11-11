import * as XLSX from 'xlsx';
import {
  parsePreEnrichedFebestWorkbook,
  PRE_ENRICHED_FEBEST_FITMENT_HEADERS,
  PRE_ENRICHED_FEBEST_MANIFEST_HEADERS,
  PRE_ENRICHED_FEBEST_PRODUCT_HEADERS,
  PRE_ENRICHED_FEBEST_SCHEMA_VERSION,
} from './pre-enriched-febest.js';

function workbookBuffer({ duplicateSku = false, missingPrice = false } = {}): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      PRE_ENRICHED_FEBEST_MANIFEST_HEADERS,
      ['SchemaVersion', PRE_ENRICHED_FEBEST_SCHEMA_VERSION],
      ['Marketplace', 'EBAY_MOTORS_US'],
      ['SourceHash', 'source-hash'],
      ['RunHash', 'run-hash'],
      ['QualityStatus', 'READY'],
    ]),
    'Manifest',
  );
  const product = (sku: string, mpn: string, price: number | null) => [
    sku,
    mpn,
    'FEBEST',
    `FEBEST 2007 Toyota Part ${mpn}`,
    'Official FEBEST replacement part. Verify the vehicle application and restrictions before purchase.',
    '<h2>Product overview</h2><p>Official FEBEST replacement part.</p>',
    price,
    price == null ? null : 'USD',
    0,
    '1000',
    '33559',
    'https://static.febest.de/images/x/example.jpg',
    JSON.stringify({ Brand: ['FEBEST'], 'Manufacturer Part Number': [mpn], Type: ['Bushing'] }),
    `source-${mpn}`,
    `evidence-${mpn}`,
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      PRE_ENRICHED_FEBEST_PRODUCT_HEADERS,
      product('A-001', 'A-001', missingPrice ? null : 12.34),
      product(duplicateSku ? 'A-001' : 'B-002', 'B-002', 14.56),
    ]),
    'Products',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      PRE_ENRICHED_FEBEST_FITMENT_HEADERS,
      ['A-001', 'EBAY_MOTORS_US', '2007', 'Toyota', 'Corolla', '', '', '', '', '', 'restriction note', 'app-a', 'https://febestparts.com/A-001', 'accepted'],
      ['B-002', 'EBAY_MOTORS_US', '2012', 'Honda', 'Civic', '', '', '', '', '', '', 'app-b', 'https://febestparts.com/B-002', 'accepted'],
    ]),
    'Fitments',
  );
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('pre_enriched_febest_v1 workbook validation', () => {
  it('preserves disjoint fitments, exact MPNs, and zero quantity', () => {
    const result = parsePreEnrichedFebestWorkbook(workbookBuffer());
    expect(result.ok).toBe(true);
    expect(result.readyForImport).toBe(true);
    expect(result.products.map((product) => product.partNumber)).toEqual(['A-001', 'B-002']);
    expect(result.products[0].quantity).toBe(0);
    expect(result.fitments.map((fitment) => fitment.model)).toEqual(['Corolla', 'Civic']);
  });

  it('rejects duplicate SKUs before enqueue or persistence', () => {
    const result = parsePreEnrichedFebestWorkbook(workbookBuffer({ duplicateSku: true }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.code === 'duplicate_sku')).toBe(true);
  });

  it('keeps missing public pricing as a visible blocker', () => {
    const result = parsePreEnrichedFebestWorkbook(workbookBuffer({ missingPrice: true }));
    expect(result.ok).toBe(true);
    expect(result.readyForImport).toBe(false);
    expect(result.warnings.some((issue) => issue.code === 'pricing_missing')).toBe(true);
  });
});
