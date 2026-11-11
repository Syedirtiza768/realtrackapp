import { EnterpriseListingIntelligenceService } from './enterprise-listing-intelligence.service.js';
import { buildStructuredEbayTitle } from '../channels/ebay/ebay-listing-text.util.js';
import type { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import type { CompatibilityRow } from './enterprise-listing-intelligence.service.js';
import type { PipelineJob } from './entities/pipeline-job.entity.js';
import type { EbayCategoryMapping } from '../motors-intelligence/entities/ebay-category-mapping.entity.js';
import type { ListingGenerationPipeline } from '../common/openai/pipelines/listing-generation.pipeline.js';
import type { TitlePositionPartNamePipeline } from '../common/openai/pipelines/title-position-part-name.pipeline.js';
import type { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import type { Repository } from 'typeorm';

interface TitleInputForTest {
  yearRange: string;
  brand: string;
  model: string;
  placement?: string;
  partType?: string;
  oemPartNumber?: string;
  fitmentRows: unknown[];
  fitmentConfirmed: boolean;
}

interface TitleFitmentTestAccess {
  parseDonorVehicleFromFilename(
    filename: string | null | undefined,
    expectedBrand: string | null | undefined,
  ): { year: string; make: string; model: string } | null;
  normalizeCompatibility(
    rows: Record<string, unknown>[] | null,
  ): CompatibilityRow[];
  normalizeReviewTitleEvidence(
    rows: Record<string, unknown>[] | null,
  ): CompatibilityRow[];
  toEnglishListingInput(
    product: CatalogProduct,
    fitmentRows: CompatibilityRow[],
    reviewTitleRows: CompatibilityRow[],
  ): TitleInputForTest;
  buildComplianceWarnings(input: {
    title: string;
    expectedYearRange?: string;
    categoryId: string | null;
    requiredSpecifics: number;
    requiredSpecificsPresent: number;
    compatibilityValidRows: number;
    imageCount: number;
    imageQuality: number;
    hasPrice: boolean;
  }): Array<{ code: string; severity: string }>;
}

function stub<T>(): T {
  return {} as unknown as T;
}

describe('EnterpriseListingIntelligenceService title-only fitment evidence', () => {
  const service = new EnterpriseListingIntelligenceService(
    stub<Repository<PipelineJob>>(),
    stub<Repository<CatalogProduct>>(),
    stub<Repository<EbayCategoryMapping>>(),
    stub<ListingGenerationPipeline>(),
    stub<TitlePositionPartNamePipeline>(),
    stub<EbayTaxonomyApiService>(),
  );
  const titleFitmentAccess = service as unknown as TitleFitmentTestAccess;

  it('parses the donor VIN filename without using its year as part fitment', () => {
    const donor = service.parseDonorVehicleFromFilename(
      '2015 Infinity Q50 JN1CV7AP9FM830421.xlsx',
      'Infinity Q50',
    );

    expect(donor).toEqual({ year: '2015', make: 'Infiniti', model: 'Q50' });

    const input = titleFitmentAccess.toEnglishListingInput(
      {
        brand: 'Infinity Q50',
        title: 'Infinity Q50 Instrument Panel 682004GF0A',
        partType: 'Instrument Panel',
        mpn: '682004GF0A',
        oemPartNumber: '682004GF0A',
        donorYear: donor?.year,
        donorMake: donor?.make,
        donorModel: donor?.model,
        fitmentRows: [],
      } as unknown as CatalogProduct,
      [],
      [],
    );
    const title = buildStructuredEbayTitle({
      yearRange: input.yearRange,
      make: input.brand,
      model: input.model,
      partName: input.partType,
      oemPartNumber: input.oemPartNumber,
    });

    expect(input.yearRange).toBe('');
    expect(title).toMatch(/^Infiniti Q50 /);
    expect(title).not.toMatch(/^2015(?:\s|$)/);
  });

  it('blocks optimization when no evidence-backed title year is available', () => {
    const warnings = titleFitmentAccess.buildComplianceWarnings({
      title: 'Toyota Camry Brake Pad BP-123 OEM Used',
      categoryId: '123',
      requiredSpecifics: 0,
      requiredSpecificsPresent: 0,
      compatibilityValidRows: 0,
      imageCount: 1,
      imageQuality: 1,
      hasPrice: true,
    });

    expect(
      warnings.some(
        (warning) =>
          warning.code === 'TITLE_YEAR_RANGE_MISSING' &&
          warning.severity === 'error',
      ),
    ).toBe(true);
  });

  it('uses MVL-checked exact-MPN years in the title without treating them as compatibility', () => {
    const product = {
      brand: 'Toyota',
      title: 'Brake Pad BP-123',
      partType: 'Brake Pad',
      placement: 'Front',
      mpn: 'BP-123',
      oemPartNumber: 'BP-123',
      conditionId: '3000',
      donorYear: null,
      donorMake: null,
      donorModel: null,
      donorVinDecoded: null,
      fitmentConfidence: 0.6,
      donorYear: '2015',
      donorMake: 'Toyota',
      donorModel: 'Camry',
      fitmentRows: [
        ...['2014', '2015', '2016'].map((year) => ({
          year,
          make: 'Toyota',
          model: 'Camry',
          source: 'ebay_mpn_lookup',
          confidence: 0.6,
          validationStatus: 'needs_review',
          mvlStatus: 'valid',
        })),
        {
          year: '2017',
          make: 'Toyota',
          model: 'Camry',
          source: 'ebay_mpn_lookup',
          confidence: 0.3,
          validationStatus: 'needs_review',
          mvlStatus: 'needs_review',
        },
      ],
    } as unknown as CatalogProduct;

    const reviewTitleRows = titleFitmentAccess.normalizeReviewTitleEvidence(
      product.fitmentRows,
    );
    const input = titleFitmentAccess.toEnglishListingInput(
      product,
      [],
      reviewTitleRows,
    );
    const title = buildStructuredEbayTitle({
      yearRange: input.yearRange,
      make: input.brand,
      model: input.model,
      position: input.placement,
      partName: input.partType,
      oemPartNumber: input.oemPartNumber,
    });

    expect(title).toContain('2014-2016 Toyota Camry');
    expect(input.fitmentRows).toEqual([]);
    expect(input.fitmentConfirmed).toBe(false);
  });

  it('uses a single exact-MPN year as a title year without using donor-only years', () => {
    const product = {
      brand: 'Toyota',
      title: 'Brake Pad BP-123',
      partType: 'Brake Pad',
      mpn: 'BP-123',
      oemPartNumber: 'BP-123',
      donorYear: '2013',
      donorMake: 'Toyota',
      donorModel: 'Camry',
      fitmentRows: [
        {
          year: '2015',
          make: 'Toyota',
          model: 'Camry',
          source: 'oem_catalog_lookup',
          validationStatus: 'needs_review',
          mvlStatus: 'valid',
        },
      ],
    } as unknown as CatalogProduct;
    const reviewTitleRows = titleFitmentAccess.normalizeReviewTitleEvidence(
      product.fitmentRows,
    );
    const input = titleFitmentAccess.toEnglishListingInput(
      product,
      [],
      reviewTitleRows,
    );
    const title = buildStructuredEbayTitle({
      yearRange: input.yearRange,
      make: input.brand,
      model: input.model,
      partName: input.partType,
      oemPartNumber: input.oemPartNumber,
    });

    expect(input.yearRange).toBe('2015');
    expect(title).toMatch(/^2015 Toyota Camry /);
    expect(title).not.toContain('2013');
    expect(input.fitmentRows).toEqual([]);
    expect(input.fitmentConfirmed).toBe(false);
  });

  it('excludes platform-generation review rows from title-year evidence', () => {
    const rows = titleFitmentAccess.normalizeReviewTitleEvidence([
      {
        year: '2015',
        make: 'Toyota',
        model: 'Camry',
        source: 'mvl_platform_generation',
        validationStatus: 'needs_review',
        mvlStatus: 'valid',
      },
    ]);

    expect(rows).toEqual([]);
  });

  it('does not turn a year gap into a broader title range', () => {
    const product = {
      brand: 'Toyota',
      title: 'Brake Pad BP-123',
      partType: 'Brake Pad',
      mpn: 'BP-123',
      oemPartNumber: 'BP-123',
      donorYear: null,
      donorMake: null,
      donorModel: null,
      donorVinDecoded: null,
      fitmentRows: [
        ...['2014', '2016'].map((year) => ({
          year,
          make: 'Toyota',
          model: 'Camry',
          source: 'ebay_mpn_lookup',
          validationStatus: 'needs_review',
          mvlStatus: 'valid',
        })),
      ],
    } as unknown as CatalogProduct;
    const reviewTitleRows = titleFitmentAccess.normalizeReviewTitleEvidence(
      product.fitmentRows,
    );
    const input = titleFitmentAccess.toEnglishListingInput(
      product,
      [],
      reviewTitleRows,
    );

    expect(input.yearRange).toBe('');
  });

  it('does not treat conflicting review status as valid compatibility', () => {
    const rows = titleFitmentAccess.normalizeCompatibility([
      {
        Year: '2015',
        Make: 'Toyota',
        Model: 'Camry',
        validationStatus: 'valid',
        MvlStatus: 'needs_review',
      },
    ]);

    expect(rows[0]).toMatchObject({
      source: 'rejected',
      rejectedReason: 'Fitment row remains needs_review',
    });
  });
});
