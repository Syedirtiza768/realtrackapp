/**
 * Platform generation helpers — keep logic aligned with
 * backend/src/fitment/platform-generation.util.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PLATFORM_RANGES = JSON.parse(
  readFileSync(join(__dirname, '../../shared/automotive-platform-ranges.json'), 'utf8'),
);

const MODEL_ALIASES = {
  rx350: 'RX',
  rx450h: 'RX',
  rx400h: 'RX',
  rx300: 'RX',
  rx330: 'RX',
  '3-series': '3 Series',
  '5-series': '5 Series',
  'c-class': 'C-Class',
  'e-class': 'E-Class',
};

const BRAND_ALIASES = {
  mercedes: 'Mercedes-Benz',
  'mercedes-benz': 'Mercedes-Benz',
  mb: 'Mercedes-Benz',
  vw: 'Volkswagen',
  chevy: 'Chevrolet',
  landrover: 'Land Rover',
  'land rover': 'Land Rover',
};

export function normalizePlatformMake(make) {
  const raw = String(make ?? '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase();
  return BRAND_ALIASES[key] ?? raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizePlatformModel(make, model) {
  const raw = String(model ?? '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase().replace(/\s+/g, ' ');
  if (MODEL_ALIASES[lower]) return MODEL_ALIASES[lower];
  if (/^rx\d/i.test(raw)) return 'RX';
  if (/^nx\d/i.test(raw)) return 'NX';
  if (/^gx\d/i.test(raw)) return 'GX';
  if (/^es\d/i.test(raw)) return 'ES';
  if (/^is\d/i.test(raw)) return 'IS';
  return raw;
}

export function buildPlatformKey(make, model) {
  const mk = normalizePlatformMake(make);
  const md = normalizePlatformModel(mk, model);
  return mk && md ? `${mk}|${md}` : '';
}

export function resolvePlatformGeneration(make, model, year, ranges = PLATFORM_RANGES) {
  const yearNum = Number(year);
  if (!Number.isFinite(yearNum) || yearNum < 1900) return null;
  const key = buildPlatformKey(make, model);
  const generations = ranges[key];
  if (!generations?.length) return null;
  return generations.find((g) => yearNum >= g.start && yearNum <= g.end) ?? null;
}

export function formatYearRange(start, end) {
  return start === end ? String(start) : `${start}-${end}`;
}

export function parseYearRange(yearRange) {
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

export function validateGenerationYearAlignment(input) {
  const ranges = input.ranges ?? PLATFORM_RANGES;
  const generation = String(input.generation ?? '').trim();
  const parsed = parseYearRange(input.yearRange);
  const anchor = Number(input.anchorYear);
  const key = buildPlatformKey(input.make, input.model);

  let expected = null;
  if (Number.isFinite(anchor) && anchor >= 1900) {
    expected = resolvePlatformGeneration(input.make, input.model, anchor, ranges);
  } else if (parsed && key) {
    const gens = ranges[key] ?? [];
    expected =
      gens.find((g) => parsed.min >= g.start && parsed.max <= g.end + 1) ??
      gens.find((g) => parsed.min <= g.end && parsed.max >= g.start) ??
      null;
  }

  if (generation && expected && generation.toUpperCase() !== expected.code.toUpperCase()) {
    return {
      valid: false,
      message: `Generation ${generation} conflicts with expected ${expected.code} (${expected.start}-${expected.end})`,
      expected,
    };
  }

  if (generation && parsed && key) {
    const gens = ranges[key] ?? [];
    const genRow = gens.find((g) => g.code.toUpperCase() === generation.toUpperCase());
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

export function alignGenerationAndYearRange(input) {
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

  const generation = platform?.code ?? String(input.generation ?? '').trim() ?? '';
  const yearRange =
    yearStart != null && yearEnd != null
      ? formatYearRange(yearStart, yearEnd)
      : String(input.yearRange ?? '').trim();

  return { generation, yearRange };
}

export function extractFitmentVariantTokens(rows, max = 2) {
  const tokens = new Set();
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

export function detectTitleGenerationMismatch(title, make, model, anchorYear, ranges = PLATFORM_RANGES) {
  const text = String(title ?? '');
  if (!text.trim()) return null;

  const yearMatch = text.match(/\b((19|20)\d{2})(?:\s*[-–]\s*((19|20)\d{2}))?\b/);
  const yearRange = yearMatch
    ? yearMatch[3]
      ? `${yearMatch[1]}-${yearMatch[3]}`
      : yearMatch[1]
    : undefined;

  const genMatch = text.match(/\b([A-Z]{1,3}\d{1,3}(?:\/[A-Z0-9]+)?|W\d{3}|XW\d{2}|XV\d{2}|XE\d{2}|AL\d{2}|XU\d{2})\b/i);
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

/** Build SEO US title with platform-aligned year range + chassis code. */
export function buildPlatformSeoTitle({
  vehicle,
  partName,
  mpn,
  placement,
  fitments = [],
}) {
  const make = normalizePlatformMake(vehicle?.make);
  const model = normalizePlatformModel(make, vehicle?.model);
  const yearNum = parseInt(vehicle?.year, 10);
  const platform = Number.isFinite(yearNum)
    ? resolvePlatformGeneration(make, model, yearNum)
    : null;

  const aligned = platform
    ? { generation: platform.code, yearRange: formatYearRange(platform.start, platform.end) }
    : alignGenerationAndYearRange({
        make,
        model,
        anchorYear: vehicle?.year,
        fitmentYears: fitments.map((f) => f.year),
      });

  const variants = extractFitmentVariantTokens(fitments, 2);
  const segments = [
    aligned.yearRange,
    make,
    model !== 'RX' ? model : null,
    ...variants,
    platform?.code ?? aligned.generation,
    partName,
    placement,
    mpn,
    'OEM',
    'Used',
  ].filter(Boolean);

  return segments.join(' ').replace(/\s+/g, ' ').slice(0, 80).trim();
}
