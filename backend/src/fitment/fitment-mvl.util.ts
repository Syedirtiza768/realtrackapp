import type { EbayCompatibilityPayload } from '../channels/ebay/ebay-api.types.js';

export interface ParsedFitmentRow {
  year: string;
  make: string;
  model: string;
  trim?: string;
  engine?: string;
  submodel?: string;
  notes?: string;
}

const MAX_YEAR_RANGE_SPAN = 100;
const MIN_VALID_YEAR = 1900;

/** Read a string value from the first present, non-empty key. */
function getString(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const rawValue = raw[key];
    if (rawValue == null) continue;
    if (
      typeof rawValue !== 'string' &&
      typeof rawValue !== 'number' &&
      typeof rawValue !== 'boolean'
    ) {
      continue;
    }
    const value = String(rawValue).trim();
    if (value) return value;
  }
  return '';
}

/** Determine whether a fitment row is marked rejected. */
function isRejectedFitmentRow(raw: Record<string, unknown>): boolean {
  const status = getString(raw, [
    'MvlStatus',
    'mvlStatus',
    'validationStatus',
    'ValidationStatus',
  ]).toLowerCase();
  return status === 'rejected';
}

/**
 * Resolve one or more years from a fitment row.
 * Supports single `Year`/`year`, and `yearStart`/`yearEnd` ranges.
 */
function resolveYears(raw: Record<string, unknown>): string[] {
  const single = getString(raw, ['Year', 'year']);
  if (single) {
    const yearNum = Number(single);
    if (Number.isFinite(yearNum) && yearNum >= MIN_VALID_YEAR) {
      return [String(yearNum)];
    }
  }

  const startRaw = raw['yearStart'] ?? raw['YearStart'];
  const endRaw = raw['yearEnd'] ?? raw['YearEnd'];
  if (startRaw == null || endRaw == null) return [];

  const start = Number(startRaw);
  const end = Number(endRaw);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < MIN_VALID_YEAR ||
    end < start ||
    end - start > MAX_YEAR_RANGE_SPAN
  ) {
    return [];
  }

  const years: string[] = [];
  for (let y = start; y <= end; y++) {
    years.push(String(y));
  }
  return years;
}

function normalizeNoteValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim() || undefined;
  }
  return undefined;
}

/** Normalize a notes field that may be a string or an array of strings. */
function normalizeNotes(raw: Record<string, unknown>): string | undefined {
  const value = raw['Notes'] ?? raw['notes'];
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    const joined = value
      .map((v) => normalizeNoteValue(v))
      .filter((v): v is string => Boolean(v))
      .join('; ');
    return joined || undefined;
  }
  return normalizeNoteValue(value);
}

/** Parse a fitment object from catalog JSON, pipeline export, or AI output. */
export function parseFitmentEntry(
  raw: Record<string, unknown>,
): ParsedFitmentRow | null {
  const make = getString(raw, ['Make', 'make']);
  const model = getString(raw, ['Model', 'model']);
  const year = getString(raw, ['Year', 'year']);
  if (!make || !model || !year) return null;

  const yearNum = Number(year);
  if (!Number.isFinite(yearNum) || yearNum < MIN_VALID_YEAR) return null;

  const trim = getString(raw, ['Trim', 'trim']) || undefined;
  const engine = getString(raw, ['Engine', 'engine']) || undefined;
  const submodel =
    getString(raw, ['Submodel', 'submodel', 'SubModel']) || undefined;
  const notes = normalizeNotes(raw);

  return { year, make, model, trim, engine, submodel, notes };
}

/** Lowercase and strip non-alphanumerics so "Mercedes-Benz" / "MERCEDES BENZ" /
 * "mercedes" compare equal, and "Land Rover" / "LandRover" compare equal. */
function normalizeMakeForComparison(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Minimal iterative Levenshtein distance (fine for short brand-name strings). */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

/**
 * True when `fitmentMake` looks like a typo, abbreviation, or formatting
 * variant of `rawBrand` (e.g. "Lincon"/"Lincoln", "MERCEDES"/"Mercedes-Benz",
 * "LandRover"/"Land Rover") rather than a genuinely different manufacturer.
 *
 * Fitment data commonly lists cross-brand platform-sharing applications (a
 * Nissan part's compatible-vehicle rows can legitimately include Infiniti; a
 * Lincoln part on a Ford platform can list Ford; Buick/Chevrolet, VW/Audi,
 * Mini/BMW, Toyota/Lexus behave the same way) — those are NOT the same
 * manufacturer as the part itself, so callers must not treat fitmentData's
 * make as authoritative in that case and should keep the original brand.
 * Only use fitmentMake as a *correction* when this returns true; otherwise
 * prefer it merely as a fallback when rawBrand is missing entirely.
 */
export function isSameMakeVariant(
  rawBrand: string,
  fitmentMake: string,
): boolean {
  const a = normalizeMakeForComparison(rawBrand);
  const b = normalizeMakeForComparison(fitmentMake);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const maxLen = Math.max(a.length, b.length);
  return levenshteinDistance(a, b) <= Math.min(3, Math.ceil(maxLen * 0.3));
}

/** Convert stored fitment rows to eBay Inventory API compatibility payload. */
export function fitmentDataToCompatibilityPayload(
  fitmentData: Record<string, unknown>[] | null | undefined,
  options?: { excludeRejected?: boolean },
): EbayCompatibilityPayload | undefined {
  if (!Array.isArray(fitmentData) || fitmentData.length === 0) return undefined;

  const compatibleProducts: EbayCompatibilityPayload['compatibleProducts'] = [];
  const seenRows = new Set<string>();

  for (const raw of fitmentData) {
    if (options?.excludeRejected !== false && isRejectedFitmentRow(raw)) {
      continue;
    }

    const make = getString(raw, ['Make', 'make']);
    const model = getString(raw, ['Model', 'model']);
    const years = resolveYears(raw);
    if (!make || !model || years.length === 0) continue;

    const trim = getString(raw, ['Trim', 'trim']) || undefined;
    const engine = getString(raw, ['Engine', 'engine']) || undefined;
    const submodel =
      getString(raw, ['Submodel', 'submodel', 'SubModel']) || undefined;
    const notes = normalizeNotes(raw);

    for (const year of years) {
      const properties: Array<{ name: string; value: string }> = [
        { name: 'Make', value: make },
        { name: 'Model', value: model },
        { name: 'Year', value: year },
      ];
      if (trim) properties.push({ name: 'Trim', value: trim });
      if (engine) properties.push({ name: 'Engine', value: engine });
      if (submodel) properties.push({ name: 'Submodel', value: submodel });

      const rowKey = properties
        .map((property) => `${property.name}:${property.value}`)
        .join('|');
      if (seenRows.has(rowKey)) continue;
      seenRows.add(rowKey);
      compatibleProducts.push({
        compatibilityProperties: properties,
        ...(notes ? { notes } : {}),
      });
    }
  }

  if (compatibleProducts.length === 0) return undefined;
  return { compatibleProducts };
}

/** Serialize validated rows back to catalog fitment_data JSON. */
export function serializeValidatedFitmentRow(
  row: ParsedFitmentRow,
  mvlStatus: 'valid' | 'needs_review' | 'rejected',
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    Year: row.year,
    Make: row.make,
    Model: row.model,
    ...(row.trim ? { Trim: row.trim } : {}),
    ...(row.engine ? { Engine: row.engine } : {}),
    ...(row.submodel ? { Submodel: row.submodel } : {}),
    ...(row.notes ? { Notes: row.notes } : {}),
    MvlStatus: mvlStatus,
    ...extra,
  };
}
