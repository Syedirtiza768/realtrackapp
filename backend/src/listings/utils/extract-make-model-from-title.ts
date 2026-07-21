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
    CHEVORLET: 'Chevrolet', // common GridX/spreadsheet typo
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

/** Tokens that often appear after Make but are not the vehicle model. */
const JUNK_MODEL_TOKENS = new Set([
  's',
  'x',
  'amg',
  'oem',
  'used',
  'genuine',
  'original',
  'front',
  'rear',
  'left',
  'right',
  'upper',
  'lower',
  'inner',
  'outer',
  'new',
  'the',
]);

function cleanModelToken(token: string): string {
  return token.replace(/[^\w.-]/g, '');
}

function isJunkModelToken(token: string): boolean {
  const cleaned = cleanModelToken(token);
  if (!cleaned) return true;
  if (cleaned.length <= 1) return true;
  if (JUNK_MODEL_TOKENS.has(cleaned.toLowerCase())) return true;
  return false;
}

/** Prefer series codes / class names over filler tokens (e.g. skip "s" before "C350"). */
function isStrongModelToken(token: string): boolean {
  const cleaned = cleanModelToken(token);
  if (!cleaned || isJunkModelToken(cleaned)) return false;
  // C350, C-350, E550, X5, F-150, 328i
  if (/^[A-Za-z]{1,3}-?\d{2,3}[A-Za-z]{0,3}$/i.test(cleaned)) return true;
  if (/^\d{1,3}-?[A-Za-z]{1,3}$/i.test(cleaned)) return true; // 3-Series token pieces handled below
  if (/class|series/i.test(cleaned)) return true;
  // Common named models (Camry, Civic, Jetta, …)
  if (/^[A-Za-z][A-Za-z0-9-]{2,}$/i.test(cleaned)) return true;
  return false;
}

function pickModelFromRest(restForModel: string): string | null {
  const tokens = restForModel.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  // "C-Class" / "3-Series" may be split across tokens
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = cleanModelToken(tokens[i]);
    const b = cleanModelToken(tokens[i + 1]);
    const joined = `${a}-${b}`;
    if (/^(?:[A-Za-z]{1,3}-Class|\d-Series)$/i.test(joined)) {
      return joined.slice(0, 100);
    }
    if (/^Class$/i.test(b) && /^[A-Za-z]{1,3}$/i.test(a)) {
      return `${a}-Class`.slice(0, 100);
    }
    if (/^Series$/i.test(b) && /^\d{1,2}$/i.test(a)) {
      return `${a} Series`.slice(0, 100);
    }
  }

  const strong = tokens.find((t) => isStrongModelToken(t));
  if (strong) return cleanModelToken(strong).slice(0, 100);

  const fallback = tokens.find((t) => !isJunkModelToken(t));
  if (fallback) {
    const cleaned = cleanModelToken(fallback);
    return cleaned.length > 0 ? cleaned.slice(0, 100) : null;
  }
  return null;
}

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

  const model = pickModelFromRest(restForModel);
  return { make, model };
}
