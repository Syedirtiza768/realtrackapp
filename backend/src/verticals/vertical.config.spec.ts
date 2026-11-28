import {
  attributesFromImportRow,
  normalizeVerticalConfig,
  storeSupportsVertical,
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

  it('treats a store with no config as automotive-only', () => {
    expect(storeSupportsVertical(null, 'automotive')).toBe(true);
    expect(storeSupportsVertical(null, 'fashion')).toBe(false);
  });

  it('rejects an automotive upload to a fashion-only store', () => {
    const fashionOnly = { enabledVerticals: ['fashion'], defaultVertical: 'fashion' };
    expect(storeSupportsVertical(fashionOnly, 'fashion')).toBe(true);
    expect(storeSupportsVertical(fashionOnly, 'automotive')).toBe(false);
  });

  it('allows a store that enables several verticals', () => {
    const mixed = { enabledVerticals: ['automotive', 'fashion'], defaultVertical: 'automotive' };
    expect(storeSupportsVertical(mixed, 'automotive')).toBe(true);
    expect(storeSupportsVertical(mixed, 'fashion')).toBe(true);
    expect(storeSupportsVertical(mixed, 'business_industrial')).toBe(false);
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
