import {
  applyBusinessIndustrialFulfillmentDefaults,
  normalizeDetectedBusinessIndustrialAttributes,
  normalizeImageIntakePartName,
  parseInstanceFolderName,
  partFolderFromRelativePath,
  safeIntakePath,
  mapWithConcurrency,
} from './business-industrial-image-intake.util.js';

describe('B&I publish fulfillment defaults', () => {
  it('completes parcel fields and prefers evidence-backed measurements', () => {
    expect(
      applyBusinessIndustrialFulfillmentDefaults({
        dimensionsLength: 20,
        dimensionsUnit: 'cm',
        weight: 2,
        weightUnit: 'kg',
      }),
    ).toMatchObject({
      shippingMode: 'parcel',
      dispatchLocation: 'United States',
      shippingCoverage: 'United States',
      packedLength: 20,
      packedWidth: 10,
      packedHeight: 8,
      packedDimensionsUnit: 'cm',
      packedWeight: 2,
      packedWeightUnit: 'kg',
    });
  });

  it('does not overwrite explicit fulfillment values', () => {
    expect(
      applyBusinessIndustrialFulfillmentDefaults({
        shippingMode: 'parcel',
        dispatchLocation: 'Warehouse A',
        shippingCoverage: 'Domestic',
        packedLength: 1,
        packedWidth: 2,
        packedHeight: 3,
        packedDimensionsUnit: 'm',
        packedWeight: 4,
        packedWeightUnit: 'kg',
      }),
    ).toMatchObject({
      dispatchLocation: 'Warehouse A',
      shippingCoverage: 'Domestic',
      packedLength: 1,
      packedWidth: 2,
      packedHeight: 3,
      packedDimensionsUnit: 'm',
      packedWeight: 4,
      packedWeightUnit: 'kg',
    });
  });
});

describe('Business & Industrial image intake folder rules', () => {
  it('keeps bounded work concurrent and preserves source order', async () => {
    let active = 0;
    let peak = 0;
    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return value * 2;
    });
    expect(peak).toBeLessThanOrEqual(2);
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  it('treats a final numeric dot suffix as an instance marker', () => {
    expect(parseInstanceFolderName('BNI-20')).toEqual({
      rawFolderName: 'BNI-20',
      baseFolderName: 'BNI-20',
      instanceSuffix: null,
    });
    expect(parseInstanceFolderName('BNI-20.1')).toEqual({
      rawFolderName: 'BNI-20.1',
      baseFolderName: 'BNI-20',
      instanceSuffix: '1',
    });
    expect(parseInstanceFolderName(' Valve.2 ')).toEqual({
      rawFolderName: 'Valve.2',
      baseFolderName: 'Valve',
      instanceSuffix: '2',
    });
  });

  it('normalizes equivalent base names for grouping', () => {
    expect(normalizeImageIntakePartName('BNI-20')).toBe('bni20');
    expect(normalizeImageIntakePartName(' BNI 20 ')).toBe('bni20');
    expect(normalizeImageIntakePartName('BNI-20.1')).toBe('bni20.1');
  });

  it('finds the first part folder below the selected root', () => {
    expect(
      partFolderFromRelativePath('Parts/BNI-20.1/photo.jpg', 'Parts'),
    ).toBe('BNI-20.1');
    expect(partFolderFromRelativePath('BNI-20/photo.jpg', 'Parts')).toBe(
      'BNI-20',
    );
    expect(
      partFolderFromRelativePath('Parts/BNI-20/side/photo.jpg', 'Parts'),
    ).toBe('BNI-20');
  });

  it('rejects traversal and absolute paths', () => {
    expect(() => safeIntakePath('../photo.jpg')).toThrow('Invalid image path');
    expect(() => safeIntakePath('C:/photo.jpg')).toThrow('Invalid image path');
    expect(safeIntakePath('Parts/BNI-20/photo.jpg')).toBe(
      'Parts/BNI-20/photo.jpg',
    );
  });

  it('normalizes explicit numeric units without inventing scalar values', () => {
    expect(
      normalizeDetectedBusinessIndustrialAttributes({
        power: '350 W',
        frequency: '50-60 Hz',
        voltage: 24,
        voltageUnit: 'V',
      }),
    ).toEqual({
      power: 350,
      powerUnit: 'W',
      frequencyObserved: '50-60 Hz',
      voltage: 24,
      voltageUnit: 'V',
    });
  });
});
