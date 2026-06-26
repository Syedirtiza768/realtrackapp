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

  it('fitmentDataToCompatibilityPayload builds Inventory API shape', () => {
    const payload = fitmentDataToCompatibilityPayload([
      { Make: 'Toyota', Model: 'Camry', Year: '2018', Trim: 'LE', MvlStatus: 'valid' },
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
});
