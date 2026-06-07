/**
 * Deterministic post-AI guards — never trust LLM output blindly.
 */

import type { GuardResult } from './ai-routing-policy.types.js';

const BRAND_MAP: Record<string, string> = {
  mercedes: 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
  bmw: 'BMW',
  vw: 'Volkswagen',
  chevy: 'Chevrolet',
};

const DISCLAIMER =
  'Please verify part number compatibility before purchasing';

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
    const before = out.compatibility.length;
    const deduped = dedupeFitment(
      out.compatibility as Array<Record<string, unknown>>,
    );
    out.compatibility = deduped;
    if (deduped.length < before) fixes.push('FITMENT_DEDUPED');
  }

  return { item: out, fixes };
}
