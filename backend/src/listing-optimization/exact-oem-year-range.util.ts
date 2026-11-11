/** A saved OEM lookup row whose citation can support a title-only year range. */
export interface ExactOemYearRangeEvidenceRow {
  make?: string;
  model?: string;
  trim?: string;
  notes?: string;
  source?: string;
  evidenceSource?: string;
  mvlStatus?: string;
}

export interface ExactOemYearRangeTarget {
  make: string;
  model: string;
  trim?: string;
}

export interface ExactOemYearRange {
  startYear: number;
  endYear: number;
  make: string;
}

/**
 * Reuse an explicit inclusive range already stored from an exact-MPN OEM
 * citation. The caller uses this only to compose draft titles; the row's MVL
 * status does not make it publishable compatibility.
 */
export function findCitedExactOemYearRange(
  rows: ExactOemYearRangeEvidenceRow[],
  expectedMpn: string | null | undefined,
  target: ExactOemYearRangeTarget,
  maxSpan: number,
  maxYear: number,
): ExactOemYearRange | null {
  const expectedMpnKey = normalizeIdentifier(expectedMpn ?? '');
  const targetMakeKey = normalizeIdentifier(target.make);
  const targetModelTokens = modelTokens(`${target.model} ${target.trim ?? ''}`);
  const targetVariantTokens = modelTokens(target.trim ?? '');
  const targetModelOnlyTokens = modelTokens(target.model);
  if (
    !expectedMpnKey ||
    !targetMakeKey ||
    targetModelTokens.length === 0
  ) {
    return null;
  }

  const ranges = new Map<
    string,
    { startYear: number; endYear: number; make: string; score: number }
  >();
  for (const row of rows) {
    const source = (row.evidenceSource ?? row.source ?? '').toLowerCase();
    if (
      source !== 'oem_catalog_lookup' ||
      normalizeIdentifier(row.make ?? '') !== targetMakeKey ||
      !row.notes ||
      !hasExactMpnCitation(row.notes, expectedMpnKey)
    ) {
      continue;
    }

    for (const line of row.notes.split(/\r?\n/)) {
      const match = line.match(
        /^\s*[-*•]\s*((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\s+(.+?)\s*$/,
      );
      if (!match) continue;
      const startYear = Number(match[1]);
      const endYear = Number(match[2]);
      if (
        endYear < startYear ||
        endYear - startYear > maxSpan ||
        startYear < 1900 ||
        endYear > maxYear
      ) {
        continue;
      }

      const application = match[3]
        .replace(/\s*\([^)]*\).*$/, '')
        .trim();
      const make = row.make!.trim();
      if (!application.toLowerCase().startsWith(`${make.toLowerCase()} `)) {
        continue;
      }
      const applicationTokens = modelTokens(application.slice(make.length));
      if (
        applicationTokens.length === 0 ||
        !applicationTokens.every((token) => targetModelTokens.includes(token))
      ) {
        continue;
      }

      const relevantTokens =
        targetVariantTokens.length > 0
          ? targetVariantTokens
          : targetModelOnlyTokens;
      const overlap = applicationTokens.filter((token) =>
        relevantTokens.includes(token),
      ).length;
      if (overlap === 0) continue;

      const key = `${startYear}-${endYear}`;
      const score = overlap * 100 + applicationTokens.length;
      const existing = ranges.get(key);
      if (!existing || score > existing.score) {
        ranges.set(key, { startYear, endYear, make, score });
      }
    }
  }

  if (ranges.size === 0) return null;
  const bestScore = Math.max(...[...ranges.values()].map((range) => range.score));
  const bestRanges = [...ranges.values()].filter(
    (range) => range.score === bestScore,
  );
  if (bestRanges.length !== 1) return null;
  const { startYear, endYear, make } = bestRanges[0];
  return { startYear, endYear, make };
}

function hasExactMpnCitation(notes: string, expectedMpnKey: string): boolean {
  // Stored OEM evidence starts with this exact-match statement. Comparing the
  // normalized identifier avoids treating an alternate part number later in a
  // catalog page as proof for the product being optimized.
  const match = notes.match(/^\s*Exact MPN\s+([^\s]+)\s+matched\b/i);
  return !!match && normalizeIdentifier(match[1]) === expectedMpnKey;
}

function normalizeIdentifier(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

function modelTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (token) =>
        (token.length > 1 || /^[a-z]$/.test(token)) &&
        !/^(?:19|20)\d{2}$/.test(token) &&
        !/^mk\d+$/.test(token),
    );
}
