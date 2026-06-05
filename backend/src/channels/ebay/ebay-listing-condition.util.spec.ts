import { mapToEbayConditionEnum } from './ebay-listing-condition.util.js';

describe('mapToEbayConditionEnum', () => {
  it('maps File Exchange style values', () => {
    expect(mapToEbayConditionEnum('3000-Used')).toBe('USED_EXCELLENT');
    expect(mapToEbayConditionEnum('1000-New')).toBe('NEW');
    expect(mapToEbayConditionEnum('7000')).toBe('FOR_PARTS_OR_NOT_WORKING');
  });

  it('passes through valid Inventory API enums', () => {
    expect(mapToEbayConditionEnum('USED_EXCELLENT')).toBe('USED_EXCELLENT');
    expect(mapToEbayConditionEnum('used good')).toBe('USED_GOOD');
  });

  it('maps human-readable labels', () => {
    expect(mapToEbayConditionEnum('Used')).toBe('USED_GOOD');
    expect(mapToEbayConditionEnum('New')).toBe('NEW');
    expect(mapToEbayConditionEnum('For parts or not working')).toBe(
      'FOR_PARTS_OR_NOT_WORKING',
    );
  });

  it('falls back for unknown values', () => {
    expect(mapToEbayConditionEnum(null)).toBe('USED_GOOD');
    expect(mapToEbayConditionEnum('bogus', 'NEW')).toBe('NEW');
  });
});
