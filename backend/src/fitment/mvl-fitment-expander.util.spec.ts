import {
  classifyPartExpansion,
  collapseYearRanges,
  evaluateNeedsAiInterchange,
  expandFitmentDeterministic,
  resolveFitmentExpansionMode,
} from './mvl-fitment-expander.util.js';

describe('mvl-fitment-expander.util', () => {
  const platformRanges = {
    'Mercedes-Benz|C-Class': [{ start: 2008, end: 2014, code: 'W204' }],
  };

  it('resolves expansion mode', () => {
    expect(resolveFitmentExpansionMode('hybrid')).toBe('hybrid');
    expect(resolveFitmentExpansionMode('invalid')).toBe('hybrid');
  });

  it('classifies part tiers', () => {
    expect(classifyPartExpansion('Headlight', 'Front Left')).toBe('body');
    expect(classifyPartExpansion('ECU Module', '')).toBe('electrical');
  });

  it('expands platform generation for donor year', () => {
    const result = expandFitmentDeterministic({
      donor: { year: '2008', make: 'Mercedes-Benz', model: 'C-Class' },
      partType: 'Headlight',
      placement: 'Front Left',
      profile: 'full',
      platformRanges,
      sharedPlatforms: {},
    });
    expect(result.expandedRows.length).toBeGreaterThanOrEqual(7);
    expect(result.generation?.code).toBe('W204');
  });

  it('skips fitment for compact profile', () => {
    const result = expandFitmentDeterministic({
      donor: { year: '2008', make: 'Mercedes', model: 'C350' },
      profile: 'compact',
      platformRanges,
    });
    expect(result.expandedRows).toHaveLength(0);
  });

  it('collapses per-year rows into ranges', () => {
    const ranges = collapseYearRanges([
      {
        year: '2008',
        make: 'Mercedes-Benz',
        model: 'C-Class',
        source: 'platform_generation',
      },
      {
        year: '2009',
        make: 'Mercedes-Benz',
        model: 'C-Class',
        source: 'platform_generation',
      },
      {
        year: '2010',
        make: 'Mercedes-Benz',
        model: 'C-Class',
        source: 'platform_generation',
      },
    ]);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].yearStart).toBe(2008);
    expect(ranges[0].yearEnd).toBe(2010);
  });

  it('evaluates AI interchange need', () => {
    expect(evaluateNeedsAiInterchange(2, 5, 'electrical', 'auto')).toBe(true);
    expect(evaluateNeedsAiInterchange(10, 5, 'body', 'auto')).toBe(false);
    expect(evaluateNeedsAiInterchange(2, 5, 'body', 'off')).toBe(false);
  });
});
