#!/usr/bin/env node
/**
 * seo-content.mjs — deterministic SEO title + description composer for listings
 * whose vehicle fitment has been validated.
 *
 * Title (<= 80 chars), modelled on the store's house style:
 *   "Febest 1924-E70FUPL Control Arm Front Upper Left for BMW X5 X6 E70 E71"
 *   Brand MPN PartType [Position] for Make Model Model [CHASSIS CODES]
 * The make appears once with all of its models. Position is used only when it is
 * the same for every application (a part that is "Rear" on one car and "Front" on
 * another must not be titled "Rear"). Only real chassis codes (E70, GMT900, LX)
 * are added — words such as "Classic" are not.
 *
 * Description: structured HTML (the publish path accepts HTML, max 4000 chars)
 * built ONLY from facts already in the data: identifiers, position, series and the
 * validated applications. Nothing is invented — no specifications, warranty or
 * service promises. For part types routinely sold remanufactured it does not assert
 * "New" (see docs/context/KNOWN_ISSUES.md R24).
 *
 * Pure functions; no I/O. Driven by seo-content-apply.mjs.
 */

export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 4000;

/**
 * Part types routinely sold remanufactured. Mirrors price-web-research.mjs: the
 * catalog lists every row as New, so for these we neither claim nor imply it.
 */
export const REMAN_PRONE_PATTERN = /caliper|starter|alternator|axle|steering (?:rack|gear)|\brack\b|compressor|turbo|master cylinder|booster|transmission/i;

const SHORT_MAKE = { Chevrolet: 'Chevy', 'Mercedes-Benz': 'Mercedes', Volkswagen: 'VW' };
const BRAND_DISPLAY = { NAPA: 'NAPA', MEVOTECH: 'Mevotech', SKF: 'SKF', DELPHI: 'Delphi', FEBEST: 'Febest' };
const ACRONYMS = { Cv: 'CV', Abs: 'ABS', Ac: 'AC', Hvac: 'HVAC', Egr: 'EGR', Pcv: 'PCV', Tpms: 'TPMS', Oe: 'OE', Oem: 'OEM', Led: 'LED', Rf: 'RF', Lh: 'LH', Rh: 'RH' };

export function displayBrand(brand) {
  const key = String(brand || '').trim().toUpperCase();
  return BRAND_DISPLAY[key] || String(brand || '').trim();
}

export function displayPart(partType) {
  const text = String(partType || 'Automotive Part').trim().toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return text.replace(/\b[A-Za-z]{2,4}\b/g, (word) => ACRONYMS[word] || word);
}

export function isRemanProne(partType) {
  return REMAN_PRONE_PATTERN.test(String(partType || ''));
}

export function normalizePosition(raw) {
  const text = String(raw || '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Title-safe text: letters, digits, spaces and & + . / - only. */
function clean(text) {
  return String(text || '').replace(/[^A-Za-z0-9\s&+./-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeHtml(text) {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const shortMake = (make) => SHORT_MAKE[make] || make;
/** A chassis code as given: 2-4 capital letters (LX, JK) or up to 7 capitals/digits containing a digit (E70, GMT900). "Classic" is a word, not a code. */
const CHASSIS_CODE = /^(?:[A-Z]{2,4}|(?=[A-Z0-9]*\d)[A-Z][A-Z0-9]{1,6})$/;

/** Fitment records as a tidy list: trimmed, deduplicated, invalid years dropped. */
export function tidyFitments(fits) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(fits) ? fits : []) {
    const make = String(raw?.make || '').trim();
    const model = String(raw?.model || '').trim();
    const yearStart = Number(raw?.yearStart);
    const yearEnd = Number(raw?.yearEnd) || yearStart;
    if (!make || !model || !Number.isFinite(yearStart)) continue;
    const generation = String(raw?.generation || '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    const position = normalizePosition(raw?.position);
    const key = [make, model, yearStart, yearEnd, generation, position].join('|').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ make, model, yearStart, yearEnd, generation, position });
  }
  return out;
}

/** Group by make (first-appearance order), each with its distinct models. */
export function groupByMake(fits) {
  const groups = [];
  for (const f of fits) {
    let group = groups.find((g) => g.make.toLowerCase() === f.make.toLowerCase());
    if (!group) { group = { make: f.make, models: [] }; groups.push(group); }
    if (!group.models.some((m) => m.toLowerCase() === f.model.toLowerCase())) group.models.push(f.model);
  }
  return groups;
}

export function chassisCodes(fits) {
  const codes = [];
  for (const f of fits) {
    const code = f.generation.trim();
    if (CHASSIS_CODE.test(code) && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

/** The position to show in the title: only if every application agrees on one. */
export function titlePosition(fits) {
  const positions = [...new Set(fits.map((f) => f.position).filter(Boolean))];
  const anyBlank = fits.some((f) => !f.position);
  return positions.length === 1 && !anyBlank ? positions[0] : '';
}

export function buildSeoTitle(row, rawFits) {
  const fits = tidyFitments(rawFits);
  const brand = displayBrand(row.brand);
  const part = displayPart(row.partType);
  const position = titlePosition(fits);
  const stem = (withPosition) => clean([brand, row.mpn, part, withPosition ? position : ''].filter(Boolean).join(' '));
  const groups = groupByMake(fits);
  const codes = chassisCodes(fits);

  if (!groups.length) return stem(true).slice(0, TITLE_MAX).trim();

  const maxModels = Math.max(...groups.map((g) => g.models.length));
  for (const withPosition of [true, false]) {
    const base = stem(withPosition);
    for (let g = groups.length; g >= 1; g -= 1) {
      for (let m = maxModels; m >= 1; m -= 1) {
        for (const withCodes of [true, false]) {
          const vehicles = groups.slice(0, g)
            .map((group) => [shortMake(group.make), ...group.models.slice(0, m)].join(' '))
            .join(' ');
          const suffix = withCodes && codes.length ? ` ${codes.slice(0, 4).join(' ')}` : '';
          const title = clean(`${base} for ${vehicles}${suffix}`);
          if (title.length <= TITLE_MAX) return title;
        }
      }
    }
  }
  // Even one vehicle does not fit: keep whole words up to the limit, never a dangling "for".
  const fallback = clean(`${stem(false)} for ${shortMake(groups[0].make)} ${groups[0].models[0]}`);
  let out = '';
  for (const word of fallback.split(' ')) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > TITLE_MAX) break;
    out = next;
  }
  return out.replace(/\s+for$/i, '').trim();
}

function yearLabel(f) {
  return f.yearStart === f.yearEnd ? String(f.yearStart) : `${f.yearStart}-${f.yearEnd}`;
}

/**
 * Merge overlapping or adjacent year ranges that share a generation and position,
 * so "2012; 2010-2011" reads "2010-2012" and "1984-2004; 1984-1994" reads "1984-2004".
 */
export function mergeYearRanges(entries) {
  const buckets = new Map();
  for (const f of entries) {
    const key = `${f.generation}|${f.position}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ ...f });
  }
  const merged = [];
  for (const list of buckets.values()) {
    list.sort((a, b) => a.yearStart - b.yearStart || a.yearEnd - b.yearEnd);
    let current = list[0];
    for (const next of list.slice(1)) {
      if (next.yearStart <= current.yearEnd + 1) current.yearEnd = Math.max(current.yearEnd, next.yearEnd);
      else { merged.push(current); current = next; }
    }
    merged.push(current);
  }
  return merged.sort((a, b) => a.yearStart - b.yearStart || a.yearEnd - b.yearEnd);
}

/** "Model 1999-2006; 2007 (Classic)" per make+model, with merged, sorted year ranges. */
export function vehicleLines(fits, showPosition) {
  const lines = [];
  for (const group of groupByMake(fits)) {
    for (const model of group.models) {
      const entries = fits.filter((x) => x.make.toLowerCase() === group.make.toLowerCase() && x.model.toLowerCase() === model.toLowerCase());
      const parts = mergeYearRanges(entries)
        .map((f) => `${yearLabel(f)}${f.generation ? ` (${f.generation})` : ''}${showPosition && f.position ? ` - ${f.position}` : ''}`);
      lines.push({ make: group.make, model, text: [...new Set(parts)].join('; ') });
    }
  }
  return lines;
}

function splitNumbers(text) {
  return String(text || '').split(/[;,|]/).map((s) => s.trim()).filter(Boolean);
}

export function buildSeoDescription(row, rawFits) {
  const fits = tidyFitments(rawFits);
  const brand = displayBrand(row.brand);
  const part = displayPart(row.partType);
  const positions = [...new Set(fits.map((f) => f.position).filter(Boolean))];
  const positionVaries = positions.length > 1 || (positions.length === 1 && fits.some((f) => !f.position));
  const singlePosition = positions.length === 1 && !positionVaries ? positions[0] : '';
  const reman = isRemanProne(row.partType);
  const makes = groupByMake(fits).map((g) => g.make);

  const intro = [
    `<p><b>${escapeHtml(`${brand} ${row.mpn} ${part}${singlePosition ? ` - ${singlePosition}` : ''}`)}</b>`,
    makes.length ? ` for ${escapeHtml(makes.join(', '))} vehicles` : '',
    reman ? '.</p>' : ' - new replacement part.</p>',
  ].join('');

  const lines = vehicleLines(fits, positionVaries);
  let vehicleItems = lines.map((l) => `<li><b>${escapeHtml(l.make)}</b> ${escapeHtml(l.model)}: ${escapeHtml(l.text)}</li>`);

  const details = [
    ['Brand', brand],
    ['Manufacturer Part Number', row.mpn],
    ['Part type', part],
    ['Placement on vehicle', singlePosition || (positionVaries ? 'Varies by application - see the vehicle list' : '')],
    ['Series', row.series && !/^none$/i.test(row.series) ? row.series : ''],
    ['UPC', row.upc],
    ['EAN', row.ean],
    ['Interchange / OE numbers', splitNumbers(row.oem).join(', ')],
    ['Condition', reman ? '' : 'New'],
  ].filter(([, v]) => String(v || '').trim());
  const detailHtml = `<p><b>Part details</b></p><ul>${details.map(([k, v]) => `<li>${escapeHtml(k)}: ${escapeHtml(v)}</li>`).join('')}</ul>`;
  const closing = "<p>Compare the part number and confirm your vehicle's year, make, model, trim and the position on the vehicle before ordering. Professional installation is recommended.</p>";

  const assemble = (items) => [
    intro,
    items.length ? `<p><b>Compatible vehicles</b></p><ul>${items.join('')}</ul>` : '',
    detailHtml,
    closing,
  ].join('');

  let html = assemble(vehicleItems);
  if (html.length > DESCRIPTION_MAX) {
    // Very long application lists: keep whole entries and say the rest is in the item's compatibility table.
    const note = '<li>Additional applications are listed in the item compatibility table.</li>';
    let keep = vehicleItems.length;
    while (keep > 1) {
      keep -= 1;
      vehicleItems = lines.slice(0, keep).map((l) => `<li><b>${escapeHtml(l.make)}</b> ${escapeHtml(l.model)}: ${escapeHtml(l.text)}</li>`);
      html = assemble([...vehicleItems, note]);
      if (html.length <= DESCRIPTION_MAX) break;
    }
  }
  return html;
}
