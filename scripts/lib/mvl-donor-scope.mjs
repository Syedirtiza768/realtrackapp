/** Max year span we'll accept for a single make/model MVL dump before treating it as over-expanded. */
export const MAX_FITMENT_YEAR_SPAN = 12;

/** Soft cap: even within a window, don't attach more than this many raw MVL rows without generation collapse. */
export const MAX_UNSCOPED_MVL_ROWS = 80;

/**
 * Scope MVL rows to a donor year window.
 * NEVER returns the full make/model history when donor year is missing —
 * that produced titles like "1980-2027 Volkswagen Jetta …" (entire MVL dump).
 *
 * @param {Array<{year: number|string}>} rows
 * @param {number|string|null|undefined} donorYear
 * @param {{ nearYears?: number, wideYears?: number, minScoped?: number }} [opts]
 * @returns {{ rows: typeof rows, scoped: boolean, reason: string }}
 */
export function scopeMvlRowsByDonorYear(rows, donorYear, opts = {}) {
  const nearYears = opts.nearYears ?? 5;
  const wideYears = opts.wideYears ?? 8;
  const minScoped = opts.minScoped ?? 3;
  const all = Array.isArray(rows) ? rows : [];

  if (all.length === 0) {
    return { rows: [], scoped: true, reason: 'empty' };
  }

  const yearNum = parseInt(String(donorYear ?? ''), 10);
  if (!Number.isFinite(yearNum) || yearNum < 1900 || yearNum > 2100) {
    return {
      rows: [],
      scoped: false,
      reason: 'missing_donor_year',
    };
  }

  const near = all.filter(
    (r) => Math.abs(Number(r.year) - yearNum) <= nearYears,
  );
  if (near.length >= minScoped) {
    return { rows: near, scoped: true, reason: `donor_pm_${nearYears}` };
  }

  const wide = all.filter(
    (r) => Math.abs(Number(r.year) - yearNum) <= wideYears,
  );
  if (wide.length > 0) {
    return { rows: wide, scoped: true, reason: `donor_pm_${wideYears}_fallback` };
  }

  // Last resort: donor year only (exact), never the full history.
  const exact = all.filter((r) => Number(r.year) === yearNum);
  return {
    rows: exact,
    scoped: exact.length > 0,
    reason: exact.length > 0 ? 'donor_exact' : 'no_rows_in_window',
  };
}

/**
 * Detect fitment that looks like an unscoped full-model MVL dump.
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ maxSpan?: number, maxRows?: number }} [opts]
 */
export function isOverExpandedFitment(rows, opts = {}) {
  const maxSpan = opts.maxSpan ?? MAX_FITMENT_YEAR_SPAN;
  if (!Array.isArray(rows) || rows.length === 0) return false;

  const years = rows
    .map((r) => parseInt(String(r.year ?? r.Year ?? ''), 10))
    .filter((y) => Number.isFinite(y) && y >= 1900 && y <= 2100);
  if (years.length === 0) return false;

  const minY = Math.min(...years);
  const maxY = Math.max(...years);
  // Year span only — trim/engine fan-out within a correct window is normal.
  return maxY - minY > maxSpan;
}

/**
 * Year range string for titles from scoped rows (or null if empty).
 * @param {Array<{year: number|string}>} rows
 * @param {number|string|null|undefined} fallbackYear
 */
export function yearRangeFromRows(rows, fallbackYear) {
  const years = (rows || [])
    .map((r) => parseInt(String(r.year), 10))
    .filter((y) => Number.isFinite(y) && y >= 1900);
  if (years.length === 0) {
    const fb = parseInt(String(fallbackYear ?? ''), 10);
    return Number.isFinite(fb) && fb >= 1900 ? String(fb) : '';
  }
  const minY = Math.min(...years);
  const maxY = Math.max(...years);
  return minY === maxY ? String(minY) : `${minY}-${maxY}`;
}
