import { applyListingGuards } from './listing-guards.js';

describe('applyListingGuards', () => {
  it('normalizes MPN from source part number', () => {
    const { item, fixes } = applyListingGuards(
      { mpn: '  A 123 456 ', title: 'Test Part' },
      { partNumber: 'A123456' },
    );
    expect(item.mpn).toBe('A123456');
    expect(fixes).toContain('MPN_NORMALIZED');
  });

  it('dedupes fitment rows by year/make/model', () => {
    const { item } = applyListingGuards(
      {
        title: 'Mercedes Part W204 OEM Used',
        compatibility: [
          { year: '2008', make: 'Mercedes-Benz', model: 'C350' },
          { year: '2008', make: 'Mercedes-Benz', model: 'C350' },
        ],
      },
      { partNumber: '123', donorMake: 'mercedes' } as { partNumber?: string },
    );
    expect(item.compatibility).toHaveLength(1);
  });
});
