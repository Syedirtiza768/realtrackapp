/**
 * Deterministic fitment expansion utilities — aligned with scripts/lib/mvl-fitment-expander-core.mjs
 */

import {
  buildPlatformKey,
  normalizePlatformMake,
  normalizePlatformModel,
  resolvePlatformGeneration,
  type PlatformGeneration,
  type PlatformRangesMap,
} from './platform-generation.util.js';

export type FitmentExpansionMode = 'mvl' | 'hybrid' | 'ai';
export type FitmentAiInterchange = 'off' | 'auto' | 'always';
export type SiblingExpansionMode = 'off' | 'conservative' | 'aggressive';
export type PartExpansionTier =
  | 'body'
  | 'interior'
  | 'mechanical'
  | 'electrical'
  | 'general';

export interface FitmentRangeRow {
  yearStart: number;
  yearEnd: number;
  make: string;
  model: string;
  trim?: string;
  engine?: string;
  chassisCode?: string;
  bodyType?: string;
  notes?: string;
  source: string;
}

export interface ExpandedFitmentRow {
  year: string;
  make: string;
  model: string;
  trim?: string;
  engine?: string;
  submodel?: string;
  bodyType?: string;
  notes?: string;
  source: string;
  mvlSource?: string;
}

export interface DonorVehicle {
  year: string;
  make: string;
  model: string;
  trim?: string;
  engine?: string;
  bodyClass?: string;
}

const BRAND_MAP: Record<string, string> = {
  mercedes: 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
  mb: 'Mercedes-Benz',
  vw: 'Volkswagen',
  chevy: 'Chevrolet',
};

const BODY_RE =
  /bumper|fender|headlight|taillight|mirror|hood|grille|door|quarter|spoiler|moulding|molding/i;
const INTERIOR_RE =
  /seat|dash|console|trim|panel|carpet|airbag|steering|armrest|headliner/i;
const MECHANICAL_RE =
  /engine|transmission|turbo|alternator|starter|radiator|axle|brake|suspension|exhaust/i;
const ELECTRICAL_RE = /ecu|module|sensor|computer|wiring|harness|control unit/i;

export function resolveFitmentExpansionMode(
  raw?: string | null,
): FitmentExpansionMode {
  const v = String(raw ?? 'hybrid')
    .trim()
    .toLowerCase();
  if (v === 'ai' || v === 'mvl' || v === 'hybrid') return v;
  return 'hybrid';
}

export function resolveFitmentAiInterchange(
  raw?: string | null,
): FitmentAiInterchange {
  const v = String(raw ?? 'auto')
    .trim()
    .toLowerCase();
  if (v === 'off' || v === 'auto' || v === 'always') return v;
  return 'auto';
}

export function getFitmentMinMvlRows(raw?: string | null): number {
  const n = Number(raw ?? 5);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

export function getSiblingExpansionMode(
  raw?: string | null,
): SiblingExpansionMode {
  const v = String(raw ?? 'conservative')
    .trim()
    .toLowerCase();
  if (v === 'off' || v === 'conservative' || v === 'aggressive') return v;
  return 'conservative';
}

export function normalizeFitmentBrand(brand: string): string {
  const key = brand.toLowerCase().trim();
  return BRAND_MAP[key] ?? brand.trim();
}

export function classifyPartExpansion(
  partType = '',
  placement = '',
): PartExpansionTier {
  const hay = `${partType} ${placement}`.toLowerCase();
  if (ELECTRICAL_RE.test(hay)) return 'electrical';
  if (MECHANICAL_RE.test(hay)) return 'mechanical';
  if (INTERIOR_RE.test(hay)) return 'interior';
  if (BODY_RE.test(hay)) return 'body';
  return 'general';
}

export function fitmentRowKey(row: ExpandedFitmentRow): string {
  return `${row.year}|${row.make}|${row.model}|${row.trim ?? ''}|${row.engine ?? ''}`.toLowerCase();
}

export function addUniqueFitmentRow(
  fitments: ExpandedFitmentRow[],
  seen: Set<string>,
  entry: ExpandedFitmentRow,
): boolean {
  if (!entry.make || !entry.model || !entry.year) return false;
  const key = fitmentRowKey(entry);
  if (seen.has(key)) return false;
  seen.add(key);
  fitments.push(entry);
  return true;
}

export function collapseYearRanges(
  rows: ExpandedFitmentRow[],
): FitmentRangeRow[] {
  const groups = new Map<
    string,
    {
      make: string;
      model: string;
      trim?: string;
      engine?: string;
      submodel?: string;
      bodyType?: string;
      notes?: string;
      source: string;
      years: number[];
    }
  >();

  for (const row of rows) {
    const year = Number(row.year);
    if (!Number.isFinite(year)) continue;
    const gk = `${row.make}|${row.model}|${row.trim ?? ''}|${row.engine ?? ''}|${row.submodel ?? ''}`;
    if (!groups.has(gk)) {
      groups.set(gk, {
        make: row.make,
        model: row.model,
        trim: row.trim,
        engine: row.engine,
        submodel: row.submodel,
        bodyType: row.bodyType,
        notes: row.notes,
        source: row.source,
        years: [],
      });
    }
    groups.get(gk)!.years.push(year);
  }

  const ranges: FitmentRangeRow[] = [];
  for (const g of groups.values()) {
    const years = [...new Set(g.years)].sort((a, b) => a - b);
    let start = years[0];
    let prev = years[0];
    for (let i = 1; i <= years.length; i++) {
      const y = years[i];
      if (y === prev + 1) {
        prev = y;
        continue;
      }
      ranges.push({
        yearStart: start,
        yearEnd: prev,
        make: g.make,
        model: g.model,
        trim: g.trim,
        engine: g.engine,
        chassisCode: g.submodel,
        bodyType: g.bodyType,
        notes: g.notes,
        source: g.source,
      });
      start = y;
      prev = y;
    }
  }
  return ranges;
}

export function evaluateNeedsAiInterchange(
  rowCount: number,
  minRows: number,
  tier: PartExpansionTier,
  aiInterchangeMode: FitmentAiInterchange,
): boolean {
  if (aiInterchangeMode === 'off') return false;
  if (aiInterchangeMode === 'always') return true;
  if (rowCount >= minRows) return false;
  if (tier === 'electrical' || tier === 'mechanical') return true;
  return rowCount < minRows;
}

export interface DeterministicExpandInput {
  donor: DonorVehicle;
  partType?: string;
  placement?: string;
  profile?: 'compact' | 'full';
  siblingMode?: SiblingExpansionMode;
  maxRows?: number;
  platformRanges?: PlatformRangesMap;
  sharedPlatforms?: Record<string, string[]>;
  resolveEbayModel?: (
    make: string,
    model: string,
    trim?: string,
  ) => { model: string; trim: string };
}

export interface DeterministicExpandResult {
  ranges: FitmentRangeRow[];
  expandedRows: ExpandedFitmentRow[];
  tier: PartExpansionTier;
  platformKey: string;
  generation: PlatformGeneration | null;
  coverage: {
    platformYears: number;
    siblingModels: number;
    crossVin: number;
    sharedPlatform: number;
    mvlRejected: number;
  };
}

export function expandFitmentDeterministic(
  input: DeterministicExpandInput,
): DeterministicExpandResult {
  const {
    donor,
    partType = '',
    placement = '',
    profile = 'full',
    siblingMode = 'conservative',
    maxRows = 400,
    platformRanges = {},
    sharedPlatforms = {},
    resolveEbayModel = (make, model, trim) => ({
      model,
      trim: trim ?? '',
    }),
  } = input;

  const coverage = {
    platformYears: 0,
    siblingModels: 0,
    crossVin: 0,
    sharedPlatform: 0,
    mvlRejected: 0,
  };

  if (profile === 'compact') {
    return {
      ranges: [],
      expandedRows: [],
      tier: classifyPartExpansion(partType, placement),
      platformKey: '',
      generation: null,
      coverage,
    };
  }

  const makeName = normalizeFitmentBrand(donor.make);
  const ebayFitment = resolveEbayModel(makeName, donor.model, donor.trim);
  const platformKey = buildPlatformKey(makeName, donor.model);
  const yearNum = parseInt(donor.year, 10) || 0;
  const fitments: ExpandedFitmentRow[] = [];
  const seen = new Set<string>();
  let generation: PlatformGeneration | null = null;
  let generationCode = '';

  if (platformKey && yearNum) {
    generation = resolvePlatformGeneration(
      makeName,
      donor.model,
      yearNum,
      platformRanges,
    );
    if (generation) {
      generationCode = generation.code;
      let added = 0;
      for (let y = generation.start; y <= generation.end; y++) {
        if (
          addUniqueFitmentRow(fitments, seen, {
            year: String(y),
            make: makeName,
            model: ebayFitment.model,
            trim: ebayFitment.trim || '',
            engine: donor.engine || '',
            submodel: generation.code,
            bodyType: donor.bodyClass || '',
            notes: `Platform ${generation.code}`,
            source: 'platform_generation',
          })
        ) {
          added++;
        }
      }
      coverage.platformYears = added;
    }
  }

  if (fitments.length === 0 && donor.year && makeName && ebayFitment.model) {
    addUniqueFitmentRow(fitments, seen, {
      year: String(donor.year),
      make: makeName,
      model: ebayFitment.model,
      trim: ebayFitment.trim || donor.trim || '',
      engine: donor.engine || '',
      submodel: generationCode,
      bodyType: donor.bodyClass || '',
      notes: donor.trim ? `Trim: ${donor.trim}` : '',
      source: 'donor_vehicle',
    });
  }

  const tier = classifyPartExpansion(partType, placement);
  const allowShared =
    siblingMode !== 'off' &&
    (tier === 'body' || tier === 'general' || siblingMode === 'aggressive');

  if (allowShared && fitments.length > 0 && yearNum) {
    const siblings = sharedPlatforms[platformKey] ?? [];
    const existingKeys = new Set(fitments.map((f) => `${f.make}|${f.model}`));
    for (const siblingKey of siblings) {
      if (existingKeys.has(siblingKey)) continue;
      const sibPlatforms = platformRanges[siblingKey];
      if (!sibPlatforms) continue;
      const sibGen = sibPlatforms.find(
        (g) => yearNum >= g.start && yearNum <= g.end,
      );
      if (!sibGen) continue;
      const [sibMake, sibModel] = siblingKey.split('|');
      let added = 0;
      for (let y = sibGen.start; y <= sibGen.end; y++) {
        if (
          addUniqueFitmentRow(fitments, seen, {
            year: String(y),
            make: sibMake,
            model: sibModel,
            trim: '',
            engine: '',
            submodel: sibGen.code,
            bodyType: '',
            notes: `Shared platform with ${makeName} ${donor.model} (${sibGen.code})`,
            source: 'shared_platform',
          })
        ) {
          added++;
        }
      }
      coverage.sharedPlatform += added;
    }
  }

  const capped = fitments.slice(0, maxRows);
  return {
    ranges: collapseYearRanges(capped),
    expandedRows: capped,
    tier,
    platformKey,
    generation,
    coverage,
  };
}
