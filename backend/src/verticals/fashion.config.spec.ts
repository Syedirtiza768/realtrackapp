import {
  applyFashionAnalysisMeta,
  buildFashionListingContent,
  compatibleFashionAttributes,
  fashionAspectsFromAttributes,
  mergeFashionSuggestions,
  normalizeFashionCategoryFamily,
  validateFashionAttributes,
} from './fashion.config.js';

describe('Fashion domain configuration', () => {
  it('defaults unknown families to clothing and maps footwear aliases', () => {
    expect(normalizeFashionCategoryFamily('Dress')).toBe('clothing');
    expect(normalizeFashionCategoryFamily('shoes')).toBe('footwear');
    expect(normalizeFashionCategoryFamily('bag')).toBe('accessories');
  });

  it('rejects automotive and industrial attributes without dropping Fashion fields', () => {
    const result = validateFashionAttributes({
      department: 'Women',
      size: 'M',
      fitment: '2018 Civic',
      vin: 'not applicable',
      voltage: '12V',
    });
    expect(result.attributes.department).toBe('Women');
    expect(result.attributes.size).toBe('M');
    expect(result.errors.some((error) => error.includes('fitment'))).toBe(true);
    expect(result.errors.some((error) => error.includes('voltage'))).toBe(true);
    expect(result.attributes.fitment).toBeUndefined();
    expect(result.attributes.voltage).toBeUndefined();
  });

  it('keeps label size separate from measured dimensions and requires a unit', () => {
    const missingUnit = validateFashionAttributes({
      categoryFamily: 'clothing',
      size: 'M',
      chestMeasurement: '42',
    });
    expect(missingUnit.warnings.some((warning) => warning.includes('measurementsUnit'))).toBe(true);
    expect(missingUnit.errors).toEqual([]);

    const valid = validateFashionAttributes({
      categoryFamily: 'clothing',
      size: 'M',
      chestMeasurement: '42',
      measurementsUnit: 'in',
      measurements: 'Chest 42 in laid flat',
    });
    expect(valid.errors).toEqual([]);
    expect(valid.attributes.size).toBe('M');
    expect(valid.attributes.chestMeasurement).toBe('42');
  });

  it('drops incompatible values when the category family changes', () => {
    const clothing = validateFashionAttributes({
      categoryFamily: 'clothing',
      sleeveLength: 'Long sleeve',
      shoeSize: '9',
    });
    expect(clothing.attributes.sleeveLength).toBe('Long sleeve');
    expect(clothing.attributes.shoeSize).toBeUndefined();

    const footwear = compatibleFashionAttributes('footwear', clothing.attributes);
    expect(footwear.sleeveLength).toBeUndefined();
    expect(footwear.categoryFamily).toBe('footwear');
  });

  it('does not overwrite confirmed values when merging suggestions', () => {
    const merged = mergeFashionSuggestions({
      current: { brand: 'User Brand', color: 'Navy' },
      suggested: { brand: 'Guessed Brand', color: 'Black', size: 'M' },
      confirmedKeys: ['brand'],
    });
    expect(merged.attributes.brand).toBe('User Brand');
    expect(merged.attributes.size).toBe('M');
    expect(merged.attributes.color).toBe('Navy');
    expect(merged.suggestedKeys).toEqual(['size']);
    expect(merged.conflicts).toEqual([
      { key: 'brand', current: 'User Brand', suggested: 'Guessed Brand' },
      { key: 'color', current: 'Navy', suggested: 'Black' },
    ]);
  });

  it('builds Fashion listing text from confirmed facts and reported defects', () => {
    const content = buildFashionListingContent({
      brand: 'Example',
      attributes: {
        itemType: 'Linen shirt',
        department: 'Women',
        color: 'White',
        size: 'M',
        stains: 'Faint mark on cuff',
        conditionDetails: 'Gently worn',
      },
    });
    expect(content.title.toLowerCase()).toContain('shirt');
    expect(content.description).toContain('Reported defects and wear');
    expect(content.description).toContain('Faint mark on cuff');
    expect(content.description).not.toMatch(/vin|vehicle|fitment|oem/i);
  });

  it('omits identification metadata and automotive keys from marketplace aspects', () => {
    const attributes = applyFashionAnalysisMeta(
      { color: 'Navy', fitment: 'should not publish' },
      {
        suggestedKeys: ['color'],
        conflicts: [],
        warnings: ['review the photo set'],
        multipleItems: false,
        analysisStatus: 'suggested',
      },
    );
    const aspects = fashionAspectsFromAttributes(attributes, 'Acme');
    expect(aspects.Color).toEqual(['Navy']);
    expect(aspects.Brand).toEqual(['Acme']);
    expect(aspects._suggestedKeys).toBeUndefined();
    expect(aspects.fitment).toBeUndefined();
  });

  it('preserves identification metadata keys through Fashion validation', () => {
    const result = validateFashionAttributes({
      color: 'Navy',
      _suggestedKeys: ['color'],
      _confirmedKeys: ['brand'],
      _analysisStatus: 'suggested',
    });
    expect(result.errors).toEqual([]);
    expect(result.attributes._suggestedKeys).toEqual(['color']);
    expect(result.attributes._confirmedKeys).toEqual(['brand']);
    expect(result.attributes._analysisStatus).toBe('suggested');
  });
});
