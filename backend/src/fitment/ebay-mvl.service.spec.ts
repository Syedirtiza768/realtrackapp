import type { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import type { EbayMvlStoreService } from './ebay-mvl-store.service.js';
import { EbayMvlService } from './ebay-mvl.service.js';

/* ── Tests ── */

describe('EbayMvlService', () => {
  let svc: EbayMvlService;
  let taxonomyApi: {
    getCompatibilityProperties: jest.Mock;
    getCompatibilityPropertyValues: jest.Mock;
  };
  let store: {
    hasActiveRelease: jest.Mock;
    getPropertyValues: jest.Mock;
    resolveCanonicalMakeModel: jest.Mock;
    hasMake: jest.Mock;
    hasModel: jest.Mock;
    hasYear: jest.Mock;
  };

  beforeEach(() => {
    taxonomyApi = {
      getCompatibilityProperties: jest.fn().mockResolvedValue([
        { propertyName: 'Make', localizedPropertyName: 'Make' },
        { propertyName: 'Model', localizedPropertyName: 'Model' },
        { propertyName: 'Year', localizedPropertyName: 'Year' },
      ]),
      getCompatibilityPropertyValues: jest.fn(),
    };
    store = {
      hasActiveRelease: jest.fn().mockResolvedValue(false),
      getPropertyValues: jest.fn(),
      resolveCanonicalMakeModel: jest.fn(),
      hasMake: jest.fn(),
      hasModel: jest.fn(),
      hasYear: jest.fn(),
    };
    svc = new EbayMvlService(
      taxonomyApi as unknown as EbayTaxonomyApiService,
      store as unknown as EbayMvlStoreService,
    );
  });

  describe('fetchCompatibilityTree', () => {
    it('returns properties from taxonomy API', async () => {
      const result = await svc.fetchCompatibilityTree('6000');
      expect(result.categoryId).toBe('6000');
      expect(result.properties).toHaveLength(3);
      expect(result.properties[0].propertyName).toBe('Make');
    });
  });

  describe('getPropertyValues', () => {
    it('returns sorted values', async () => {
      taxonomyApi.getCompatibilityPropertyValues.mockResolvedValue([
        { value: 'Honda' },
        { value: 'BMW' },
        { value: 'Toyota' },
      ]);

      const { options } = await svc.getPropertyValues('6000', 'Make');
      expect(options).toHaveLength(3);
      expect(options[0].value).toBe('BMW'); // sorted alphabetically
      expect(options[1].value).toBe('Honda');
      expect(options[2].value).toBe('Toyota');
    });

    it('applies text filter', async () => {
      taxonomyApi.getCompatibilityPropertyValues.mockResolvedValue([
        { value: 'Toyota Camry' },
        { value: 'Toyota Corolla' },
        { value: 'Honda Civic' },
      ]);

      const { options } = await svc.getPropertyValues('6000', 'Model', { Make: 'Toyota' }, 'cam');
      expect(options).toHaveLength(1);
      expect(options[0].value).toBe('Toyota Camry');
    });

    it('sorts years descending', async () => {
      taxonomyApi.getCompatibilityPropertyValues.mockResolvedValue([
        { value: '2018' },
        { value: '2020' },
        { value: '2015' },
      ]);

      const { options } = await svc.getPropertyValues('6000', 'Year', { Make: 'Toyota', Model: 'Camry' });
      expect(options[0].value).toBe('2020');
      expect(options[1].value).toBe('2018');
      expect(options[2].value).toBe('2015');
    });

    it('paginates correctly', async () => {
      taxonomyApi.getCompatibilityPropertyValues.mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => ({ value: `Make${String(i).padStart(2, '0')}` })),
      );

      const { options, hasMore } = await svc.getPropertyValues('6000', 'Make', {}, undefined, 10, 0);
      expect(options).toHaveLength(10);
      expect(hasMore).toBe(true);
    });
  });

  describe('buildCompatibilityArray', () => {
    it('maps selections to eBay format', () => {
      const result = svc.buildCompatibilityArray([
        { make: 'Toyota', model: 'Camry', year: '2018' },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].compatibilityProperties).toEqual([
        { name: 'Make', value: 'Toyota' },
        { name: 'Model', value: 'Camry' },
        { name: 'Year', value: '2018' },
      ]);
    });

    it('includes trim and engine when present', () => {
      const result = svc.buildCompatibilityArray([
        { make: 'Toyota', model: 'Camry', year: '2018', trim: 'LE', engine: '2.5L' },
      ]);

      expect(result[0].compatibilityProperties).toHaveLength(5);
      expect(result[0].compatibilityProperties).toContainEqual({ name: 'Trim', value: 'LE' });
      expect(result[0].compatibilityProperties).toContainEqual({ name: 'Engine', value: '2.5L' });
    });

    it('includes notes when present', () => {
      const result = svc.buildCompatibilityArray([
        { make: 'Toyota', model: 'Camry', year: '2018', notes: 'Front brake pads' },
      ]);

      expect(result[0].notes).toBe('Front brake pads');
    });
  });

  describe('validateFitmentData', () => {
    it('accepts valid rows', async () => {
      taxonomyApi.getCompatibilityPropertyValues
        .mockResolvedValueOnce([{ value: 'Toyota' }]) // Makes
        .mockResolvedValueOnce([{ value: 'Camry' }]) // Models
        .mockResolvedValueOnce([{ value: '2018' }]); // Years

      const result = await svc.validateFitmentData(
        [{ Make: 'Toyota', Model: 'Camry', Year: '2018' }],
        '6000',
      );

      expect(result.validCount).toBe(1);
      expect(result.rejectedCount).toBe(0);
      expect(result.accepted).toHaveLength(1);
    });

    it('rejects invalid makes', async () => {
      taxonomyApi.getCompatibilityPropertyValues
        .mockResolvedValueOnce([{ value: 'Honda' }]) // Makes — no Toyota
        .mockResolvedValueOnce([]); // resolveCanonicalMakeModel also returns nothing

      const result = await svc.validateFitmentData(
        [{ Make: 'InvalidMake', Model: 'Camry', Year: '2018' }],
        '6000',
      );

      expect(result.rejectedCount).toBe(1);
      expect(result.accepted).toHaveLength(0);
    });

    it('marks unknown years as needs_review (not rejected)', async () => {
      taxonomyApi.getCompatibilityPropertyValues
        .mockResolvedValueOnce([{ value: 'Toyota' }]) // Makes
        .mockResolvedValueOnce([{ value: 'Camry' }]) // Models
        .mockResolvedValueOnce([{ value: '2020' }]); // Years — no 2018

      const result = await svc.validateFitmentData(
        [{ Make: 'Toyota', Model: 'Camry', Year: '2018' }],
        '6000',
      );

      expect(result.needsReviewCount).toBe(1);
      expect(result.rejectedCount).toBe(0);
    });

    it('handles empty/null input', async () => {
      const result = await svc.validateFitmentData(null, '6000');
      expect(result.accepted).toHaveLength(0);
      expect(result.validCount).toBe(0);
    });

    it('handles API unavailable gracefully', async () => {
      taxonomyApi.getCompatibilityPropertyValues.mockRejectedValue(new Error('API down'));

      const result = await svc.validateFitmentData(
        [{ Make: 'Toyota', Model: 'Camry', Year: '2018' }],
        '6000',
      );

      expect(result.apiUnavailable).toBe(true);
      expect(result.needsReviewCount).toBe(1);
    });

    it('validates against local MVL database when active', async () => {
      store.hasActiveRelease.mockResolvedValue(true);
      store.hasMake.mockResolvedValue(true);
      store.hasModel.mockResolvedValue(true);
      store.hasYear.mockResolvedValue(true);

      const result = await svc.validateFitmentData(
        [{ Make: 'Toyota', Model: 'Camry', Year: '2018' }],
        '6000',
      );

      expect(result.validCount).toBe(1);
      expect(result.apiUnavailable).toBe(false);
      expect(taxonomyApi.getCompatibilityPropertyValues).not.toHaveBeenCalled();
    });
  });
});
