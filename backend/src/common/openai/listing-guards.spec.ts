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

  it('strips "New" from title when condition is Used', () => {
    const { item, fixes } = applyListingGuards(
      { title: 'BMW 328i New Style Grille OEM Used', mpn: '5111' },
      { partNumber: '5111', condition: 'Used' },
    );
    expect(item.title).not.toMatch(/\bNew\b/i);
    expect(fixes).toContain('TITLE_CONDITION_MISMATCH_STRIPPED');
  });

  it('strips "Used" from title when condition is New', () => {
    const { item, fixes } = applyListingGuards(
      { title: 'BMW 328i Grille OEM Used', mpn: '5111' },
      { partNumber: '5111', condition: 'New' },
    );
    expect(item.title).not.toMatch(/\bUsed\b/i);
    expect(fixes).toContain('TITLE_CONDITION_MISMATCH_STRIPPED');
  });

  it('does not strip condition words when condition is not provided', () => {
    const { item } = applyListingGuards(
      { title: 'BMW 328i New Style Grille', mpn: '5111' },
      { partNumber: '5111' },
    );
    expect(item.title).toBe('BMW 328i New Style Grille');
  });
});
