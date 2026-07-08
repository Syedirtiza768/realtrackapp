/**
 * Derive vehicle make/model from eBay Motors–style titles:
 * leading year or year range, then make (possibly multi-word), then model token.
 * Mirrors the intent of `backend/extract_make_model.sql`.
 */

function titleCaseWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function normalizeMakeToken(raw: string): string {
  const t = titleCaseWord(raw.trim());
  const upper = t.toUpperCase();
  const map: Record<string, string> = {
    BMW: 'BMW',
    GMC: 'GMC',
    DS: 'DS',
    MINI: 'MINI',
    SEAT: 'SEAT',
    VW: 'Volkswagen',
    VOLKSWAGEN: 'Volkswagen',
    CHEVY: 'Chevrolet',
    MERCEDES: 'Mercedes-Benz',
  };
  return map[upper] ?? t;
}

const YEAR_PREFIX = /^\d{2,4}(?:-\d{2,4})?\s+/i;

/** Multi-word makes: pattern on substring after year prefix → canonical make */
const MULTI_WORD_MAKES: [RegExp, string][] = [
  [/^Aston\s+Martin\b/i, 'Aston Martin'],
  [/^Alfa\s+Romeo\b/i, 'Alfa Romeo'],
  [/^Land\s+Rover\b/i, 'Land Rover'],
  [/^Range\s+Rover\b/i, 'Range Rover'],
  [/^Rolls[\s-]Royce\b/i, 'Rolls-Royce'],
  [/^Mercedes[\s-]Benz\b/i, 'Mercedes-Benz'],
  [/^Mini\s+Cooper\b/i, 'MINI'],
  [/^BMW\s+MINI\b/i, 'MINI'],
];

export function extractMakeModelFromTitle(title: string | null | undefined): {
  make: string | null;
  model: string | null;
} {
  if (!title?.trim()) return { make: null, model: null };
  const t = title.trim();

  let make: string | null = null;
  let restForModel = '';

  if (/^#\s*MINI\s+Cooper\b/i.test(t)) {
    make = 'MINI';
    restForModel = t.replace(/^#\s*MINI\s+Cooper\s*/i, '').trim();
  } else if (/^#\s*/i.test(t)) {
    const hash = t.match(/^#\s*(\w+)(?:\s+Cooper)?\s*(.*)/i);
    const first = hash?.[1] ?? '';
    restForModel = (hash?.[2] ?? '').trim();
    make = normalizeMakeToken(first);
  } else if (YEAR_PREFIX.test(t)) {
    const afterYear = t.replace(YEAR_PREFIX, '');
    let matched = false;
    for (const [re, canonical] of MULTI_WORD_MAKES) {
      const m = afterYear.match(re);
      if (m) {
        make = canonical;
        restForModel = afterYear.slice(m[0].length).trim();
        matched = true;
        break;
      }
    }
    if (!matched) {
      const one = afterYear.match(/^(\w+)/);
      const rawMake = one?.[1] ?? '';
      if (rawMake) {
        make = normalizeMakeToken(rawMake);
        restForModel = afterYear.slice(one![0].length).trim();
      }
    }
  }

  if (!make) return { make: null, model: null };

  const modelToken = restForModel.split(/\s+/)[0] ?? '';
  const cleaned = modelToken.replace(/[^\w.-]/g, '');
  const model = cleaned.length > 0 ? cleaned.slice(0, 100) : null;

  return { make, model };
}
