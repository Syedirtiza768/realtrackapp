import {
  resolveVerifiedPhotoIdentity,
  visibleTextContainsPartNumber,
} from './part-photo-evidence.util.js';

describe('photo part-number evidence', () => {
  it('accepts formatted label numbers but rejects partial numeric matches', () => {
    expect(
      visibleTextContainsPartNumber(['VW AG 1K0 407 160 C'], '1K0407160C'),
    ).toBe(true);
    expect(visibleTextContainsPartNumber(['6411 9243951-01'], '924395')).toBe(
      false,
    );
    expect(visibleTextContainsPartNumber(['926247210'], '9262472')).toBe(false);
  });

  it('retains a verified requested number when the model selects another printed identifier', () => {
    const result = resolveVerifiedPhotoIdentity(
      {
        partName: 'BMW HVAC Heater Box 64119243951',
        partNumber: '64119243951',
        note: '64119243951 is the part number.',
      },
      ['Germany 11611611', 'BMW 6411 9243951-01'],
      '11611611',
    );
    expect(result?.partNumber).toBe('11611611');
    expect(result?.partName).toBe('BMW HVAC Heater Box');
    expect(result?.note).not.toContain('64119243951');
  });

  it('rejects a matching model MPN without actual matching OCR evidence', () => {
    expect(
      resolveVerifiedPhotoIdentity(
        { partNumber: 'ABC123', partName: 'Heater' },
        ['XYZ999'],
        'ABC123',
      ),
    ).toBeNull();
  });
});
