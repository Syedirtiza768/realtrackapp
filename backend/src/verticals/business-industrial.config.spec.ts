import { validateBusinessIndustrialAttributes } from './business-industrial.config.js';

describe('validateBusinessIndustrialAttributes', () => {
  it('accepts explicit category and measurement units', () => {
    const result = validateBusinessIndustrialAttributes({
      categoryFamily: 'industrial_automation',
      voltage: 240,
      voltageUnit: 'V',
      shippingMode: 'parcel',
      dispatchLocation: 'Warehouse A',
      shippingCoverage: 'Domestic',
      packedLength: 20,
      packedWidth: 10,
      packedHeight: 8,
      packedDimensionsUnit: 'cm',
      packedWeight: 4,
      packedWeightUnit: 'kg',
    });
    expect(result.errors).toEqual([]);
  });

  it('rejects incomplete unit pairs and inconsistent lot counts', () => {
    const result = validateBusinessIndustrialAttributes({
      categoryFamily: 'machinery_tooling',
      voltage: 240,
      sellableLots: 2,
      unitsPerLot: 3,
      totalPhysicalUnits: 5,
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'voltage and voltageUnit must be supplied together with an explicit unit',
        'totalPhysicalUnits must equal sellableLots × unitsPerLot',
      ]),
    );
  });

  it('warns on restricted families without classifying by keywords', () => {
    const result = validateBusinessIndustrialAttributes({
      categoryFamily: 'medical_laboratory',
      compatibleEquipment: 'Analyzer model X',
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'This category is restricted; manual compliance and shipping review is required before publishing',
        'Compatibility claims require evidence; do not infer them from a model number or photograph',
      ]),
    );
  });
});
