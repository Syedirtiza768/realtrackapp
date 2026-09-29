import {
  attributesFromImportRow,
  normalizeVerticalConfig,
  validateVerticalAttributes,
} from './vertical.config.js';

describe('vertical configuration', () => {
  it('keeps automotive as the safe default when no store config exists', () => {
    expect(normalizeVerticalConfig(null)).toEqual({
      enabledVerticals: ['automotive'],
      defaultVertical: 'automotive',
      workflows: {},
    });
  });

  it('does not allow a disabled default vertical', () => {
    const config = normalizeVerticalConfig({
      enabledVerticals: ['fashion'],
      defaultVertical: 'business_industrial',
      workflows: { fashion: { intake: 'pilot' } },
    });

    expect(config.enabledVerticals).toEqual(['fashion']);
    expect(config.defaultVertical).toBe('automotive');
    expect(config.workflows.fashion).toEqual({ intake: 'pilot' });
  });

  it('maps fashion intake fields without importing automotive fitment', () => {
    expect(
      attributesFromImportRow('fashion', {
        brand: 'Acme',
        size: 'M',
        color: 'Navy',
        fitment: '2018 Sedan',
      }),
    ).toEqual({ brand: 'Acme', size: 'M', color: 'Navy' });
  });

  it('rejects fitment and VIN attributes for pilot verticals', () => {
    const result = validateVerticalAttributes('business_industrial', {
      manufacturer: 'Acme',
      fitment: ['not applicable'],
      vin: 'not applicable',
    });

    expect(result.errors).toEqual([
      'business_industrial products cannot contain automotive fitment or VIN attributes',
    ]);
    expect(result.attributes.manufacturer).toBe('Acme');
  });

  it('keeps Fashion identification metadata keys instead of camel-casing them', () => {
    const result = validateVerticalAttributes('fashion', {
      color: 'Navy',
      _suggestedKeys: ['color'],
      _confirmedKeys: ['brand'],
    });
    expect(result.errors).toEqual([]);
    expect(result.attributes._suggestedKeys).toEqual(['color']);
    expect(result.attributes._confirmedKeys).toEqual(['brand']);
    expect(result.attributes.SuggestedKeys).toBeUndefined();
  });
});
