import {
  fitmentDataToCompatibilityPayload,
  parseFitmentEntry,
} from './fitment-mvl.util.js';

describe('fitment-mvl.util', () => {
  it('parseFitmentEntry accepts Make/Model/Year keys', () => {
    expect(
      parseFitmentEntry({ Make: 'Toyota', Model: 'Camry', Year: '2018' }),
    ).toEqual({ year: '2018', make: 'Toyota', model: 'Camry' });
  });

  it('parseFitmentEntry accepts lowercase year/make/model keys', () => {
    expect(
      parseFitmentEntry({
        make: 'BMW',
        model: 'X5',
        year: '2015',
        trim: 'xDrive35i',
      }),
    ).toEqual({ year: '2015', make: 'BMW', model: 'X5', trim: 'xDrive35i' });
  });

  it('fitmentDataToCompatibilityPayload builds Inventory API shape', () => {
    const payload = fitmentDataToCompatibilityPayload([
      {
        Make: 'Toyota',
        Model: 'Camry',
        Year: '2018',
        Trim: 'LE',
        MvlStatus: 'valid',
      },
      { make: 'Honda', model: 'Civic', year: '2019', MvlStatus: 'rejected' },
    ]);

    expect(payload?.compatibleProducts).toHaveLength(1);
    expect(payload?.compatibleProducts[0].compatibilityProperties).toEqual(
      expect.arrayContaining([
        { name: 'Make', value: 'Toyota' },
        { name: 'Model', value: 'Camry' },
        { name: 'Year', value: '2018' },
        { name: 'Trim', value: 'LE' },
      ]),
    );
  });

  it('skips rows rejected by validationStatus', () => {
    const payload = fitmentDataToCompatibilityPayload([
      {
        make: 'Ford',
        model: 'F-150',
        year: '2020',
        validationStatus: 'rejected',
      },
      {
        make: 'Chevy',
        model: 'Silverado',
        year: '2021',
        validationStatus: 'valid',
      },
    ]);

    expect(payload?.compatibleProducts).toHaveLength(1);
    expect(payload?.compatibleProducts[0].compatibilityProperties).toEqual(
      expect.arrayContaining([
        { name: 'Make', value: 'Chevy' },
        { name: 'Model', value: 'Silverado' },
        { name: 'Year', value: '2021' },
      ]),
    );
  });

  it('expands yearStart/yearEnd ranges into per-year compatibility rows', () => {
    const payload = fitmentDataToCompatibilityPayload([
      {
        make: 'BMW',
        model: 'X5',
        yearStart: 2015,
        yearEnd: 2017,
        engine: '3.0L',
      },
    ]);

    expect(payload?.compatibleProducts).toHaveLength(3);
    expect(
      payload?.compatibleProducts.map(
        (p) =>
          p.compatibilityProperties.find((prop) => prop.name === 'Year')?.value,
      ),
    ).toEqual(['2015', '2016', '2017']);
    expect(payload?.compatibleProducts[0].compatibilityProperties).toEqual(
      expect.arrayContaining([{ name: 'Engine', value: '3.0L' }]),
    );
  });

  it('normalizes array notes to a string', () => {
    const payload = fitmentDataToCompatibilityPayload([
      { make: 'Audi', model: 'A4', year: '2018', notes: ['AWD only', 'sedan'] },
    ]);

    expect(payload?.compatibleProducts[0].notes).toBe('AWD only; sedan');
  });

  it('deduplicates identical structured compatibility rows', () => {
    const payload = fitmentDataToCompatibilityPayload([
      { make: 'Audi', model: 'A4', year: '2018', trim: 'Premium' },
      { Make: 'Audi', Model: 'A4', Year: '2018', Trim: 'Premium' },
    ]);

    expect(payload?.compatibleProducts).toHaveLength(1);
  });

  it('ignores invalid year ranges', () => {
    const payload = fitmentDataToCompatibilityPayload([
      { make: 'BMW', model: 'X5', yearStart: 1800, yearEnd: 2020 },
    ]);

    expect(payload).toBeUndefined();
  });
});
