import {
  isOverExpandedFitment,
  pickDonorYear,
  scopeMvlRowsByDonorYear,
  yearRangeFromRows,
  MAX_FITMENT_YEAR_SPAN,
} from './mvl-donor-scope.util.js';

describe('mvl-donor-scope.util', () => {
  const jettaAll = [];
  for (let y = 1980; y <= 2027; y++) {
    jettaAll.push({ year: y, make: 'Volkswagen', model: 'Jetta' });
  }

  it('never returns full make/model history when donor year is missing', () => {
    const result = scopeMvlRowsByDonorYear(jettaAll, null);
    expect(result.rows).toEqual([]);
    expect(result.reason).toBe('missing_donor_year');
    expect(result.scoped).toBe(false);
  });

  it('scopes to donor year ±5 when enough rows exist', () => {
    const result = scopeMvlRowsByDonorYear(jettaAll, 2012);
    expect(result.scoped).toBe(true);
    const years = result.rows.map((r) => Number(r.year));
    expect(Math.min(...years)).toBe(2007);
    expect(Math.max(...years)).toBe(2017);
    expect(result.rows.length).toBeLessThan(jettaAll.length);
  });

  it('does not fall back to the full history when the window is empty', () => {
    const sparse = [{ year: 1990, make: 'Volkswagen', model: 'Jetta' }];
    const result = scopeMvlRowsByDonorYear(sparse, 2015, {
      nearYears: 5,
      wideYears: 8,
      minScoped: 3,
    });
    expect(result.rows).toEqual([]);
    expect(result.reason).toBe('no_rows_in_window');
  });

  it('detects over-expanded fitment (1980-2027 dump)', () => {
    expect(isOverExpandedFitment(jettaAll)).toBe(true);
    expect(
      isOverExpandedFitment([
        { year: '2010', make: 'Volkswagen', model: 'Jetta' },
        { year: '2011', make: 'Volkswagen', model: 'Jetta' },
        { year: '2012', make: 'Volkswagen', model: 'Jetta' },
      ]),
    ).toBe(false);
    // Many trim/engine rows within a correct ±5 window are NOT over-expanded
    const dense = [];
    for (let y = 2007; y <= 2017; y++) {
      for (let t = 0; t < 20; t++) dense.push({ year: y, trim: `T${t}` });
    }
    expect(dense.length).toBeGreaterThan(80);
    expect(isOverExpandedFitment(dense)).toBe(false);
  });

  it('builds year range from scoped rows', () => {
    expect(
      yearRangeFromRows([
        { year: 2010 },
        { year: 2012 },
        { year: 2011 },
      ]),
    ).toBe('2010-2012');
    expect(yearRangeFromRows([], 2005)).toBe('2005');
    expect(yearRangeFromRows([])).toBe('');
  });

  it('picks first credible donor year', () => {
    expect(pickDonorYear([null, 'abc', 2011, 2018])).toBe(2011);
    expect(pickDonorYear([null, ''])).toBeNull();
  });

  it('MAX_FITMENT_YEAR_SPAN is finite and used by detector', () => {
    expect(MAX_FITMENT_YEAR_SPAN).toBe(12);
  });
});
