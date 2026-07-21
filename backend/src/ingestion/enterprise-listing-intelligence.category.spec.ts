import { EnterpriseListingIntelligenceService } from './enterprise-listing-intelligence.service.js';
import type { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';

describe('EnterpriseListingIntelligenceService category guard', () => {
  const categoryMappingRepo = { findOne: jest.fn() };
  const taxonomy = {
    getCategorySuggestions: jest.fn(),
    getCategorySubtree: jest.fn(),
  };
  const service = new EnterpriseListingIntelligenceService(
    {} as never,
    {} as never,
    categoryMappingRepo as never,
    {} as never,
    {} as never,
    taxonomy as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    categoryMappingRepo.findOne.mockResolvedValue(null);
    taxonomy.getCategorySuggestions.mockResolvedValue([]);
    taxonomy.getCategorySubtree.mockRejectedValue(new Error('unavailable'));
  });

  it('keeps a known Motors leaf category', async () => {
    const result = await service.resolvePublishableCategory({
      sku: 'SKU-1',
      categoryId: '33710',
      categoryName: 'Headlight Assemblies',
    } as CatalogProduct);
    expect(result).toEqual({
      categoryId: '33710',
      categoryName: 'Headlight Assemblies',
      confidence: 0.95,
    });
  });

  it('overrides a valid but mismatched category with the best deterministic part keyword', async () => {
    const result = await service.resolvePublishableCategory({
      sku: 'SKU-1B',
      title: '2015 Bentley Center Console Armrest 4W0861368 OEM Used',
      partType: 'Center Console Armrest',
      placement: null,
      categoryId: '33696',
      categoryName: 'Door Panels',
    } as CatalogProduct);
    expect(result).toEqual({
      categoryId: '262189',
      categoryName: 'Center & Overhead Console Parts',
      confidence: 0.9,
    });
  });

  it('does not keep a specific category when the part identity is generic', async () => {
    const result = await service.resolvePublishableCategory({
      sku: 'SKU-1C',
      title: '2015 Lincoln MKS Not Specified 8G1Z8286B OEM Used',
      partType: 'Not Specified',
      categoryId: '33710',
      categoryName: 'Headlight Assemblies',
    } as CatalogProduct);
    expect(result).toEqual({
      categoryId: '9886',
      categoryName: 'Other Car & Truck Parts & Accessories',
      confidence: 0.4,
    });
  });

  it('uses deterministic radiator keywords instead of an unrelated valid category', async () => {
    const result = await service.resolvePublishableCategory({
      sku: 'SKU-1D',
      title: '2015 Lincoln MKS Radiator 7T4Z8125A OEM Used',
      partType: 'Radiator',
      categoryId: '33647',
      categoryName: 'Liftgates',
    } as CatalogProduct);
    expect(result).toEqual({
      categoryId: '33602',
      categoryName: 'Radiators',
      confidence: 0.85,
    });
  });

  it('replaces an unrelated category using deterministic part keywords', async () => {
    const result = await service.resolvePublishableCategory({
      sku: 'SKU-2',
      title: 'Audi headlight assembly',
      partType: 'Headlight',
      placement: 'Front',
      categoryId: '139971',
      categoryName: 'Video Game Consoles',
    } as CatalogProduct);
    expect(result.categoryId).toBe('33710');
    expect(result.confidence).toBe(0.85);
  });

  it('uses the safe leaf when taxonomy cannot resolve a category', async () => {
    const result = await service.resolvePublishableCategory({
      sku: 'SKU-3',
      title: 'Unknown automotive component',
      partType: null,
      placement: null,
      categoryId: '6000',
      categoryName: 'Car & Truck Parts & Accessories',
      brand: null,
    } as CatalogProduct);
    expect(result).toEqual({
      categoryId: '9886',
      categoryName: 'Other Car & Truck Parts & Accessories',
      confidence: 0.3,
    });
  });
});
