import type { Repository } from 'typeorm';
import type { EbayBrowseApiService } from '../channels/ebay/ebay-browse-api.service.js';
import type { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import { EbayCategory } from '../listings/entities/ebay-category.entity.js';
import { PartIdentificationService } from './part-identification.service.js';

function createCategoryRepo() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn((row: EbayCategory) => Promise.resolve(row)),
  } as unknown as Repository<EbayCategory>;
}

describe('PartIdentificationService', () => {
  let svc: PartIdentificationService;
  let browseApi: { searchByMpn: jest.Mock };
  let taxonomy: {
    getCategorySubtree: jest.Mock;
    getItemAspectsForCategory: jest.Mock;
  };
  let categoryRepo: ReturnType<typeof createCategoryRepo>;

  beforeEach(() => {
    browseApi = { searchByMpn: jest.fn() };
    taxonomy = {
      getCategorySubtree: jest.fn(),
      getItemAspectsForCategory: jest.fn(),
    };
    categoryRepo = createCategoryRepo();

    svc = new PartIdentificationService(
      browseApi as unknown as EbayBrowseApiService,
      taxonomy as unknown as EbayTaxonomyApiService,
      categoryRepo,
    );
  });

  describe('identifyAndCorroborate', () => {
    it('skips the Browse API call when brand or MPN is missing', async () => {
      const result = await svc.identifyAndCorroborate({ brand: null, mpn: null });
      expect(result).toEqual({
        checked: false,
        found: false,
        hallucinationWarnings: [],
      });
      expect(browseApi.searchByMpn).not.toHaveBeenCalled();
    });

    it('returns categoryId/categoryName from the best matching item when found', async () => {
      browseApi.searchByMpn.mockResolvedValue({
        found: true,
        items: [
          {
            itemId: '1',
            title: 'x',
            brand: 'Toyota',
            mpn: '12345-67890',
            epid: null,
            categoryId: '33559',
            categoryName: 'Fog Lights',
            aspects: {},
            fitmentHints: [{ year: '2015', make: 'Toyota', model: 'Camry' }],
          },
        ],
      });

      const result = await svc.identifyAndCorroborate({
        brand: 'Toyota',
        mpn: '12345-67890',
      });

      expect(result.checked).toBe(true);
      expect(result.found).toBe(true);
      expect(result.categoryId).toBe('33559');
      expect(result.categoryName).toBe('Fog Lights');
      expect(result.fitmentHints).toEqual([
        { year: '2015', make: 'Toyota', model: 'Camry' },
      ]);
    });

    it('returns found:false without throwing when Browse API finds nothing', async () => {
      browseApi.searchByMpn.mockResolvedValue({ found: false, items: [] });

      const result = await svc.identifyAndCorroborate({
        brand: 'Toyota',
        mpn: 'not-a-real-part',
      });

      expect(result.checked).toBe(true);
      expect(result.found).toBe(false);
    });

    it('flags a hallucination warning for a malformed OEM number but still attempts corroboration', async () => {
      browseApi.searchByMpn.mockResolvedValue({ found: false, items: [] });

      const result = await svc.identifyAndCorroborate({
        brand: 'toyota',
        mpn: 'NOT-A-VALID-TOYOTA-FORMAT',
      });

      expect(result.hallucinationWarnings.length).toBeGreaterThan(0);
      expect(browseApi.searchByMpn).toHaveBeenCalled();
    });

    it('degrades gracefully (checked:false) when the Browse API call throws', async () => {
      browseApi.searchByMpn.mockRejectedValue(new Error('rate limited'));

      const result = await svc.identifyAndCorroborate({
        brand: 'Toyota',
        mpn: '12345-67890',
      });

      expect(result.checked).toBe(false);
      expect(result.found).toBe(false);
    });
  });

  describe('ensureCategoryCached', () => {
    it('does nothing when categoryId is empty', async () => {
      await svc.ensureCategoryCached('');
      expect(categoryRepo.findOne).not.toHaveBeenCalled();
    });

    it('skips the write when a row already exists', async () => {
      (categoryRepo.findOne as jest.Mock).mockResolvedValue(
        new EbayCategory(),
      );
      await svc.ensureCategoryCached('33559');
      expect(categoryRepo.save).not.toHaveBeenCalled();
    });

    it('upserts a new row with required/recommended aspects split out', async () => {
      taxonomy.getCategorySubtree.mockResolvedValue({
        categoryId: '33559',
        categoryName: 'Fog Lights',
        categorySubtreeNode: {
          category: { categoryId: '33559', categoryName: 'Fog Lights' },
          categoryTreeNodeLevel: 3,
          leafCategoryTreeNode: true,
        },
      });
      taxonomy.getItemAspectsForCategory.mockResolvedValue([
        {
          localizedAspectName: 'Brand',
          aspectConstraint: {
            aspectDataType: 'STRING',
            aspectMode: 'FREE_TEXT',
            aspectRequired: true,
            aspectUsage: 'RECOMMENDED',
          },
        },
        {
          localizedAspectName: 'Color',
          aspectConstraint: {
            aspectDataType: 'STRING',
            aspectMode: 'FREE_TEXT',
            aspectRequired: false,
            aspectUsage: 'OPTIONAL',
          },
        },
      ]);

      await svc.ensureCategoryCached('33559');

      expect(categoryRepo.save).toHaveBeenCalledTimes(1);
      const saved = (categoryRepo.save as jest.Mock).mock.calls[0][0];
      expect(saved.ebayCategoryId).toBe('33559');
      expect(saved.isLeaf).toBe(true);
      expect(saved.requiredAspects).toHaveLength(1);
      expect(saved.recommendedAspects).toHaveLength(1);
    });

    it('does not throw when the taxonomy lookups fail', async () => {
      taxonomy.getCategorySubtree.mockRejectedValue(new Error('boom'));
      taxonomy.getItemAspectsForCategory.mockRejectedValue(new Error('boom'));

      await expect(svc.ensureCategoryCached('33559')).resolves.toBeUndefined();
    });
  });
});
