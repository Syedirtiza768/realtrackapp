import type { VinDecodeService } from '../fitment/vin-decode.service.js';
import type { EbayMvlService } from '../fitment/ebay-mvl.service.js';
import type { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import { FitmentDiscoveryService } from './fitment-discovery.service.js';
import type { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';

/* ── Helpers ── */

function mockProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: 'prod-1',
    sku: 'SKU-001',
    title: '2018 Toyota Camry Brake Pad',
    mpn: 'BP-123',
    oemPartNumber: 'OEM-456',
    categoryId: '6028',
    fitmentData: null,
    donorVin: null,
    donorVinDecoded: null,
    imageUrls: [],
    ...overrides,
  } as CatalogProduct;
}

/* ── Tests ── */

describe('FitmentDiscoveryService', () => {
  let svc: FitmentDiscoveryService;
  let vinDecode: { decode: jest.Mock };
  let mvl: { validateParsedRows: jest.Mock };
  let taxonomy: { getCompatibilityProperties: jest.Mock };

  beforeEach(() => {
    vinDecode = { decode: jest.fn() };
    mvl = {
      validateParsedRows: jest.fn().mockResolvedValue([]),
    };
    taxonomy = {
      getCompatibilityProperties: jest.fn().mockResolvedValue([{ propertyName: 'Make' }]),
    };
    svc = new FitmentDiscoveryService(
      vinDecode as unknown as VinDecodeService,
      mvl as unknown as EbayMvlService,
      taxonomy as unknown as EbayTaxonomyApiService,
    );
  });

  it('returns fitment from catalog fitmentData when available', async () => {
    mvl.validateParsedRows.mockResolvedValue([
      { row: { make: 'Toyota', model: 'Camry', year: '2018' }, status: 'valid', serialized: { Make: 'Toyota', MvlStatus: 'valid' } },
    ]);

    const result = await svc.discover(mockProduct({
      fitmentData: [{ Make: 'Toyota', Model: 'Camry', Year: '2018' }],
    }));

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].make).toBe('Toyota');
  });

  it('parses year/make/model from title when no fitmentData', async () => {
    mvl.validateParsedRows.mockResolvedValue([
      { row: { make: 'Toyota', model: 'Camry', year: '2018' }, status: 'valid', serialized: {} },
    ]);

    const result = await svc.discover(mockProduct({
      title: '2018 Toyota Camry Brake Pad',
      fitmentData: null,
    }));

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0].make).toBe('Toyota');
    expect(result.rows[0].year).toBe('2018');
  });

  it('extracts donor VIN from product fields and decodes', async () => {
    vinDecode.decode.mockResolvedValue({
      year: 2019,
      make: 'Honda',
      model: 'Civic',
      trim: 'Sport',
      driveType: 'FWD',
      bodyClass: 'Sedan',
    });
    mvl.validateParsedRows.mockResolvedValue([
      { row: { make: 'Honda', model: 'Civic', year: '2019' }, status: 'valid', serialized: {} },
    ]);

    const result = await svc.discover(mockProduct({
      donorVin: '1HGBH41JXMN109186',
      fitmentData: null,
      title: 'Brake Pad', // no year/make in title
    }));

    expect(vinDecode.decode).toHaveBeenCalledWith('1HGBH41JXMN109186');
    const donorRow = result.rows.find((r) => r.source === 'donor_vin_nhtsa');
    expect(donorRow).toBeDefined();
  });

  it('marks donor-only fitment as needs_review', async () => {
    vinDecode.decode.mockResolvedValue({ year: 2019, make: 'Honda', model: 'Civic' });
    mvl.validateParsedRows.mockResolvedValue([
      { row: { make: 'Honda', model: 'Civic', year: '2019' }, status: 'valid', serialized: {} },
    ]);

    const result = await svc.discover(mockProduct({
      donorVin: '1HGBH41JXMN109186',
      fitmentData: null,
      title: 'Brake Pad',
    }));

    expect(result.status).toBe('needs_review');
    expect(result.manualReviewReasons.some((r) => r.includes('donor'))).toBe(true);
  });

  it('deduplicates identical rows', async () => {
    mvl.validateParsedRows.mockResolvedValue([
      { row: { make: 'Toyota', model: 'Camry', year: '2018' }, status: 'valid', serialized: {} },
      { row: { make: 'Toyota', model: 'Camry', year: '2018' }, status: 'valid', serialized: {} },
    ]);

    const result = await svc.discover(mockProduct({
      fitmentData: [
        { Make: 'Toyota', Model: 'Camry', Year: '2018' },
        { Make: 'Toyota', Model: 'Camry', Year: '2018' },
      ],
    }));

    expect(result.rows).toHaveLength(1);
  });

  it('returns needs_review when category does not support compatibility', async () => {
    taxonomy.getCompatibilityProperties.mockResolvedValue([]);

    const result = await svc.discover(mockProduct());
    expect(result.categorySupportsCompatibility).toBe(false);
    expect(result.manualReviewReasons).toContainEqual(expect.stringContaining('does not support'));
  });

  it('handles VIN decode failure gracefully', async () => {
    vinDecode.decode.mockRejectedValue(new Error('VIN not found'));

    const result = await svc.discover(mockProduct({
      donorVin: 'INVALIDVIN1234567',
      fitmentData: null,
      title: 'Brake Pad',
    }));

    expect(result.manualReviewReasons).toContainEqual(expect.stringContaining('could not be decoded'));
  });

  it('extracts year range from title', async () => {
    mvl.validateParsedRows.mockResolvedValue([]);

    const result = await svc.discover(mockProduct({
      title: '2015-2022 Toyota Camry Brake Pad',
      fitmentData: null,
    }));

    // Should have created rows for each year
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('returns empty rows when nothing found', async () => {
    const result = await svc.discover(mockProduct({
      title: 'Generic Automotive Part',
      fitmentData: null,
      donorVin: null,
    }));

    expect(result.rows).toHaveLength(0);
    expect(result.status).toBe('needs_review');
  });

  describe('toFitmentDataJson', () => {
    it('filters rejected rows', () => {
      const rows = [
        { year: '2018', make: 'Toyota', model: 'Camry', confidence: 0.9, source: 'catalog_fitment', validationStatus: 'valid' as const },
        { year: '2019', make: 'Honda', model: 'Civic', confidence: 0, source: 'catalog_fitment', validationStatus: 'rejected' as const, rejectedReason: 'invalid' },
      ];

      const json = svc.toFitmentDataJson(rows);
      expect(json).toHaveLength(1);
      expect(json[0].Make).toBe('Toyota');
    });
  });
});
