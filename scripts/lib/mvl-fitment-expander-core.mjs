/**
 * Deterministic fitment expansion — platform generation, range collapse, part-class rules.
 * AI generates listing copy only; this module expands MVL-compatible fitment rows.
 */

import { SHARED_PLATFORMS } from './shared-platforms.mjs';
import {
  PLATFORM_RANGES,
  buildPlatformKey,
  normalizePlatformMake,
  normalizePlatformModel,
  resolvePlatformGeneration,
} from './platform-generation.mjs';

const BRAND_MAP = {
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

export function resolveFitmentExpansionMode(env = {}) {
  const raw = String(env.FITMENT_EXPANSION_MODE || 'hybrid').trim().toLowerCase();
  if (raw === 'ai' || raw === 'mvl' || raw === 'hybrid') return raw;
  return 'hybrid';
}

export function resolveFitmentAiInterchange(env = {}) {
  const raw = String(env.FITMENT_AI_INTERCHANGE || 'auto').trim().toLowerCase();
  if (raw === 'off' || raw === 'auto' || raw === 'always') return raw;
  return 'auto';
}

export function getFitmentMinMvlRows(env = {}) {
  const n = Number(env.FITMENT_MIN_MVL_ROWS ?? 5);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

export function getSiblingExpansionMode(env = {}) {
  const raw = String(env.FITMENT_SIBLING_EXPANSION || 'conservative').trim().toLowerCase();
  if (raw === 'off' || raw === 'conservative' || raw === 'aggressive') return raw;
  return 'conservative';
}

export function normalizeBrand(brand) {
  const key = String(brand ?? '').toLowerCase().trim();
  return BRAND_MAP[key] ?? String(brand ?? '').trim();
}

export function classifyPartExpansion(partType = '', placement = '') {
  const hay = `${partType} ${placement}`.toLowerCase();
  if (ELECTRICAL_RE.test(hay)) return 'electrical';
  if (MECHANICAL_RE.test(hay)) return 'mechanical';
  if (INTERIOR_RE.test(hay)) return 'interior';
  if (BODY_RE.test(hay)) return 'body';
  return 'general';
}

export function fitmentRowKey(row) {
  return `${row.year}|${row.make}|${row.model}|${row.trim ?? ''}|${row.engine ?? ''}`.toLowerCase();
}

export function addUniqueFitment(fitments, seen, entry) {
  if (!entry.make || !entry.model || !entry.year) return false;
  const key = fitmentRowKey(entry);
  if (seen.has(key)) return false;
  seen.add(key);
  fitments.push(entry);
  return true;
}

export function collapseYearRanges(rows) {
  const groups = new Map();
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
    groups.get(gk).years.push(year);
  }

  const ranges = [];
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

export function expandRangesToRows(ranges, source = 'mvl_expander') {
  const out = [];
  const seen = new Set();
  for (const r of ranges) {
    const yStart = Number(r.yearStart ?? r.year);
    const yEnd = Number(r.yearEnd ?? r.yearStart ?? r.year);
    if (!Number.isFinite(yStart)) continue;
    const lo = Math.min(yStart, yEnd || yStart);
    const hi = Math.max(yStart, yEnd || yStart);
    for (let y = lo; y <= hi; y++) {
      addUniqueFitment(
        out,
        seen,
        {
          year: String(y),
          make: r.make,
          model: r.model,
          trim: r.trim || '',
          engine: r.engine || '',
          submodel: r.chassisCode || r.submodel || '',
          bodyType: r.bodyType || '',
          notes: r.notes || '',
          source: r.source || source,
        },
      );
    }
  }
  return out;
}

export function expandAiCompatibilityToRows(compatibility, normalizeBrandFn = normalizeBrand) {
  const fitments = [];
  const seen = new Set();
  if (!Array.isArray(compatibility)) return fitments;
  for (const c of compatibility) {
    if (!c?.make || !c?.model) continue;
    const yStart = parseInt(c.yearStart, 10) || parseInt(c.year, 10) || 0;
    const yEnd = parseInt(c.yearEnd, 10) || yStart;
    if (!yStart) continue;
    for (let y = yStart; y <= yEnd; y++) {
      addUniqueFitment(fitments, seen, {
        year: String(y),
        make: normalizeBrandFn(c.make),
        model: c.model,
        trim: c.trim || '',
        engine: c.engine || '',
        submodel: c.chassisCode || '',
        bodyType: c.bodyType || '',
        notes: c.notes || '',
        source: 'ai_interchange',
      });
    }
  }
  return fitments;
}

export function buildPnVehicleMap(parts, getVehicleFromPart) {
  const map = new Map();
  for (const part of parts) {
    const norm = String(part.partNumber ?? '')
      .replace(/\s+/g, '')
      .toUpperCase();
    if (!norm) continue;
    const v = getVehicleFromPart(part);
    if (!v?.year) continue;
    if (!map.has(norm)) map.set(norm, []);
    map.get(norm).push(v);
  }
  return map;
}

/**
 * Core deterministic expansion (platform + siblings + cross-VIN + shared platforms).
 * MVL DB filtering is applied by the caller when a store is available.
 */
export function expandFitmentDeterministic(input) {
  const {
    donor,
    partType = '',
    placement = '',
    mpn = '',
    profile = 'full',
    siblingMode = 'conservative',
    pnVehicleMap = null,
    interchangeHints = [],
    legacyAiCompatibility = [],
    maxRows = 400,
    platformRanges = PLATFORM_RANGES,
    sharedPlatforms = SHARED_PLATFORMS,
    getEbayFitmentModelFields = (make, model, trim) => ({ model, trim: trim || '' }),
  } = input;

  const coverage = {
    platformYears: 0,
    siblingModels: 0,
    crossVin: 0,
    sharedPlatform: 0,
    aiInterchange: 0,
    mvlRejected: 0,
  };

  if (profile === 'compact') {
    return {
      ranges: [],
      expandedRows: [],
      coverage,
      needsAiInterchange: false,
      fitmentSource: 'mvl',
    };
  }

  const makeName = normalizeBrand(donor.make);
  const normalizedModel = normalizePlatformModel(makeName, donor.model);
  const ebayFitment = getEbayFitmentModelFields(makeName, donor.model, donor.trim);
  const platformKey = buildPlatformKey(makeName, donor.model);
  const yearNum = parseInt(donor.year, 10) || 0;
  const fitments = [];
  const seen = new Set();
  let generationCode = '';

  if (platformKey && yearNum && platformRanges[platformKey]) {
    const gen = resolvePlatformGeneration(makeName, donor.model, yearNum, platformRanges);
    if (gen) {
      generationCode = gen.code;
      let added = 0;
      for (let y = gen.start; y <= gen.end; y++) {
        if (
          addUniqueFitment(fitments, seen, {
            year: String(y),
            make: makeName,
            model: ebayFitment.model,
            trim: ebayFitment.trim || '',
            engine: donor.engine || '',
            submodel: gen.code,
            bodyType: donor.bodyClass || '',
            notes: `Platform ${gen.code}`,
            source: 'platform_generation',
          })
        ) {
          added++;
        }
      }
      if (added > 0) coverage.platformYears = added;
    }
  }

  const tier = classifyPartExpansion(partType, placement);
  const allowShared =
    siblingMode !== 'off' && (tier === 'body' || tier === 'general' || siblingMode === 'aggressive');
  const allowCrossVin = tier !== 'interior' || siblingMode === 'aggressive';

  if (allowCrossVin && mpn && pnVehicleMap) {
    const norm = String(mpn).replace(/\s+/g, '').toUpperCase();
    const crossVehicles = (pnVehicleMap.get(norm) || []).filter(
      (v) =>
        v.make?.toLowerCase() === makeName.toLowerCase() &&
        v.model?.toLowerCase() === String(donor.model).toLowerCase(),
    );
    if (crossVehicles.length > 1) {
      let added = 0;
      for (const v of crossVehicles.sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10))) {
        const fields = getEbayFitmentModelFields(v.make, v.model, v.trim);
        if (
          addUniqueFitment(fitments, seen, {
            year: String(v.year),
            make: normalizeBrand(v.make),
            model: fields.model,
            trim: fields.trim || v.trim || '',
            engine: v.engine || '',
            submodel: v.submodel || generationCode,
            bodyType: v.bodyType || donor.bodyClass || '',
            notes: 'Cross-referenced from multiple VINs',
            source: 'cross_vin',
          })
        ) {
          added++;
        }
      }
      if (added > 0) coverage.crossVin = added;
    }
  }

  if (allowShared && fitments.length > 0) {
    const siblings = sharedPlatforms[platformKey] || [];
    const existingKeys = new Set(fitments.map((f) => `${f.make}|${f.model}`));
    for (const siblingKey of siblings) {
      if (existingKeys.has(siblingKey)) continue;
      const sibPlatforms = platformRanges[siblingKey];
      if (!sibPlatforms) continue;
      const sibGen = sibPlatforms.find((g) => yearNum >= g.start && yearNum <= g.end);
      if (!sibGen) continue;
      const [sibMake, sibModel] = siblingKey.split('|');
      let added = 0;
      for (let y = sibGen.start; y <= sibGen.end; y++) {
        if (
          addUniqueFitment(fitments, seen, {
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
      if (added > 0) coverage.sharedPlatform += added;
    }
  }

  if (Array.isArray(interchangeHints) && interchangeHints.length > 0) {
    for (const hint of interchangeHints) {
      if (!hint?.make || !hint?.model) continue;
      const yStart = parseInt(hint.yearStart, 10) || parseInt(hint.year, 10) || 0;
      const yEnd = parseInt(hint.yearEnd, 10) || yStart;
      if (!yStart) continue;
      for (let y = yStart; y <= yEnd; y++) {
        if (
          addUniqueFitment(fitments, seen, {
            year: String(y),
            make: normalizeBrand(hint.make),
            model: hint.model,
            trim: hint.trim || '',
            engine: hint.engine || '',
            submodel: hint.chassisCode || '',
            bodyType: '',
            notes: hint.reason || 'AI interchange hint',
            source: 'ai_interchange_hint',
          })
        ) {
          coverage.aiInterchange++;
        }
      }
    }
  }

  if (Array.isArray(legacyAiCompatibility) && legacyAiCompatibility.length > 0) {
    const legacyRows = expandAiCompatibilityToRows(legacyAiCompatibility);
    for (const row of legacyRows) {
      if (addUniqueFitment(fitments, seen, row)) coverage.aiInterchange++;
    }
  }

  if (fitments.length === 0 && donor.year && makeName && ebayFitment.model) {
    addUniqueFitment(fitments, seen, {
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

  const capped = fitments.slice(0, maxRows);
  const ranges = collapseYearRanges(capped);

  return {
    ranges,
    expandedRows: capped,
    coverage,
    needsAiInterchange: false,
    fitmentSource: 'mvl',
    tier,
    platformKey,
    normalizedModel,
  };
}

export function mergeMvlFilteredRows(expandedRows, mvlValidRows, mvlRejectedCount = 0) {
  if (!mvlValidRows?.length) {
    return { rows: expandedRows, mvlRejected: mvlRejectedCount };
  }
  const seen = new Set();
  const out = [];
  for (const row of mvlValidRows) {
    if (addUniqueFitment(out, seen, row)) {
      // kept
    }
  }
  return { rows: out, mvlRejected: mvlRejectedCount };
}

export function evaluateNeedsAiInterchange(rowCount, minRows, tier, aiInterchangeMode) {
  if (aiInterchangeMode === 'off') return false;
  if (aiInterchangeMode === 'always') return true;
  if (rowCount >= minRows) return false;
  if (tier === 'electrical' || tier === 'mechanical') return true;
  return rowCount < minRows;
}
