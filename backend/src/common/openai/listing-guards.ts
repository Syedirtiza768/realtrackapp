/**
 * Deterministic post-AI guards — never trust LLM output blindly.
 */

import type { GuardResult } from './ai-routing-policy.types.js';
import { expandFitmentYearRanges } from './fitment-year-expand.js';

const BRAND_MAP: Record<string, string> = {
  mercedes: 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
  bmw: 'BMW',
  vw: 'Volkswagen',
  chevy: 'Chevrolet',
};

const DISCLAIMER = 'Please verify part number compatibility before purchasing';

function normSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function normMpn(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

/**
 * Trim title to ≤80 chars while preserving year, make, chassis, MPN suffix.
 */
export function trimTitle(title: string, mpn?: string): string {
  let t = normSpaces(title);
  if (t.length <= 80) return t;

  const mpnSuffix = mpn ? normSpaces(mpn).slice(-12) : '';
  const parts = t.split(/\s+/);
  while (parts.join(' ').length > 80 && parts.length > 4) {
    const mid = Math.floor(parts.length / 2);
    parts.splice(mid, 1);
  }
  t = parts.join(' ');
  if (t.length > 80 && mpnSuffix) {
    const base = t.slice(0, 80 - mpnSuffix.length - 1).trim();
    t = `${base} ${mpnSuffix}`.slice(0, 80);
  }
  return t.slice(0, 80);
}

export function normalizeBrand(brand: string): string {
  const key = brand.toLowerCase().trim();
  return BRAND_MAP[key] ?? brand;
}

export function dedupeFitment(
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const out: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const key = `${row.year}|${row.make}|${row.model}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function applyListingGuards(
  item: Record<string, unknown>,
  srcPart: { partNumber?: string },
): GuardResult {
  const fixes: string[] = [];
  const out = { ...item };

  const providedMpn = String(srcPart.partNumber ?? '').trim();
  const rawMpn = String(out.mpn ?? '').trim();
  if (providedMpn && !rawMpn) {
    out.mpn = providedMpn;
    fixes.push('MPN_SET_FROM_INPUT');
  } else if (providedMpn) {
    out.mpn = normSpaces(providedMpn);
    if (rawMpn !== out.mpn) fixes.push('MPN_NORMALIZED');
  }

  const brand = String(out.brand ?? '');
  if (brand) {
    const normalized = normalizeBrand(brand);
    if (normalized !== brand) {
      out.brand = normalized;
      fixes.push('BRAND_NORMALIZED');
    }
  }

  const specifics =
    typeof out.itemSpecifics === 'object' && out.itemSpecifics
      ? { ...(out.itemSpecifics as Record<string, string>) }
      : {};
  if (out.brand) specifics.Brand = String(out.brand);
  if (out.mpn) specifics['Manufacturer Part Number'] = String(out.mpn);
  if (out.type) specifics.Type = String(out.type);
  if (out.placement) specifics['Placement on Vehicle'] = String(out.placement);
  out.itemSpecifics = specifics;

  out.warranty = 'No Warranty';
  out.fitmentType = out.fitmentType || 'Direct Replacement';

  const title = String(out.title ?? '');
  const trimmed = trimTitle(title, String(out.mpn ?? ''));
  if (trimmed !== title) {
    out.title = trimmed;
    fixes.push('TITLE_TRIMMED');
  } else {
    out.title = title;
  }

  let desc = String(out.description ?? '');
  if (!/verify part number compatibility/i.test(desc)) {
    if (desc && !desc.includes('</')) {
      desc += `\n<p>${DISCLAIMER}.</p>`;
    } else if (desc) {
      desc += `<p>${DISCLAIMER}.</p>`;
    } else {
      desc = `<p>${DISCLAIMER}.</p>`;
    }
    out.description = desc;
    fixes.push('DISCLAIMER_INJECTED');
  }

  if (Array.isArray(out.compatibility)) {
    const rawCompat = out.compatibility as Array<Record<string, unknown>>;
    const expanded = expandFitmentYearRanges(rawCompat);
    const deduped = dedupeFitment(expanded);
    out.compatibility = deduped;
    if (deduped.length < expanded.length) fixes.push('FITMENT_DEDUPED');
    if (expanded.length > rawCompat.length)
      fixes.push('FITMENT_YEAR_RANGES_EXPANDED');
  }

  return { item: out, fixes };
}

/**
 * Detect LLM-hallucinated OEM part numbers that don't match the expected brand format.
 *
 * Returns an array of warning strings. Each warning identifies a part whose
 * OEM number doesn't match the brand's known part number pattern.
 *
 * This is a deterministic guard — no AI cost, pure regex matching.
 */
export function detectHallucinatedPartNumbers(
  parts: Array<{
    part_name?: string;
    partName?: string;
    oem_part_number?: string;
    oemPartNumber?: string;
  }>,
  brand: string,
): string[] {
  // Brand → regex for OEM part number format
  const BRAND_FORMATS: Record<string, RegExp> = {
    toyota: /^\d{5}[-]?\d{3,5}$/i,
    lexus: /^\d{5}[-]?\d{3,5}$/i,
    bmw: /^(\d{2}\s?\d{2}\s?\d\s?\d{3}\s?\d{3}|\d{11})$/,
    'mercedes-benz': /^A?\s?\d{3}\s?\d{3}\s?\d{2}\s?\d{2}$/i,
    ford: /^[A-Z0-9]{3,5}[-]?\d{4,5}[-]?[A-Z0-9]{0,3}$/i,
    lincoln: /^[A-Z0-9]{3,5}[-]?\d{4,5}[-]?[A-Z0-9]{0,3}$/i,
    chevrolet: /^\d{7,8}$/,
    gmc: /^\d{7,8}$/,
    cadillac: /^\d{7,8}$/,
    honda: /^\d{5}[-]?\w{5}$/i,
    acura: /^\d{5}[-]?\w{5}$/i,
    nissan: /^\d{5}[-]?[A-Z0-9]{5}$/i,
    infiniti: /^\d{5}[-]?[A-Z0-9]{5}$/i,
    hyundai: /^\d{3,5}[-]?\d{3,5}$/i,
    kia: /^\d{3,5}[-]?\d{3,5}$/i,
    volkswagen: /^[A-Z0-9]{3}\s?\d{3}\s?\d{3}[A-Z]?$/i,
    audi: /^[A-Z0-9]{3}\s?\d{3}\s?\d{3}[A-Z]?$/i,
    subaru: /^\d{3}[-]?\d{3}[-]?\d{2}$/i,
  };

  const normalizedBrand = brand.trim().toLowerCase();
  const format = BRAND_FORMATS[normalizedBrand];

  // If brand not in registry, skip validation
  if (!format) return [];

  const warnings: string[] = [];

  for (const part of parts) {
    const pn = part.oem_part_number || part.oemPartNumber || '';
    const name = part.part_name || part.partName || 'Unknown part';

    if (!pn) continue;

    // Skip [VERIFY] tagged parts — they're already flagged by the AI
    if (pn.includes('[VERIFY]')) continue;

    const normalized = pn.replace(/\s+/g, '').toUpperCase();
    if (!format.test(normalized)) {
      // Check if it matches another brand's format
      const matchedBrands: string[] = [];
      for (const [b, fmt] of Object.entries(BRAND_FORMATS)) {
        if (b !== normalizedBrand && fmt.test(normalized)) {
          matchedBrands.push(b);
        }
      }
      const matchNote =
        matchedBrands.length > 0
          ? ` (matches ${matchedBrands.join(', ')} format)`
          : '';
      warnings.push(
        `"${name}": OEM# "${pn}" does not match ${brand} format${matchNote}`,
      );
    }
  }

  return warnings;
}
