/**
 * Donor-year scoping for MVL fitment — never dump an entire make/model history.
 * Aligned with scripts/lib/mvl-donor-scope.mjs
 */

export const MAX_FITMENT_YEAR_SPAN = 12;
export const MAX_UNSCOPED_MVL_ROWS = 80;

export interface MvlYearRow {
  year: number | string;
  [key: string]: unknown;
}

export function scopeMvlRowsByDonorYear<T extends MvlYearRow>(
  rows: T[],
  donorYear: number | string | null | undefined,
  opts?: {
    nearYears?: number;
    wideYears?: number;
    minScoped?: number;
  },
): { rows: T[]; scoped: boolean; reason: string } {
  const nearYears = opts?.nearYears ?? 5;
  const wideYears = opts?.wideYears ?? 8;
  const minScoped = opts?.minScoped ?? 3;
  const all = Array.isArray(rows) ? rows : [];

  if (all.length === 0) {
    return { rows: [], scoped: true, reason: 'empty' };
  }

  const yearNum = parseInt(String(donorYear ?? ''), 10);
  if (!Number.isFinite(yearNum) || yearNum < 1900 || yearNum > 2100) {
    return { rows: [], scoped: false, reason: 'missing_donor_year' };
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
    return {
      rows: wide,
      scoped: true,
      reason: `donor_pm_${wideYears}_fallback`,
    };
  }

  const exact = all.filter((r) => Number(r.year) === yearNum);
  return {
    rows: exact,
    scoped: exact.length > 0,
    reason: exact.length > 0 ? 'donor_exact' : 'no_rows_in_window',
  };
}

export function isOverExpandedFitment(
  rows: Array<Record<string, unknown>>,
  opts?: { maxSpan?: number; maxRows?: number },
): boolean {
  const maxSpan = opts?.maxSpan ?? MAX_FITMENT_YEAR_SPAN;
  if (!Array.isArray(rows) || rows.length === 0) return false;

  const years = rows
    .map((r) => parseInt(String(r.year ?? r.Year ?? ''), 10))
    .filter((y) => Number.isFinite(y) && y >= 1900 && y <= 2100);
  if (years.length === 0) return false;

  const minY = Math.min(...years);
  const maxY = Math.max(...years);
  // Year span is the only reliable signal — trim/engine cardinality can be
  // large even within a correct ±5 donor window (200+ rows is normal for MVL).
  return maxY - minY > maxSpan;
}

export function yearRangeFromRows(
  rows: Array<{ year?: number | string }>,
  fallbackYear?: number | string | null,
): string {
  const years = (rows || [])
    .map((r) => parseInt(String(r.year ?? ''), 10))
    .filter((y) => Number.isFinite(y) && y >= 1900);
  if (years.length === 0) {
    const fb = parseInt(String(fallbackYear ?? ''), 10);
    return Number.isFinite(fb) && fb >= 1900 ? String(fb) : '';
  }
  const minY = Math.min(...years);
  const maxY = Math.max(...years);
  return minY === maxY ? String(minY) : `${minY}-${maxY}`;
}

/** Prefer a single credible donor year from a list of candidate years. */
export function pickDonorYear(
  candidates: Array<number | string | null | undefined>,
): number | null {
  for (const c of candidates) {
    const y = parseInt(String(c ?? ''), 10);
    if (Number.isFinite(y) && y >= 1900 && y <= 2100) return y;
  }
  return null;
}
