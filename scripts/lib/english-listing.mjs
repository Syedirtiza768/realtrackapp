/**
 * Native English eBay Motors listing helpers (US / AU pipeline).
 * Keep in sync with backend/src/channels/ebay/ebay-english-listing.util.ts
 */

import {
  alignGenerationAndYearRange,
  buildPlatformSeoTitle,
  detectTitleGenerationMismatch,
  resolvePlatformGeneration,
} from './platform-generation.mjs';

export function applyAustralianSpelling(text) {
  return String(text)
    .replace(/\bColor\b/g, 'Colour')
    .replace(/\bcolor\b/g, 'colour')
    .replace(/\bCenter\b/g, 'Centre')
    .replace(/\bcenter\b/g, 'centre')
    .replace(/\bTire\b/g, 'Tyre')
    .replace(/\btire\b/g, 'tyre')
    .replace(/\bMold\b/g, 'Mould')
    .replace(/\bmold\b/g, 'mould');
}

export function buildEnglishSeoTitle({ vehicle, part, partNumber, placement, fitments = [] }) {
  const partName = part?._shortPartName || part?.partName || part?._enriched?.type || '';
  let title = buildPlatformSeoTitle({
    vehicle,
    partName,
    mpn: partNumber || part?.partNumber,
    placement: placement || part?._enriched?.placement,
    fitments,
  });
  if (!/used/i.test(title) && title.length + 5 <= 80) title += ' Used';
  // Ensure "OEM Used" suffix is never truncated
  const suffix = 'OEM Used';
  if (title.length > 80 && title.endsWith(suffix)) {
    const core = title.replace(/\s*OEM Used$/, '').trim();
    const maxCore = 80 - suffix.length - 1;
    title = core.slice(0, maxCore).trim() + ' ' + suffix;
  }
  return title.replace(/\s+/g, ' ').slice(0, 80).trim();
}

export function buildEnglishBasicDescription({ part, vehicle, partNumber, placement, fitments = [], marketplace = 'US' }) {
  const partName = part?._shortPartName || part?.partName || 'Automotive Part';
  const pn = String(partNumber || part?.partNumber || '').trim();
  const placementText = placement?.trim();
  const donor = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(' ');
  const fitmentLines = (fitments || [])
    .filter((f) => f.make && f.model && f.year)
    .slice(0, 6)
    .map((f) => `${f.year} ${f.make} ${f.model}${f.trim ? ` ${f.trim}` : ''}`)
    .join(', ');

  const body = [
    `Genuine used OEM ${partName}${placementText ? ` (${placementText})` : ''}${pn ? ` — part number ${pn}` : ''}.`,
    donor ? `Donor vehicle: ${donor} (reference only).` : '',
    'Used OEM condition with normal wear. Photos show the actual item where applicable.',
    fitmentLines
      ? `Sample compatible vehicles: ${fitmentLines}. Please verify part number and photos before purchase.`
      : 'Please verify part number compatibility and compare photos before purchase.',
    marketplace === 'AU'
      ? 'Ships from the United States unless otherwise stated. International delivery to Australia — import duties/GST may apply.'
      : 'Ships from the United States unless otherwise stated.',
    'Contact us with compatibility questions before ordering.',
  ].filter(Boolean).join(' ');

  return marketplace === 'AU' ? applyAustralianSpelling(body) : body;
}

export function buildEnglishItemSpecifics({ part, vehicle, partNumber, placement, fitments = [] }) {
  const pn = String(partNumber || part?.partNumber || '').trim();
  const out = {};
  const set = (k, v) => { if (v?.trim()) out[k] = String(v).trim(); };
  const platform = vehicle?.year
    ? resolvePlatformGeneration(vehicle.make, vehicle.model, vehicle.year)
    : null;
  const aligned = platform
    ? { generation: platform.code, yearRange: `${platform.start}-${platform.end}` }
    : alignGenerationAndYearRange({
        generation: platform?.code,
        make: vehicle?.make || part?.brand,
        model: vehicle?.model,
        anchorYear: vehicle?.year,
        fitmentYears: fitments.map((f) => f.year),
      });

  set('Brand', vehicle?.make || part?.brand || part?._enriched?.brand);
  set('Manufacturer Part Number', pn);
  set('OE/OEM Part Number', pn);
  set('Type', part?._shortPartName || part?.partName || part?._enriched?.type);
  set('Placement on Vehicle', placement || part?._enriched?.placement);
  set('Material', part?._enriched?.material);
  set('Color', part?._enriched?.color);
  set('Condition', 'Used');
  set('Universal Fitment', 'No');
  if (aligned.yearRange) set('Year Range', aligned.yearRange);
  if (aligned.generation) set('Platform/Generation', aligned.generation);
  return out;
}

export function resolveMotorsCategoryFromPart(partName, note) {
  const text = `${partName || ''} ${note || ''}`.toLowerCase();
  if (/\b(dashboard|dash panel|instrument panel|dash trim|dash bezel)\b/i.test(text)) {
    return { categoryId: '262191', categoryName: 'Dash Panels' };
  }
  if (/\b(interior|armrest|door trim|verkleidung)\b/i.test(text) && /\bdoor panel\b/i.test(text) && !/\bexterior\b/i.test(text)) {
    return { categoryId: '33696', categoryName: 'Door Panels' };
  }
  if (/\b(center console|armrest console)\b/i.test(text)) {
    return { categoryId: '262189', categoryName: 'Center & Overhead Console Parts' };
  }
  return null;
}

export function shouldRebuildEnglishTitle(title, vehicle) {
  return Boolean(
    detectTitleGenerationMismatch(title, vehicle?.make, vehicle?.model, vehicle?.year),
  );
}

export function localizeEnglishCopyForAu(copy) {
  if (!copy || typeof copy !== 'object') return copy;
  const out = { ...copy };
  if (out.title) out.title = applyAustralianSpelling(out.title);
  if (out.description) out.description = applyAustralianSpelling(out.description);
  if (out.color) out.color = applyAustralianSpelling(out.color);
  if (out.itemSpecifics && typeof out.itemSpecifics === 'object') {
    const specifics = { ...out.itemSpecifics };
    if (specifics.Color) {
      specifics.Colour = specifics.Color;
      delete specifics.Color;
    }
    out.itemSpecifics = specifics;
  }
  return out;
}
