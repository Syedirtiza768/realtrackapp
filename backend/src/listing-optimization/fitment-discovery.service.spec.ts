import type { VinDecodeService } from '../fitment/vin-decode.service.js';
import type {
  EbayMvlService,
  MvlValidatedRow,
} from '../fitment/ebay-mvl.service.js';
import type { EbayBrowseApiService } from '../channels/ebay/ebay-browse-api.service.js';
import type { ParsedFitmentRow } from '../fitment/fitment-mvl.util.js';
import type { MvlFitmentExpanderService } from '../fitment/mvl-fitment-expander.service.js';
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

function validMvlResults(rows: ParsedFitmentRow[]): MvlValidatedRow[] {
  return rows.map((row) => ({
    row,
    status: 'valid',
    serialized: { Year: row.year, Make: row.make, Model: row.model },
  }));
}

/* ── Tests ── */

describe('FitmentDiscoveryService', () => {
  let svc: FitmentDiscoveryService;
  let vinDecode: { decode: jest.Mock };
  let mvl: { validateParsedRows: jest.Mock };
  let browseApi: { searchByMpn: jest.Mock };

  let mvlExpander: { expand: jest.Mock; getExpansionMode: jest.Mock };

  beforeEach(() => {
    vinDecode = { decode: jest.fn() };
    mvl = {
      validateParsedRows: jest.fn().mockResolvedValue([]),
    };
    mvlExpander = {
      getExpansionMode: jest.fn().mockReturnValue('hybrid'),
      expand: jest.fn().mockResolvedValue({
        expandedRows: [],
        manualReviewReasons: [],
        needsAiInterchange: false,
      }),
    };
    browseApi = {
      searchByMpn: jest.fn().mockResolvedValue({ found: false, items: [] }),
    };
    svc = new FitmentDiscoveryService(
      vinDecode as unknown as VinDecodeService,
      mvl as unknown as EbayMvlService,
      mvlExpander as unknown as MvlFitmentExpanderService,
      browseApi as unknown as EbayBrowseApiService,
    );
  });

  it('returns fitment from catalog fitmentData when available', async () => {
    mvl.validateParsedRows.mockResolvedValue([
      {
        row: { make: 'Toyota', model: 'Camry', year: '2018' },
        status: 'valid',
        serialized: { Make: 'Toyota', MvlStatus: 'valid' },
      },
    ]);

    const result = await svc.discover(
      mockProduct({
        fitmentData: [{ Make: 'Toyota', Model: 'Camry', Year: '2018' }],
      }),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].make).toBe('Toyota');
  });

  it('parses year/make/model from title when no fitmentData', async () => {
    mvl.validateParsedRows.mockResolvedValue([
      {
        row: { make: 'Toyota', model: 'Camry', year: '2018' },
        status: 'valid',
        serialized: {},
      },
    ]);

    const result = await svc.discover(
      mockProduct({
        title: '2018 Toyota Camry Brake Pad',
        fitmentData: null,
      }),
    );

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
      {
        row: { make: 'Honda', model: 'Civic', year: '2019' },
        status: 'valid',
        serialized: {},
      },
    ]);

    const result = await svc.discover(
      mockProduct({
        donorVin: '1HGBH41JXMN109186',
        fitmentData: null,
        title: 'Brake Pad', // no year/make in title
      }),
    );

    expect(vinDecode.decode).toHaveBeenCalledWith('1HGBH41JXMN109186');
    const donorRow = result.rows.find((r) => r.source === 'donor_vin_nhtsa');
    expect(donorRow).toBeDefined();
  });

  it('marks donor-only fitment as needs_review', async () => {
    vinDecode.decode.mockResolvedValue({
      year: 2019,
      make: 'Honda',
      model: 'Civic',
    });
    mvl.validateParsedRows.mockResolvedValue([
      {
        row: { make: 'Honda', model: 'Civic', year: '2019' },
        status: 'valid',
        serialized: {},
      },
    ]);

    const result = await svc.discover(
      mockProduct({
        donorVin: '1HGBH41JXMN109186',
        fitmentData: null,
        title: 'Brake Pad',
      }),
    );

    expect(result.status).toBe('needs_review');
    expect(result.manualReviewReasons.some((r) => r.includes('donor'))).toBe(
      true,
    );
  });

  it('deduplicates identical rows', async () => {
    mvl.validateParsedRows.mockResolvedValue([
      {
        row: { make: 'Toyota', model: 'Camry', year: '2018' },
        status: 'valid',
        serialized: {},
      },
      {
        row: { make: 'Toyota', model: 'Camry', year: '2018' },
        status: 'valid',
        serialized: {},
      },
    ]);

    const result = await svc.discover(
      mockProduct({
        fitmentData: [
          { Make: 'Toyota', Model: 'Camry', Year: '2018' },
          { Make: 'Toyota', Model: 'Camry', Year: '2018' },
        ],
      }),
    );

    expect(result.rows).toHaveLength(1);
  });

  it('treats eBay Motors categories as compatibility-capable', async () => {
    const result = await svc.discover(mockProduct());
    expect(result.categorySupportsCompatibility).toBe(true);
  });

  it('handles VIN decode failure gracefully', async () => {
    vinDecode.decode.mockRejectedValue(new Error('VIN not found'));

    const result = await svc.discover(
      mockProduct({
        donorVin: 'INVALIDVIN1234567',
        fitmentData: null,
        title: 'Brake Pad',
      }),
    );

    expect(result.manualReviewReasons).toContainEqual(
      expect.stringContaining('could not be decoded'),
    );
  });

  it('extracts year range from title', async () => {
    mvl.validateParsedRows.mockResolvedValue([]);

    const result = await svc.discover(
      mockProduct({
        title: '2015-2022 Toyota Camry Brake Pad',
        fitmentData: null,
      }),
    );

    // Should have created rows for each year
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('returns empty rows when nothing found', async () => {
    const result = await svc.discover(
      mockProduct({
        title: 'Generic Automotive Part',
        fitmentData: null,
        donorVin: null,
      }),
    );

    expect(result.rows).toHaveLength(0);
    expect(result.status).toBe('needs_review');
  });

  it('uses exact Brand+MPN eBay hints to create MVL-checked, review-only title fitment', async () => {
    browseApi.searchByMpn.mockResolvedValue({
      found: true,
      items: [
        {
          itemId: 'exact-item-1',
          brand: 'Toyota',
          mpn: 'BP-123',
          aspects: {},
          fitmentHints: [{ year: '2014-2016', make: 'Toyota', model: 'Camry' }],
        },
        {
          itemId: 'wrong-brand',
          brand: 'Bosch',
          mpn: 'BP-123',
          aspects: {},
          fitmentHints: [{ year: '2010-2012', make: 'Toyota', model: 'Camry' }],
        },
        {
          itemId: 'wrong-mpn',
          brand: 'Toyota',
          mpn: 'BP-123X',
          aspects: {},
          fitmentHints: [{ year: '2010-2012', make: 'Toyota', model: 'Camry' }],
        },
      ],
    });
    mvl.validateParsedRows.mockImplementation((parsed: ParsedFitmentRow[]) =>
      Promise.resolve(validMvlResults(parsed)),
    );

    const result = await svc.discover(
      mockProduct({
        brand: 'Toyota',
        mpn: 'BP-123',
        oemPartNumber: null,
        title: 'Brake Pad',
        fitmentData: null,
        fitmentRows: null,
      }),
      { marketplace: 'AU', categoryId: '6028' },
    );

    expect(browseApi.searchByMpn).toHaveBeenCalledWith('Toyota', 'BP-123', {
      categoryIds: '6028',
      marketplaceId: 'EBAY_AU',
    });
    expect(result.rows.map((row) => row.year)).toEqual([
      '2014',
      '2015',
      '2016',
    ]);
    expect(result.rows.every((row) => row.source === 'ebay_mpn_lookup')).toBe(
      true,
    );
    expect(
      result.rows.every(
        (row) =>
          row.validationStatus === 'needs_review' && row.mvlStatus === 'valid',
      ),
    ).toBe(true);
    expect(svc.toFitmentDataJson(result.rows)).toEqual([]);
    expect(result.manualReviewReasons).toContainEqual(
      expect.stringContaining('remain review-only'),
    );
    expect(mvlExpander.expand).not.toHaveBeenCalled();
  });

  it('uses the parsed vehicle make when catalog brand includes the model', async () => {
    const product = mockProduct({
      brand: 'Infinity Q50',
      donorYear: '2015',
      donorMake: 'Infiniti',
      donorModel: 'Q50',
      mpn: '682004GF0A',
      oemPartNumber: null,
      title: 'Instrument Panel',
      fitmentData: null,
      fitmentRows: null,
    });

    await svc.discover(product);

    expect(browseApi.searchByMpn).toHaveBeenCalledWith(
      'Infiniti',
      '682004GF0A',
      expect.any(Object),
    );
  });

  it('reuses persisted exact-MPN hints without repeating the Browse lookup', async () => {
    mvl.validateParsedRows.mockResolvedValue([
      {
        row: { make: 'Toyota', model: 'Camry', year: '2015' },
        status: 'valid',
        serialized: {},
      },
    ]);

    const result = await svc.discover(
      mockProduct({
        title: 'Brake Pad',
        fitmentData: null,
        fitmentRows: [
          {
            year: '2015',
            make: 'Toyota',
            model: 'Camry',
            source: 'ebay_mpn_lookup',
            confidence: 0.6,
            validationStatus: 'needs_review',
            mvlStatus: 'valid',
          },
        ],
      }),
    );

    expect(browseApi.searchByMpn).not.toHaveBeenCalled();
    expect(result.rows[0]).toMatchObject({
      source: 'ebay_mpn_lookup',
      validationStatus: 'needs_review',
      mvlStatus: 'valid',
    });
  });

  it('does not promote persisted MVL-checked review rows into publishable fitment', async () => {
    mvl.validateParsedRows.mockImplementation((parsed: ParsedFitmentRow[]) =>
      Promise.resolve(validMvlResults(parsed)),
    );
    const product = mockProduct({
      title: 'Brake Pad',
      fitmentData: null,
      fitmentRows: ['2015', '2016'].map((year) => ({
        year,
        make: 'Toyota',
        model: 'Camry',
        source: 'official_oem_catalog',
        confidence: 0.6,
        validationStatus: 'needs_review',
        mvlStatus: 'valid',
      })),
    });

    const result = await svc.discover(product);

    expect(browseApi.searchByMpn).not.toHaveBeenCalled();
    expect(
      result.rows.every((row) => row.validationStatus === 'needs_review'),
    ).toBe(true);
    expect(svc.toFitmentDataJson(result.rows)).toEqual([]);
  });

  describe('toFitmentDataJson', () => {
    it('filters rejected rows', () => {
      const rows = [
        {
          year: '2018',
          make: 'Toyota',
          model: 'Camry',
          confidence: 0.9,
          source: 'catalog_fitment',
          validationStatus: 'valid' as const,
        },
        {
          year: '2019',
          make: 'Honda',
          model: 'Civic',
          confidence: 0,
          source: 'catalog_fitment',
          validationStatus: 'rejected' as const,
          rejectedReason: 'invalid',
        },
      ];

      const json = svc.toFitmentDataJson(rows);
      expect(json).toHaveLength(1);
      expect(json[0].Make).toBe('Toyota');
      expect(json[0].MvlStatus).toBe('valid');
      expect(json[0].validationStatus).toBe('valid');
    });

    it('excludes needs_review rows from fitment_data', () => {
      const rows = [
        {
          year: '2008',
          make: 'Mercedes-Benz',
          model: '170',
          confidence: 0.5,
          source: 'title_parse',
          validationStatus: 'needs_review' as const,
        },
      ];
      expect(svc.toFitmentDataJson(rows)).toEqual([]);
    });
  });
});
