import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface PlatformGeneration {
  start: number;
  end: number;
  code: string;
}

export type PlatformRangesMap = Record<string, PlatformGeneration[]>;

function loadPlatformRanges(): PlatformRangesMap {
  const candidates = [
    join(process.cwd(), 'shared/automotive-platform-ranges.json'),
    join(process.cwd(), '../shared/automotive-platform-ranges.json'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, 'utf8')) as PlatformRangesMap;
    }
  }
  return {};
}

const PLATFORM_RANGES = loadPlatformRanges();

const MODEL_ALIASES: Record<string, string> = {
  rx350: 'RX',
  rx450h: 'RX',
  rx400h: 'RX',
  rx300: 'RX',
  rx330: 'RX',
  '3-series': '3 Series',
  '5-series': '5 Series',
  '7-series': '7 Series',
  '4-series': '4 Series',
  'c-class': 'C-Class',
  'e-class': 'E-Class',
  's-class': 'S-Class',
  'gle-class': 'GLE',
  'glc-class': 'GLC',
  'a-class': 'A-Class',
};

const BRAND_ALIASES: Record<string, string> = {
  mercedes: 'Mercedes-Benz',
  'mercedes-benz': 'Mercedes-Benz',
  mb: 'Mercedes-Benz',
  vw: 'Volkswagen',
  chevy: 'Chevrolet',
  landrover: 'Land Rover',
  'land rover': 'Land Rover',
};

/** Normalize make/model for platform lookup keys (MAKE|MODEL). */
export function normalizePlatformMake(make: string | null | undefined): string {
  const raw = String(make ?? '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase();
  return BRAND_ALIASES[key] ?? raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizePlatformModel(
  make: string | null | undefined,
  model: string | null | undefined,
): string {
  const raw = String(model ?? '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase().replace(/\s+/g, ' ');
  if (MODEL_ALIASES[lower]) return MODEL_ALIASES[lower];
  // RX350 → RX, C350 → strip if Lexus/Toyota luxury line handled elsewhere
  if (/^rx\d/i.test(raw)) return 'RX';
  if (/^nx\d/i.test(raw)) return 'NX';
  if (/^gx\d/i.test(raw)) return 'GX';
  if (/^es\d/i.test(raw)) return 'ES';
  if (/^is\d/i.test(raw)) return 'IS';
  return raw;
}

export function buildPlatformKey(
  make: string | null | undefined,
  model: string | null | undefined,
): string {
  const mk = normalizePlatformMake(make);
  const md = normalizePlatformModel(mk, model);
  return mk && md ? `${mk}|${md}` : '';
}

/** Resolve chassis generation from donor/model year. */
export function resolvePlatformGeneration(
  make: string | null | undefined,
  model: string | null | undefined,
  year: number | string | null | undefined,
  ranges: PlatformRangesMap = PLATFORM_RANGES,
): PlatformGeneration | null {
  const yearNum = Number(year);
  if (!Number.isFinite(yearNum) || yearNum < 1900) return null;

  const key = buildPlatformKey(make, model);
  const generations = ranges[key];
  if (!generations?.length) return null;

  return (
    generations.find((g) => yearNum >= g.start && yearNum <= g.end) ?? null
  );
}

export function formatYearRange(start: number, end: number): string {
  return start === end ? String(start) : `${start}-${end}`;
}

/** Parse "2013", "2013-2021", "2013–2021" into [min, max] years. */
export function parseYearRange(
  yearRange: string | null | undefined,
): { min: number; max: number } | null {
  const raw = String(yearRange ?? '').trim();
  if (!raw) return null;

  const match = raw.match(/^(19|20)\d{2}(?:\s*[-–]\s*((19|20)\d{2}))?/);
  if (!match) return null;

  const start = Number(match[0].slice(0, 4));
  const endMatch = raw.match(/[-–]\s*((19|20)\d{2})/);
  const end = endMatch ? Number(endMatch[1]) : start;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { min: Math.min(start, end), max: Math.max(start, end) };
}

/** True when generation code appears in title/yearRange but years fall outside its platform span. */
export function validateGenerationYearAlignment(input: {
  generation?: string | null;
  yearRange?: string | null;
  make?: string | null;
  model?: string | null;
  anchorYear?: number | string | null;
  ranges?: PlatformRangesMap;
}): { valid: boolean; message?: string; expected?: PlatformGeneration } {
  const ranges = input.ranges ?? PLATFORM_RANGES;
  const generation = String(input.generation ?? '').trim();
  const parsed = parseYearRange(input.yearRange);
  const anchor = Number(input.anchorYear);
  const key = buildPlatformKey(input.make, input.model);

  let expected: PlatformGeneration | null = null;
  if (Number.isFinite(anchor) && anchor >= 1900) {
    expected = resolvePlatformGeneration(
      input.make,
      input.model,
      anchor,
      ranges,
    );
  } else if (parsed && key) {
    const gens = ranges[key] ?? [];
    expected =
      gens.find((g) => parsed.min >= g.start && parsed.max <= g.end + 1) ??
      gens.find((g) => parsed.min <= g.end && parsed.max >= g.start) ??
      null;
  }

  if (
    generation &&
    expected &&
    generation.toUpperCase() !== expected.code.toUpperCase()
  ) {
    return {
      valid: false,
      message: `Generation ${generation} conflicts with expected ${expected.code} (${expected.start}-${expected.end})`,
      expected,
    };
  }

  if (generation && parsed && key) {
    const gens = ranges[key] ?? [];
    const genRow = gens.find(
      (g) => g.code.toUpperCase() === generation.toUpperCase(),
    );
    if (genRow && (parsed.min < genRow.start || parsed.max > genRow.end)) {
      return {
        valid: false,
        message: `Year range ${input.yearRange} outside ${generation} platform (${genRow.start}-${genRow.end})`,
        expected: genRow,
      };
    }
  }

  if (expected && parsed) {
    if (parsed.min < expected.start || parsed.max > expected.end) {
      return {
        valid: false,
        message: `Year range ${input.yearRange} extends beyond ${expected.code} (${expected.start}-${expected.end})`,
        expected,
      };
    }
  }

  return { valid: true, expected: expected ?? undefined };
}

/** Align generation + yearRange from donor year and optional fitment span. */
export function alignGenerationAndYearRange(input: {
  generation?: string | null;
  yearRange?: string | null;
  make?: string | null;
  model?: string | null;
  anchorYear?: number | string | null;
  fitmentYears?: Array<number | string | null | undefined>;
  ranges?: PlatformRangesMap;
}): { generation: string; yearRange: string } {
  const ranges = input.ranges ?? PLATFORM_RANGES;
  const anchor = Number(input.anchorYear);
  const platform =
    Number.isFinite(anchor) && anchor >= 1900
      ? resolvePlatformGeneration(input.make, input.model, anchor, ranges)
      : null;

  const fitmentNums = (input.fitmentYears ?? [])
    .map((y) => Number(y))
    .filter((y) => Number.isFinite(y) && y >= 1900);

  let yearStart = platform?.start;
  let yearEnd = platform?.end;

  if (fitmentNums.length > 0) {
    const fitMin = Math.min(...fitmentNums);
    const fitMax = Math.max(...fitmentNums);
    if (platform) {
      yearStart = Math.max(platform.start, fitMin);
      yearEnd = Math.min(platform.end, fitMax);
    } else {
      yearStart = fitMin;
      yearEnd = fitMax;
    }
  }

  if (yearStart == null || yearEnd == null) {
    const parsed = parseYearRange(input.yearRange);
    if (parsed) {
      yearStart = parsed.min;
      yearEnd = parsed.max;
    } else if (Number.isFinite(anchor)) {
      yearStart = anchor;
      yearEnd = anchor;
    }
  }

  const generation =
    platform?.code ?? String(input.generation ?? '').trim() ?? '';

  const yearRange =
    yearStart != null && yearEnd != null
      ? formatYearRange(yearStart, yearEnd)
      : String(input.yearRange ?? '').trim();

  return {
    generation,
    yearRange,
  };
}

/** Extract buyer-search variant tokens (RX350, RX450h) from fitment trim/submodel fields. */
export function extractFitmentVariantTokens(
  rows: Array<{
    trim?: string | null;
    submodel?: string | null;
    model?: string | null;
  }>,
  max = 2,
): string[] {
  const tokens = new Set<string>();
  const pattern =
    /\b(RX\s?\d{3}h?|RX\d{3}h?|NX\d{3}|GX\d{3}|ES\d{3}|IS\d{3}|C\s?\d{3}|E\s?\d{3}|GLC\s?\d{3}|GLE\s?\d{3}|3\s?Series|5\s?Series)\b/gi;

  for (const row of rows) {
    for (const field of [row.trim, row.submodel, row.model]) {
      const text = String(field ?? '');
      if (!text) continue;
      for (const match of text.matchAll(pattern)) {
        const normalized = match[0].replace(/\s+/g, '').toUpperCase();
        if (normalized.length >= 3) tokens.add(normalized);
      }
    }
  }

  return [...tokens].slice(0, max);
}

/** Detect generation/year mismatch inside a listing title. */
export function detectTitleGenerationMismatch(
  title: string,
  make?: string | null,
  model?: string | null,
  anchorYear?: number | string | null,
  ranges: PlatformRangesMap = PLATFORM_RANGES,
): string | null {
  const text = String(title ?? '');
  if (!text.trim()) return null;

  const yearMatch = text.match(
    /\b((19|20)\d{2})(?:\s*[-–]\s*((19|20)\d{2}))?\b/,
  );
  const yearRange = yearMatch
    ? yearMatch[3]
      ? `${yearMatch[1]}-${yearMatch[3]}`
      : yearMatch[1]
    : undefined;

  const genMatch = text.match(
    /\b([A-Z]{1,3}\d{1,3}(?:\/[A-Z0-9]+)?|W\d{3}|XW\d{2}|XV\d{2}|XE\d{2}|AL\d{2}|XU\d{2})\b/i,
  );
  const generation = genMatch?.[1];

  if (!generation && !yearRange) return null;

  const check = validateGenerationYearAlignment({
    generation,
    yearRange,
    make,
    model,
    anchorYear,
    ranges,
  });

  return check.valid ? null : (check.message ?? 'GENERATION_YEAR_MISMATCH');
}

export interface PlatformSeoTitleInput {
  make?: string | null;
  model?: string | null;
  year?: string | number | null;
  partType?: string | null;
  partName?: string | null;
  mpn?: string | null;
  placement?: string | null;
  fitmentRows?: Array<{
    year?: string;
    trim?: string;
    submodel?: string;
    model?: string;
  }>;
}

/** Build SEO English Motors title with platform-aligned year range + variant tokens. */
export function buildPlatformSeoTitle(input: PlatformSeoTitleInput): string {
  const make = normalizePlatformMake(input.make);
  const model = normalizePlatformModel(make, input.model);
  const yearNum = Number(input.year);
  const platform =
    Number.isFinite(yearNum) && yearNum >= 1900
      ? resolvePlatformGeneration(make, model, yearNum)
      : null;

  const aligned = platform
    ? {
        generation: platform.code,
        yearRange: formatYearRange(platform.start, platform.end),
      }
    : alignGenerationAndYearRange({
        make,
        model,
        anchorYear: input.year,
        fitmentYears: input.fitmentRows?.map((r) => r.year),
      });

  const variants = extractFitmentVariantTokens(
    (input.fitmentRows ?? []).map((r) => ({
      trim: r.trim,
      submodel: r.submodel,
      model: r.model,
    })),
    2,
  );

  const partLabel = (input.partName ?? input.partType ?? '').trim();
  const placement = input.placement?.trim();
  const mpn = input.mpn?.trim();

  const segments = [
    aligned.yearRange,
    make,
    model !== 'RX' ? model : null,
    ...variants,
    platform?.code ?? aligned.generation,
    partLabel,
    placement,
    mpn,
    'Used',
    'OEM',
  ].filter(Boolean);

  return segments.join(' ').replace(/\s+/g, ' ').slice(0, 80).trim();
}

export function getPlatformRanges(): PlatformRangesMap {
  return PLATFORM_RANGES;
}
