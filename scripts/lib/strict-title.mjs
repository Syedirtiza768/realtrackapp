/**
 * Strict eBay title enforcement — guarantees the structure from
 * eBay_Listing_Title_Guidelines_and_Samples.docx:
 *
 * [Year Range] [Make] [Model/Generation] [Position] [Part Name] [OEM Part Number] OEM Used
 *
 * Max 80 characters.
 */

export const STRICT_TITLE_PATTERN = /^(\d{4}(-\d{4})?)\s+[A-Za-z].*\s+OEM Used$/;

export const PART_NUMBER_PATTERN = /\b(?:[A-NPR-Z0-9]{1,3}\s+[A-NPR-Z0-9]{1,4}\s+[A-NPR-Z0-9]{1,4}(?:\s+[A-Z])?|[A-NPR-Z0-9]{5,16})\b/;

export const EBAY_TITLE_MAX_LENGTH = 80;

const BAD_PART_TYPES = /\b(vag|books|other|merchandise|brochures|vintage|animation|coins?|slot\s*machines?|cars,?\s*trucks|model\s*cars|motorcycles|antique|collectibles|toys|hobbies|parts)\b/i;

const META_PATTERNS = [
  /\s*D\s*>>\s*[-–].*$/i,
  /\s*D\s*[-–]\s*\d.*$/i,
  /\s*also\s*use:?.*$/i,
  /\s*only\s+to\s+be\s+used\s+for:?.*$/i,
  /\s*use\s+if\s+required:?.*$/i,
  /\s*for\s+vehicles\s+with.*$/i,
  /\s*with\s+.*$/i,
  /\s*PR:.*$/i,
  /\s*\d+\s*PR:.*$/i,
  /\s*left\s+lhd\s+right\s+lhd.*$/i,
  /\s*lhd\s*$/i,
  /\s*>>\s*.*$/i,
  /\s*Also\s+includes\s+illustration.*$/i,
  /\s*Fitting\s+set.*$/i,
  /\s*Foam\s+underlay.*$/i,
  /\s*transparent\s*$/i,
];

export function isBadPartType(type) {
  if (!type) return true;
  const t = String(type).trim();
  if (t.length < 3) return true;
  return BAD_PART_TYPES.test(t);
}

export function cleanPartDescription(desc) {
  if (!desc) return '';
  let d = desc.trim();
  for (const re of META_PATTERNS) {
    d = d.replace(re, '');
  }
  // Strip parenthetical abbreviations e.g. "Engine Control Unit (Ecu)" → "Engine Control Unit"
  d = d.replace(/\s*\([^)]*\)\s*/g, ' ');
  d = d.replace(/\s+/g, ' ').trim();
  // Sentence-case each word
  d = d.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return d;
}

export function extractPosition(title) {
  if (!title) return '';
  const t = String(title).toLowerCase();
  const left = /\bleft\b/.test(t);
  const right = /\bright\b/.test(t);
  const front = /\bfront\b/.test(t) && !/\bfront\s+left\b/.test(t) && !/\bfront\s+right\b/.test(t);
  const rear = /\brear\b/.test(t) && !/\brear\s+left\b/.test(t) && !/\brear\s+right\b/.test(t);
  const upper = /\bupper\b/.test(t);
  const lower = /\blower\b/.test(t);
  const parts = [];
  if (front) parts.push('Front');
  else if (rear) parts.push('Rear');
  if (upper) parts.push('Upper');
  else if (lower) parts.push('Lower');
  if (left) parts.push('Left');
  else if (right) parts.push('Right');
  return parts.join(' ');
}

export function normalizePartNumber(pn) {
  return String(pn || '').replace(/\s+/g, '').toLowerCase();
}

export function normalizeYearRange(yearRange, fallbackMakeModel) {
  const s = String(yearRange || '').trim();
  const m = s.match(/^(\d{4})-(\d{4})$/);
  if (m) {
    const start = parseInt(m[1], 10);
    const end = parseInt(m[2], 10);
    if (start < 1980 || end > 2035 || start > end) return '';
    return `${start}-${end}`;
  }
  const single = s.match(/^(\d{4})$/);
  if (single) return single[1];
  return '';
}

export function removeDuplicatePlacement(title) {
  return title
    .replace(/\b(Left|Right) (Left|Right)\b/gi, '$1')
    .replace(/\b(Front|Rear) (Front|Rear)\b/gi, '$1')
    .replace(/\b(Upper|Lower) (Upper|Lower)\b/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function removeDuplicatePartPhrases(title) {
  let out = String(title || '').replace(/\s+/g, ' ').trim();
  let previous = '';
  while (out !== previous) {
    previous = out;
    out = out
      .replace(/\b([A-Za-z][A-Za-z0-9-]*)\s+\1\b/gi, '$1')
      .replace(
        /\b([A-Za-z][A-Za-z0-9-]*\s+[A-Za-z][A-Za-z0-9-]*)\s+\1\b/gi,
        '$1',
      )
      .replace(/\s+/g, ' ')
      .trim();
  }
  return out;
}

export function hasDuplicatePartPhrase(title) {
  return (
    removeDuplicatePartPhrases(title) !==
    String(title || '').replace(/\s+/g, ' ').trim()
  );
}

export function fitsEbayTitleStructure(title) {
  if (!title || title.length > EBAY_TITLE_MAX_LENGTH) return false;
  if (!STRICT_TITLE_PATTERN.test(title)) return false;
  if (!PART_NUMBER_PATTERN.test(title)) return false;
  if (BAD_PART_TYPES.test(title)) return false;
  // Reject parenthetical text — guidelines forbid unnecessary punctuation
  if (/\([^)]*\)/.test(title)) return false;
  // Reject spaced part numbers — guidelines show compact PNs (e.g. 4G9827279)
  // Catches VAG-style "3W0 947 141" and "4W0 857 789 A" (alphanumeric groups separated by spaces)
  if (/\b[A-Z0-9]{3}\s+[A-Z0-9]{3}\s+[A-Z0-9]{2,3}(?:\s+[A-Z])?\b/i.test(title)) return false;
  // Reject dashed part numbers — guidelines show compact PNs (e.g. 8A5Z5423552A not 8A5Z-5423552-A)
  // Must have 2+ chars before dash AND at least one letter before dash AND 4+ digits after dash
  // This excludes: year ranges (all digits), part name dashes like "D-Pillar", "Assy - Brake"
  if (/\b[A-Z0-9]{2,}[A-Z][A-Z0-9]*-\d{4,}/i.test(title)) return false;
  // Reject platform codes with slashes as model (e.g. "B7 / A9B" is not a real model name)
  // Only reject if slash is between short alphanumeric tokens early in the title (before part name)
  // Allow slashes in part names like "A/C Compressor", "P/S Reservoir"
  const slashMatch = title.match(/^\d{4}(?:-\d{4})?\s+\S+\s+([A-Z0-9]{1,6}\s*\/\s*[A-Z0-9]{1,6})\b/);
  if (slashMatch) return false;
  // Reject concatenated model codes (e.g. "MKS MKT" — two standalone models, not model+trim)
  // Pattern: after the year range + make, two consecutive short uppercase alphanumeric tokens
  // that are NOT a known model+trim/generation combo (e.g. "Continental GT", "A6 C7" are valid)
  // No i flag — [A-Z0-9] only matches uppercase so "Engine", "Front" etc. are excluded
  const concatMatch = title.match(/^\d{4}(?:-\d{4})?\s+\S+\s+([A-Z0-9]{2,6})\s+([A-Z0-9]{2,6})\s/);
  if (concatMatch && concatMatch[1].toUpperCase() !== concatMatch[2].toUpperCase() &&
      !/^(GT|GTC|AMG|SRT|SVR|C\d|W\d|X\d|A\d)$/i.test(concatMatch[2])) {
    return false;
  }
  if (hasDuplicatePartPhrase(title)) return false;
  return true;
}

export function enforceStrictTitle({
  title,
  yearRange,
  make,
  model,
  partName,
  partNumber,
  placement = '',
}) {
  const cleanMake = String(make || 'OEM').replace(/\s+/g, ' ').trim();
  // Clean model: strip parenthetical text, take first model if multiple concatenated
  let cleanModel = String(model || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // If multiple model words look concatenated (e.g. "A6 S6", "MKS MKT"), keep only the first
  const modelWords = cleanModel.split(' ');
  if (modelWords.length >= 2 && /^[\w-]{2,8}$/.test(modelWords[0]) && /^[\w-]{2,8}$/.test(modelWords[1]) &&
      modelWords[0].toUpperCase() !== modelWords[1].toUpperCase()) {
    // Heuristic: if both look like model codes (alphanumeric, 2-8 chars), keep first only
    // but if it's a known multi-word model like "Continental GT", keep both
    if (!/^(GT|GTC|AMG|SRT|SVR)$/i.test(modelWords[1])) {
      cleanModel = modelWords[0];
    }
  }
  let cleanPartName = cleanPartDescription(partName);
  if (!cleanPartName) cleanPartName = 'Part';
  // Compact part number — remove spaces/dashes/dots to match guideline format (e.g. 4G9827279)
  const cleanPn = String(partNumber || '').replace(/[\s\-\.]/g, '').trim();
  const cleanYear = normalizeYearRange(yearRange) || '';

  const segments = [cleanYear, cleanMake, cleanModel, placement, cleanPartName, cleanPn, 'OEM', 'Used'].filter(Boolean);
  let result = segments.join(' ').replace(/\s+/g, ' ').trim();
  result = removeDuplicatePlacement(result);
  result = removeDuplicatePartPhrases(result);

  // Ensure suffix is exactly "OEM Used" and total length ≤ 80
  if (!result.endsWith('OEM Used')) {
    result = result.replace(/\s+OEM\s*$/i, '').trim();
    result += ' OEM Used';
  }
  result = result.replace(/\s+OEM\s+Used\s*$/i, ' OEM Used').trim();

  if (result.length > 80) {
    const suffix = 'OEM Used';
    const core = result.replace(/\s*OEM Used$/, '').trim();
    const maxCore = 80 - suffix.length - 1; // -1 for the space before suffix
    // Truncate from the end of the core, preserving year+make+model+position at the start
    result = core.slice(0, maxCore).trim() + ' ' + suffix;
  }

  return result;
}

export function stripBadCategoryWords(text) {
  if (!text) return '';
  return String(text)
    .replace(/\b(vag|books|other|merchandise|brochures|vintage|animation|coins?|slot\s*machines?|cars,?\s*trucks|model\s*cars|motorcycles|antique|collectibles|toys|hobbies)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default {
  fitsEbayTitleStructure,
  enforceStrictTitle,
  isBadPartType,
  cleanPartDescription,
  extractPosition,
  normalizePartNumber,
  normalizeYearRange,
  removeDuplicatePlacement,
  removeDuplicatePartPhrases,
  hasDuplicatePartPhrase,
  stripBadCategoryWords,
};
