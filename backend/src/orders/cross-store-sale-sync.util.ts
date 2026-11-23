/**
 * Pure rules for cross-store sale sync: when a part sells on one eBay listing,
 * every other live eBay listing with the same SKU (any connected store) loses
 * the sold quantity, and is ended once nothing is left.
 */

/** Feature flag (feature_flags.key): kill switch, seeded enabled. */
export const CROSS_STORE_SALE_SYNC_FLAG = 'ebay_cross_store_sale_sync';
export const CROSS_STORE_SALE_SYNC_QUEUE = 'ebay-cross-store-sale-sync';

/**
 * A SKU that matches more live listings than this is treated as shared by
 * unrelated listings (e.g. a "custom listing" label) and is not synced.
 * Real duplicates of one part across 10+ stores and marketplaces stay well
 * below it.
 */
export const MAX_TARGETS_PER_SKU = 40;

/** SKUs shorter than this are too generic to identify one part. */
export const MIN_SKU_LENGTH = 3;

export type SkuRejection = 'no_sku' | 'sku_too_short';

export function normalizeSku(sku: string | null | undefined): string | null {
  const trimmed = (sku ?? '').trim();
  return trimmed ? trimmed : null;
}

export function rejectSku(sku: string | null): SkuRejection | null {
  if (!sku) return 'no_sku';
  if (sku.length < MIN_SKU_LENGTH) return 'sku_too_short';
  return null;
}

export type TargetPlan =
  | { action: 'end'; available: number; remaining: 0 }
  | { action: 'set_quantity'; available: number; remaining: number }
  | { action: 'none'; reason: 'already_zero'; available: number };

/**
 * What to do with another listing of the sold part, from its live available
 * quantity on eBay and the quantity just sold elsewhere.
 * - nothing left to sell there already → leave it alone
 * - sold quantity uses up what it offers → end it
 * - otherwise → lower it by the sold quantity
 */
export function planTarget(available: number, soldQty: number): TargetPlan {
  const avail = Math.max(
    0,
    Math.trunc(Number.isFinite(available) ? available : 0),
  );
  const sold = Math.max(1, Math.trunc(Number.isFinite(soldQty) ? soldQty : 1));
  if (avail <= 0)
    return { action: 'none', reason: 'already_zero', available: avail };
  const remaining = avail - sold;
  if (remaining <= 0) return { action: 'end', available: avail, remaining: 0 };
  return { action: 'set_quantity', available: avail, remaining };
}

/** Live available quantity of a Trading listing from GetItem values. */
export function tradingAvailable(
  quantity: number | null | undefined,
  quantitySold: number | null | undefined,
): number {
  return Math.max(0, (quantity ?? 0) - (quantitySold ?? 0));
}

/** eBay GetItem ListingStatus values that mean the listing can still sell. */
export function isLiveTradingStatus(
  status: string | null | undefined,
): boolean {
  return (status ?? 'Active').toLowerCase() === 'active';
}

/**
 * eBay's answer for an item number this account cannot see (Trading error 17:
 * the listing was deleted, or belongs to another seller). The mirror still
 * holds such rows from old imports; nothing can be done to them, so they are
 * skipped instead of failing (and retrying) the whole order.
 */
export function isListingNotFoundError(
  message: string | null | undefined,
): boolean {
  return /listing has been deleted|you are not the seller/i.test(message ?? '');
}

/* ── Live SKU lookup ──────────────────────────────────────────────
 * The listing mirror (ebay_published_listings) is refreshed on a schedule, so
 * a listing made since the last refresh is missing from it. At sale time every
 * connected store is also asked on eBay for its live listings of the SKU.
 */

/** target_key / target id prefix for a listing found on eBay but not in the mirror. */
export const LIVE_TARGET_PREFIX = 'item:';
/** target_key prefix recording a failed live lookup on one store. */
export const LOOKUP_TARGET_PREFIX = 'lookup:';

export function isLiveOnlyTarget(id: string): boolean {
  return id.startsWith(LIVE_TARGET_PREFIX);
}

/** Off switch for the live lookup: CROSS_STORE_SALE_SYNC_LIVE_LOOKUP=0. */
export function liveLookupEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const v = (env.CROSS_STORE_SALE_SYNC_LIVE_LOOKUP ?? '').trim().toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(v);
}

const TRADING_SITE_MARKETPLACE: Record<string, string> = {
  us: 'EBAY_US',
  ebaymotors: 'EBAY_MOTORS_US',
  uk: 'EBAY_GB',
  germany: 'EBAY_DE',
  australia: 'EBAY_AU',
  canada: 'EBAY_CA',
  france: 'EBAY_FR',
  italy: 'EBAY_IT',
  spain: 'EBAY_ES',
  austria: 'EBAY_AT',
  ireland: 'EBAY_IE',
};

/** Trading Item.Site ("US", "UK", "Germany") → marketplace id, or null. */
export function marketplaceForTradingSite(
  site: string | null | undefined,
): string | null {
  return TRADING_SITE_MARKETPLACE[(site ?? '').trim().toLowerCase()] ?? null;
}

/* ── Same-part check ──────────────────────────────────────────────
 * One SKU label is sometimes reused for different items ("Custom-Listing-ABD"
 * on 20 different parts, "GLB-001" on glove boxes of different cars), while
 * genuine copies of one item are often translated (DE/FR/ES/IT titles). So
 * the check leans on words that survive translation: part numbers, car makes,
 * brand/model words and clothing sizes.
 */

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

/** Words that say nothing about which item it is (any language we list in). */
const GENERIC_WORDS = new Set(
  (
    'the and for with without from used new oem genuine original part parts assembly assy ' +
    'front rear left right upper lower inner outer driver passenger side pair set kit ' +
    'mens men women womens woman man unisex size sizes regular fit condition excellent euc nwt ' +
    'black white blue red green grey gray navy brown beige pink purple yellow orange silver ' +
    'long short sleeve new des der die das und mit fur von pour homme femme avec taille ' +
    'para hombre mujer con talla per uomo donna gebraucht usato usado occasion herren damen'
  ).split(/\s+/),
);

const CAR_MAKES = new Set(
  (
    'acura alfa audi bentley bmw buick cadillac chevrolet chevy chrysler citroen dacia dodge ' +
    'ferrari fiat ford genesis gmc holden honda hummer hyundai infiniti isuzu jaguar jeep kia ' +
    'lamborghini lancia lexus lincoln lotus maserati mazda mclaren mercedes mercury mini ' +
    'mitsubishi nissan opel peugeot pontiac porsche ram renault rover saab saturn scion seat ' +
    'skoda smart subaru suzuki tesla toyota vauxhall volkswagen volvo vw'
  ).split(/\s+/),
);

const SIZE_WORDS = new Set([
  'xxs',
  'xs',
  's',
  'm',
  'l',
  'xl',
  'xxl',
  'xxxl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  'small',
  'medium',
  'large',
]);
const SIZE_ALIASES: Record<string, string> = {
  small: 's',
  medium: 'm',
  large: 'l',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|[a-z]+);/gi, (m, name: string) => {
    if (name.startsWith('#')) return String.fromCharCode(Number(name.slice(1)));
    return HTML_ENTITIES[name.toLowerCase()] ?? m;
  });
}

/** All title words (single letters kept, for sizes), lowercased, accents removed. */
function rawTokens(title: string | null | undefined): string[] {
  return decodeEntities(title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/'s\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * 7+ chars mixing letters and digits (8D0858005Q, T2H1154), or 6+ digits
 * (25941796). Shorter codes are usually models (CL550, 320i), not parts.
 */
function isPartNumber(t: string): boolean {
  return (
    (t.length >= 7 && /\d/.test(t) && /[a-z]/.test(t)) ||
    (t.length >= 6 && /^\d+$/.test(t))
  );
}

function isYearLike(t: string): boolean {
  return /^(19|20)\d\d$/.test(t);
}

/**
 * Words that identify the item: not generic, not a model year, 3+ chars — or
 * short model codes with a digit (a6, x5, 320i).
 */
function distinctiveWords(tokens: string[]): Set<string> {
  return new Set(
    tokens.filter(
      (t) =>
        !GENERIC_WORDS.has(t) &&
        !isYearLike(t) &&
        !SIZE_WORDS.has(t) &&
        (t.length >= 3 || (t.length === 2 && /\d/.test(t) && /[a-z]/.test(t))),
    ),
  );
}

const SIZE_LABELS = new Set([
  'size',
  'taille',
  'talla',
  'taglia',
  'grosse',
  'gr',
  'tamano',
]);

/**
 * Clothing sizes in a title. A single letter (S/M/L) only counts when written
 * as a capital, after a size label, or as the last word.
 */
function sizes(title: string | null | undefined): Set<string> {
  const words = decodeEntities(title ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const out = new Set<string>();
  words.forEach((w, i) => {
    const t = w.toLowerCase();
    if (!SIZE_WORDS.has(t)) return;
    if (
      t.length === 1 &&
      w !== w.toUpperCase() &&
      i !== words.length - 1 &&
      !SIZE_LABELS.has((words[i - 1] ?? '').toLowerCase())
    ) {
      return;
    }
    out.add(SIZE_ALIASES[t] ?? t);
  });
  return out;
}

function intersects<T>(a: Set<T>, b: Set<T>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

export type SamePartVerdict =
  | 'part_number'
  | 'similar_title'
  | 'shared_words'
  | 'no_title'
  | 'different_part_number'
  | 'different_make'
  | 'different_size'
  | 'unrelated_title';

/**
 * Whether two listing titles describe the same item. Positive verdicts:
 * part_number, similar_title, shared_words, no_title.
 */
export function samePartVerdict(
  soldTitle: string | null | undefined,
  otherTitle: string | null | undefined,
): SamePartVerdict {
  const a = rawTokens(soldTitle);
  const b = rawTokens(otherTitle);
  if (!a.length || !b.length) return 'no_title';

  const pnA = a.filter(isPartNumber);
  const pnB = b.filter(isPartNumber);
  // Prefix match too: mirror titles are cut at 80 chars ("9556243...").
  const samePn = (x: string, y: string) => x.startsWith(y) || y.startsWith(x);
  if (pnA.some((x) => pnB.some((y) => samePn(x, y)))) return 'part_number';
  if (pnA.length && pnB.length) return 'different_part_number';

  const makesA = new Set(a.filter((t) => CAR_MAKES.has(t)));
  const makesB = new Set(b.filter((t) => CAR_MAKES.has(t)));
  if (makesA.size && makesB.size && !intersects(makesA, makesB))
    return 'different_make';

  const sizeA = sizes(soldTitle);
  const sizeB = sizes(otherTitle);
  if (sizeA.size && sizeB.size && !intersects(sizeA, sizeB))
    return 'different_size';

  const setA = new Set(a.filter((t) => t.length >= 2));
  const setB = new Set(b.filter((t) => t.length >= 2));
  let shared = 0;
  for (const t of setA) if (setB.has(t)) shared++;
  const union = setA.size + setB.size - shared;
  if (union > 0 && shared / union >= 0.5) return 'similar_title';

  const wordsA = distinctiveWords(a);
  const wordsB = distinctiveWords(b);
  let sharedWords = 0;
  for (const t of wordsA) if (wordsB.has(t)) sharedWords++;
  // The same clothing size on both sides counts as one more shared word.
  if (intersects(sizeA, sizeB)) sharedWords++;
  if (sharedWords >= 2) return 'shared_words';
  return 'unrelated_title';
}

export function isSamePart(verdict: SamePartVerdict): boolean {
  return ['part_number', 'similar_title', 'shared_words', 'no_title'].includes(
    verdict,
  );
}
