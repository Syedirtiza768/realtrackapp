/**
 * Pipeline-side listing guards + quality validator (mirrors backend TS).
 */

import { expandFitmentYearRanges } from './fitment-year-expand.mjs';
import { isLowValueSku } from './token-optimization.mjs';

const REQUIRED_SPECIFICS = [
  'Brand',
  'Manufacturer Part Number',
  'Type',
  'Placement on Vehicle',
];

const BRAND_MAP = {
  mercedes: 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
  bmw: 'BMW',
  vw: 'Volkswagen',
  chevy: 'Chevrolet',
};

const DISCLAIMER = 'Please verify part number compatibility before purchasing';

export function trimTitle(title, mpn) {
  let t = title.replace(/\s+/g, ' ').trim();
  if (t.length <= 80) return t;
  const parts = t.split(/\s+/);
  while (parts.join(' ').length > 80 && parts.length > 4) {
    parts.splice(Math.floor(parts.length / 2), 1);
  }
  t = parts.join(' ');
  if (t.length > 80 && mpn) {
    const suffix = String(mpn).replace(/\s+/g, '').slice(-12);
    t = `${t.slice(0, 80 - suffix.length - 1).trim()} ${suffix}`.slice(0, 80);
  }
  return t.slice(0, 80);
}

export function normalizeBrand(brand) {
  const key = String(brand || '').toLowerCase().trim();
  return BRAND_MAP[key] ?? brand;
}

export function dedupeFitment(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = `${row.year}|${row.make}|${row.model}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function applyListingGuards(item, srcPart) {
  const fixes = [];
  const out = { ...item };
  const providedMpn = String(srcPart.partNumber ?? '').trim();

  if (providedMpn) {
    out.mpn = providedMpn.replace(/\s+/g, ' ').trim();
    if (String(item.mpn ?? '') !== out.mpn) fixes.push('MPN_NORMALIZED');
  }

  if (out.brand) {
    const normalized = normalizeBrand(out.brand);
    if (normalized !== out.brand) {
      out.brand = normalized;
      fixes.push('BRAND_NORMALIZED');
    }
  }

  const specifics = { ...(out.itemSpecifics || {}) };
  if (out.brand) specifics.Brand = String(out.brand);
  if (out.mpn) specifics['Manufacturer Part Number'] = String(out.mpn);
  if (out.type) specifics.Type = String(out.type);
  if (out.placement) specifics['Placement on Vehicle'] = String(out.placement);
  out.itemSpecifics = specifics;
  out.warranty = 'No Warranty';
  out.fitmentType = out.fitmentType || 'Direct Replacement';

  const trimmed = trimTitle(String(out.title ?? ''), out.mpn);
  if (trimmed !== out.title) {
    out.title = trimmed;
    fixes.push('TITLE_TRIMMED');
  }

  let desc = String(out.description ?? '');
  if (!/verify part number compatibility/i.test(desc)) {
    out.description = desc
      ? `${desc}<p>${DISCLAIMER}.</p>`
      : `<p>${DISCLAIMER}.</p>`;
    fixes.push('DISCLAIMER_INJECTED');
  }

  if (Array.isArray(out.compatibility)) {
    const expanded = expandFitmentYearRanges(out.compatibility);
    const before = expanded.length;
    out.compatibility = dedupeFitment(expanded);
    if (out.compatibility.length < before) fixes.push('FITMENT_DEDUPED');
  }

  return { item: out, fixes };
}

export function scoreItem(item, srcPart) {
  const flags = [];
  const title = String(item.title || '');
  const titleWithinLimit = title.length > 0 && title.length <= 80;
  const titleScore = [
    titleWithinLimit,
    /\b(19|20)\d{2}\b/.test(title),
    /mercedes|bmw|toyota|ford|honda/i.test(title),
    /\bOEM\b|\bGenuine\b|\bUsed\b/i.test(title),
  ].filter(Boolean).length;

  const desc = String(item.description || '');
  const descScore = [
    /<h[34]>|<ul>|<li>/i.test(desc),
    /verify part number compatibility/i.test(desc),
    /compatib/i.test(desc),
    /used|removed|inspected|tested/i.test(desc),
    desc.length > 300,
  ].filter(Boolean).length;

  const sp = item.itemSpecifics || {};
  const requiredSpecificsFilled = REQUIRED_SPECIFICS.filter(
    (k) => sp[k] && String(sp[k]).trim(),
  ).length;

  const provided = String(srcPart.partNumber || '')
    .replace(/\s+/g, '')
    .toLowerCase();
  const mpn = String(item.mpn || sp['Manufacturer Part Number'] || '')
    .replace(/\s+/g, '')
    .toLowerCase();
  const mpnMatchesProvided =
    provided.length > 0 &&
    (mpn.includes(provided.slice(0, 8)) || mpn === provided);
  if (mpn && provided && !mpn.includes(provided.slice(0, 6))) {
    flags.push(`MPN_MISMATCH provided=${srcPart.partNumber} got=${item.mpn}`);
  }

  const compat = Array.isArray(item.compatibility) ? item.compatibility : [];
  const fitmentRows = compat.length;
  const donorMake = (srcPart.donorMake || 'mercedes').toLowerCase();
  const nonDonor = compat.filter(
    (c) => c.make && !String(c.make).toLowerCase().includes(donorMake.split('-')[0]),
  );
  if (nonDonor.length && donorMake.includes('mercedes')) {
    flags.push(
      `CROSS_MAKE x${nonDonor.length}: ${[...new Set(nonDonor.map((c) => c.make))].join(',')}`,
    );
  }

  const composite = Math.round(
    (titleScore / 4) * 25 +
      (descScore / 5) * 20 +
      (requiredSpecificsFilled / 4) * 20 +
      (Math.min(fitmentRows, 12) / 12) * 20 +
      (compat.some((c) => /w20[0-9]/i.test(String(c.chassisCode || c.model || '')))
        ? 10
        : 0) +
      (mpnMatchesProvided ? 5 : 0),
  );

  return {
    composite,
    titleWithinLimit,
    mpnMatchesProvided,
    fitmentRows,
    flags,
  };
}

export function applyTaxonomyChecks(item, options = {}) {
  const hardFails = [];
  const softFails = [];
  const taxonomy = options.taxonomy;
  if (!taxonomy?.enabled) {
    return { hardFails, softFails, skipped: true };
  }

  const categoryId =
    taxonomy.ebayCategoryId ??
    item.ebayCategoryId ??
    item.categoryId ??
    null;
  if (!categoryId) {
    softFails.push('TAXONOMY_NO_CATEGORY_ID');
    return { hardFails, softFails, skipped: false };
  }

  if (taxonomy.isLeaf === false) {
    hardFails.push(`TAXONOMY_NOT_LEAF:${categoryId}`);
  }

  const sp = item.itemSpecifics || {};
  for (const aspectName of taxonomy.requiredAspects ?? []) {
    if (!sp[aspectName] || !String(sp[aspectName]).trim()) {
      hardFails.push(`TAXONOMY_MISSING_ASPECT:${aspectName}`);
    }
  }

  return { hardFails, softFails, skipped: false };
}

export function validateListing(item, srcPart, options = {}) {
  const hardFails = [];
  const softFails = [];
  const compactProfile =
    options.compactProfile === true ||
    isLowValueSku(options.price, options.lowValueMaxPrice);
  const fitmentMinRows = compactProfile ? 0 : (options.fitmentMinRows ?? 5);

  if (
    options.expectedBatchSize != null &&
    options.actualBatchSize != null &&
    options.actualBatchSize !== options.expectedBatchSize
  ) {
    hardFails.push(
      `WRONG_ITEM_COUNT expected=${options.expectedBatchSize} got=${options.actualBatchSize}`,
    );
  }

  const score = scoreItem(item, srcPart);
  if (!score.mpnMatchesProvided) hardFails.push('MPN_MISMATCH');
  if (!score.titleWithinLimit) hardFails.push('TITLE_OVER_80');

  const sp = item.itemSpecifics || {};
  for (const key of REQUIRED_SPECIFICS) {
    if (!sp[key] || !String(sp[key]).trim()) {
      hardFails.push(`MISSING_SPECIFIC:${key}`);
    }
  }

  for (const flag of score.flags) {
    if (flag.startsWith('CROSS_MAKE') || flag.startsWith('MPN_MISMATCH')) {
      hardFails.push(flag);
    }
  }

  if (!compactProfile && score.fitmentRows < fitmentMinRows) {
    softFails.push(`FITMENT_ROWS_LOW:${score.fitmentRows}`);
  }
  const desc = String(item.description || '');
  if (!/<h[34]>|<ul>/i.test(desc)) softFails.push('DESC_NO_HTML_STRUCTURE');
  if (!compactProfile && !/compatib/i.test(desc)) {
    softFails.push('DESC_NO_COMPAT_SECTION');
  }

  const taxonomy = applyTaxonomyChecks(item, options);
  if (!taxonomy.skipped) {
    hardFails.push(...taxonomy.hardFails);
    softFails.push(...taxonomy.softFails);
  }

  const pass = hardFails.length === 0;
  return {
    pass,
    score: score.composite,
    hardFails,
    softFails,
    escalate: hardFails.length > 0,
    fitmentRowCount: score.fitmentRows,
  };
}
