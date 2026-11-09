/**
 * Counterfeit / VeRO risk rules for Fashion listings (text side).
 *
 * Pure functions only: no DB, no network. The batch pipeline feeds a listing
 * snapshot in and gets issues, safe auto-fixes and a decision back.
 *
 * "Fix" means making a listing accurate, never disguising one that may be
 * counterfeit: replica-type wording in source data blocks the listing; phrases
 * that compare to another brand go to a human; only filler words and extra
 * brand names (when the real brand is known) are removed automatically.
 */

export type ComplianceDecision =
  | 'PASS'
  | 'AUTO_FIXED'
  | 'NEEDS_REVIEW'
  | 'BLOCKED';

/** info/warn add risk only; review sends to a human; block stops publishing. */
export type IssueSeverity = 'info' | 'warn' | 'review' | 'block';

export type IssueField =
  | 'title'
  | 'description'
  | 'brand'
  | 'price'
  | 'images'
  | 'category';

export interface ComplianceIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  field?: IssueField;
  evidence?: string;
  imageIndex?: number;
  /** True when a rule-based fix already resolved this issue. */
  autoFixed?: boolean;
  /** Issue came from the vision model rather than text rules. */
  source?: 'text' | 'vision' | 'image';
}

export interface ComplianceFix {
  field: 'title' | 'brand' | 'images';
  before: unknown;
  after: unknown;
  reason: string;
}

export interface ProtectedBrand {
  name: string;
  aliases?: string[];
  /** Minimum plausible price (USD) for a genuine item of this brand. */
  priceFloor?: number;
}

export interface AuthenticityGuaranteeRule {
  label: string;
  categoryIds?: string[];
  /** Matched case-insensitively against the eBay category name. */
  categoryKeywords?: string[];
  minPrice: number;
}

export interface FashionComplianceConfig {
  /** Replica-type wording. In a title or brand field it blocks publishing. */
  blockTerms: string[];
  /** Phrases removed before blockTerms matching ("fake fur" is a material). */
  blockTermExceptions: string[];
  /** Comparisons to another brand ("inspired by", "dupe"): human review. */
  reviewPhrases: string[];
  /** Safe filler removed from titles automatically. */
  fillerTerms: string[];
  /** Brands with VeRO / counterfeit exposure; floors drive price-anomaly blocks. */
  protectedBrands: ProtectedBrand[];
  /** Other brands used to detect keyword spam and brand mismatches. */
  knownBrands: string[];
  /** Brand names that are also everyday words; never auto-removed or matched in prose. */
  ambiguousBrands: string[];
  authenticityGuarantee: AuthenticityGuaranteeRule[];
}

export interface ComplianceListing {
  title: string;
  description: string | null;
  /** catalog_products.brand */
  brand: string | null;
  /** Brand item specific (verticalAttributes.brand or source item specifics). */
  brandSpecific: string | null;
  price: number | null;
  categoryId: string | null;
  categoryName: string | null;
}

export interface TextCheckResult {
  issues: ComplianceIssue[];
  fixes: ComplianceFix[];
  /** Listing after safe auto-fixes (unchanged when there were none). */
  fixed: ComplianceListing;
  /** Canonical brand the listing claims, if any. */
  declaredBrand: string | null;
  /** True when the listing falls under eBay's Authenticity Guarantee. */
  authenticityGuarantee: string | null;
}

export const EBAY_TITLE_MAX = 80;

export const DEFAULT_FASHION_COMPLIANCE_CONFIG: FashionComplianceConfig = {
  blockTerms: [
    'replica',
    'replicas',
    'fake',
    'counterfeit',
    'knockoff',
    'knock off',
    'knock-off',
    'not authentic',
    'unauthentic',
    'non authentic',
    'inauthentic',
    'imitation',
    'bootleg',
    'aaa quality',
    'aaa grade',
    'aaa+',
    '1:1',
    'mirror quality',
    'mirror grade',
    'mirror copy',
    'super copy',
    'high copy',
    'ua quality',
    'reps',
  ],
  blockTermExceptions: [
    'fake fur',
    'fake leather',
    'fake suede',
    'fake pocket',
    'fake pockets',
    'faux',
    'imitation leather',
    'imitation pearl',
    'imitation pearls',
  ],
  reviewPhrases: [
    'inspired by',
    'in the style of',
    'style of',
    'dupe',
    'look alike',
    'lookalike',
    'look-alike',
    'similar to',
    'compare to',
    'alternative to',
    'unbranded',
    'designer inspired',
  ],
  fillerTerms: [
    'l@@k',
    'look!',
    'wow',
    'must see',
    'must have',
    'htf',
    'hard to find',
    'rare!',
    'hot!',
    'no reserve',
  ],
  protectedBrands: [
    { name: 'Louis Vuitton', aliases: ['lv', 'louis vuitton'], priceFloor: 150 },
    { name: 'Chanel', priceFloor: 200 },
    { name: 'Hermès', aliases: ['hermes', 'hermès'], priceFloor: 300 },
    { name: 'Gucci', priceFloor: 80 },
    { name: 'Prada', priceFloor: 80 },
    { name: 'Dior', aliases: ['christian dior', 'dior'], priceFloor: 100 },
    { name: 'Fendi', priceFloor: 80 },
    { name: 'Balenciaga', priceFloor: 80 },
    { name: 'Saint Laurent', aliases: ['ysl', 'yves saint laurent', 'saint laurent'], priceFloor: 80 },
    { name: 'Bottega Veneta', priceFloor: 100 },
    { name: 'Celine', aliases: ['celine', 'céline'], priceFloor: 100 },
    { name: 'Givenchy', priceFloor: 60 },
    { name: 'Valentino', priceFloor: 60 },
    { name: 'Versace', priceFloor: 40 },
    { name: 'Burberry', priceFloor: 40 },
    { name: 'Moncler', priceFloor: 80 },
    { name: 'Canada Goose', priceFloor: 80 },
    { name: 'Christian Louboutin', aliases: ['louboutin', 'christian louboutin'], priceFloor: 80 },
    { name: 'Jimmy Choo', priceFloor: 40 },
    { name: 'Golden Goose', priceFloor: 60 },
    { name: 'Off-White', aliases: ['off white', 'off-white'], priceFloor: 40 },
    { name: 'Stone Island', priceFloor: 40 },
    { name: 'A Bathing Ape', aliases: ['bape', 'a bathing ape'], priceFloor: 40 },
    { name: 'Supreme', priceFloor: 25 },
    { name: 'Rolex', priceFloor: 1500 },
    { name: 'Omega', priceFloor: 500 },
    { name: 'Cartier', priceFloor: 200 },
    { name: 'Tiffany & Co.', aliases: ['tiffany & co', 'tiffany and co', 'tiffany co'], priceFloor: 40 },
    { name: 'Michael Kors', aliases: ['michael michael kors', 'michael kors', 'mk'] },
    { name: 'Coach' },
    { name: 'Kate Spade', aliases: ['kate spade new york', 'kate spade'] },
    { name: 'Ralph Lauren', aliases: ['polo ralph lauren', 'lauren ralph lauren', 'ralph lauren'] },
    { name: 'Nike' },
    { name: 'Adidas' },
    { name: 'The North Face', aliases: ['north face', 'the north face', 'tnf'] },
    { name: 'Lacoste' },
    { name: 'Hugo Boss', aliases: ['hugo boss', 'boss hugo boss', 'boss'] },
  ],
  knownBrands: [
    'Tommy Hilfiger',
    'Calvin Klein',
    "Levi's",
    'Patagonia',
    'Columbia',
    'Under Armour',
    'Puma',
    'Reebok',
    'New Balance',
    'Carhartt',
    'Lululemon',
    'J.Crew',
    'Banana Republic',
    'L.L.Bean',
    'Armani',
    'Dolce & Gabbana',
    'Diesel',
    'Zara',
    'Uniqlo',
    'H&M',
    'Converse',
    'Vans',
    'Champion',
    'Guess',
    'Gap',
  ],
  ambiguousBrands: [
    'Coach',
    'Champion',
    'Guess',
    'Gap',
    'Vans',
    'Converse',
    'Columbia',
    'Diesel',
    'Supreme',
    'Omega',
    'boss',
    'mk',
    'lv',
  ],
  authenticityGuarantee: [
    {
      label: 'Sneakers',
      categoryIds: ['15709', '95672', '155202', '57974'],
      categoryKeywords: ['athletic shoes', 'sneakers'],
      minPrice: 100,
    },
    {
      label: 'Handbags',
      categoryIds: ['169291'],
      categoryKeywords: ['handbags', 'purses'],
      minPrice: 500,
    },
    {
      label: 'Watches',
      categoryIds: ['31387'],
      categoryKeywords: ['wristwatches', 'watches'],
      minPrice: 2000,
    },
    {
      label: 'Fine jewelry',
      categoryKeywords: ['fine jewelry'],
      minPrice: 500,
    },
  ],
};

/** Merge an org override over the defaults; arrays in the override replace defaults. */
export function mergeComplianceConfig(
  override: Partial<FashionComplianceConfig> | null | undefined,
): FashionComplianceConfig {
  const base = DEFAULT_FASHION_COMPLIANCE_CONFIG;
  if (!override) return base;
  const pick = <K extends keyof FashionComplianceConfig>(key: K) =>
    Array.isArray(override[key])
      ? (override[key] as FashionComplianceConfig[K])
      : base[key];
  return {
    blockTerms: pick('blockTerms'),
    blockTermExceptions: pick('blockTermExceptions'),
    reviewPhrases: pick('reviewPhrases'),
    fillerTerms: pick('fillerTerms'),
    protectedBrands: pick('protectedBrands'),
    knownBrands: pick('knownBrands'),
    ambiguousBrands: pick('ambiguousBrands'),
    authenticityGuarantee: pick('authenticityGuarantee'),
  };
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Lowercase, strip accents, turn anything that is not a letter/digit/&/' into a space. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9&']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match a phrase on word boundaries. Phrases with symbols ("1:1", "l@@k",
 * "aaa+") are matched against the raw lowercase text; plain words against
 * normalized text so punctuation and accents don't matter.
 */
export function findPhrase(text: string, phrase: string): string | null {
  const p = phrase.trim().toLowerCase();
  if (!p) return null;
  if (/[^a-z0-9 &'\-]/i.test(p)) {
    const raw = text.toLowerCase();
    const re = new RegExp(
      `(^|[^a-z0-9])(${escapeRegExp(p)})(?=$|[^a-z0-9])`,
      'i',
    );
    const m = raw.match(re);
    return m ? m[2] : null;
  }
  const normPhrase = normalizeText(p);
  if (!normPhrase) return null;
  const norm = ` ${normalizeText(text)} `;
  return norm.includes(` ${normPhrase} `) ? normPhrase : null;
}

function removePhrase(text: string, phrase: string): string {
  const p = phrase.trim();
  if (!p) return text;
  const re = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(p).replace(/-|\s+/g, '[\\s\\-]+')}(?=$|[^\\p{L}\\p{N}])`,
    'giu',
  );
  return text.replace(re, '$1');
}

/** Collapse whitespace and stray separators left behind by removals. */
export function tidyTitle(title: string): string {
  return title
    .replace(/[!*~]{2,}/g, ' ')
    .replace(/\s*([,/|-])\s*(?=[,/|-]|$)/g, ' ')
    .replace(/^[\s,/|\-:]+|[\s,/|\-:]+$/g, '')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

interface BrandEntry {
  canonical: string;
  aliases: string[];
  priceFloor?: number;
  protected: boolean;
  ambiguousAliases: Set<string>;
}

function brandIndex(config: FashionComplianceConfig): BrandEntry[] {
  const ambiguous = new Set(config.ambiguousBrands.map(normalizeText));
  const entries: BrandEntry[] = [];
  const seen = new Set<string>();
  for (const b of config.protectedBrands) {
    const key = normalizeText(b.name);
    if (seen.has(key)) continue;
    seen.add(key);
    const aliases = [
      ...new Set([b.name, ...(b.aliases ?? [])].map(normalizeText)),
    ].filter(Boolean);
    entries.push({
      canonical: b.name,
      aliases,
      priceFloor: b.priceFloor,
      protected: true,
      ambiguousAliases: new Set(aliases.filter((a) => ambiguous.has(a))),
    });
  }
  for (const name of config.knownBrands) {
    const key = normalizeText(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    entries.push({
      canonical: name,
      aliases: [key],
      protected: false,
      ambiguousAliases: new Set(ambiguous.has(key) ? [key] : []),
    });
  }
  return entries;
}

/** Canonical brand entry for a free-text brand value, if we know it. */
function resolveBrand(
  value: string | null | undefined,
  index: BrandEntry[],
): BrandEntry | null {
  const norm = normalizeText(value);
  if (!norm) return null;
  // Exact alias first, then "value contains alias" (e.g. "BOSS Hugo Boss").
  for (const e of index) if (e.aliases.includes(norm)) return e;
  let best: BrandEntry | null = null;
  let bestLen = 0;
  for (const e of index) {
    for (const a of e.aliases) {
      if (a.length > bestLen && ` ${norm} `.includes(` ${a} `)) {
        best = e;
        bestLen = a.length;
      }
    }
  }
  return best;
}

interface BrandHit {
  entry: BrandEntry;
  alias: string;
  position: number;
}

/**
 * Brands mentioned in text. Ambiguous aliases ("coach", "boss", "gap") only
 * count when `allowAmbiguousFor` is that same brand.
 */
function brandsInText(
  text: string,
  index: BrandEntry[],
  allowAmbiguousFor: BrandEntry | null,
): BrandHit[] {
  const norm = ` ${normalizeText(text)} `;
  const hits = new Map<string, BrandHit>();
  for (const e of index) {
    for (const a of e.aliases) {
      if (e.ambiguousAliases.has(a) && e !== allowAmbiguousFor) continue;
      const pos = norm.indexOf(` ${a} `);
      if (pos < 0) continue;
      const prev = hits.get(e.canonical);
      if (!prev || a.length > prev.alias.length)
        hits.set(e.canonical, { entry: e, alias: a, position: pos });
    }
  }
  // Drop hits fully contained in a longer hit of another brand
  // ("michael kors" inside "michael michael kors" is the same brand anyway).
  return [...hits.values()].sort((x, y) => x.position - y.position);
}

function sameBrand(a: BrandEntry | null, b: BrandEntry | null): boolean {
  return !!a && !!b && a.canonical === b.canonical;
}

function stripExceptions(text: string, exceptions: string[]): string {
  let out = text;
  for (const ex of exceptions) out = removePhrase(out, ex);
  return out;
}

const NEGATION_RE =
  /\b(not|no|never|isn't|is not|aren't|without|zero|guaranteed not)\s+(?:\w+\s+){0,2}$/i;

function termIsNegated(text: string, term: string): boolean {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx < 0) return false;
  return NEGATION_RE.test(lower.slice(Math.max(0, idx - 40), idx));
}

function authenticityGuaranteeLabel(
  listing: ComplianceListing,
  config: FashionComplianceConfig,
): string | null {
  const price = listing.price ?? 0;
  const catName = (listing.categoryName ?? '').toLowerCase();
  for (const rule of config.authenticityGuarantee) {
    const idMatch =
      !!listing.categoryId &&
      (rule.categoryIds ?? []).includes(String(listing.categoryId));
    const kwMatch = (rule.categoryKeywords ?? []).some(
      (kw) => kw && catName.includes(kw.toLowerCase()),
    );
    if ((idMatch || kwMatch) && price >= rule.minPrice) return rule.label;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main text check
// ---------------------------------------------------------------------------

/**
 * Run all text rules. Safe fixes (filler words, extra brand names when the real
 * brand is known, a missing Brand specific when the title clearly starts with a
 * known brand) are applied to `fixed`; every other finding is reported only.
 */
export function checkListingText(
  listing: ComplianceListing,
  config: FashionComplianceConfig = DEFAULT_FASHION_COMPLIANCE_CONFIG,
): TextCheckResult {
  const issues: ComplianceIssue[] = [];
  const fixes: ComplianceFix[] = [];
  const index = brandIndex(config);
  let title = listing.title ?? '';
  let brandSpecific = listing.brandSpecific?.trim() || null;
  const productBrand = listing.brand?.trim() || null;
  const description = listing.description ?? '';

  // 1. Replica-type wording -------------------------------------------------
  const fieldsForBlock: Array<[IssueField, string]> = [
    ['title', title],
    ['brand', [productBrand, brandSpecific].filter(Boolean).join(' ')],
    ['description', description],
  ];
  for (const [field, text] of fieldsForBlock) {
    if (!text) continue;
    const scrubbed = stripExceptions(text, config.blockTermExceptions);
    for (const term of config.blockTerms) {
      const hit = findPhrase(scrubbed, term);
      if (!hit) continue;
      const negated =
        field === 'description' && termIsNegated(scrubbed, term);
      issues.push({
        code: negated ? 'COUNTERFEIT_TERM_NEGATED' : 'COUNTERFEIT_TERM',
        severity: negated ? 'review' : 'block',
        field,
        evidence: term,
        source: 'text',
        message: negated
          ? `Description says "${term}" in a negated sentence; confirm the wording is a disclaimer, then remove it`
          : `Replica-type wording "${term}" in ${field}`,
      });
    }
  }

  // 2. Comparisons to another brand -----------------------------------------
  for (const [field, text] of [
    ['title', title],
    ['description', description],
  ] as Array<[IssueField, string]>) {
    if (!text) continue;
    for (const phrase of config.reviewPhrases) {
      const hit = findPhrase(text, phrase);
      if (!hit) continue;
      // "Unbranded" on its own is a legitimate eBay brand value; it is only
      // risky next to a real brand name.
      if (normalizeText(phrase) === 'unbranded') {
        const brands = brandsInText(text, index, null);
        if (!brands.length) continue;
      }
      issues.push({
        code: 'BRAND_COMPARISON',
        severity: 'review',
        field,
        evidence: phrase,
        source: 'text',
        message: `"${phrase}" compares this item to another brand; reword or remove it`,
      });
    }
    // "like Gucci", "Chanel-style"
    const norm = ` ${normalizeText(text)} `;
    for (const e of index.filter((x) => x.protected)) {
      for (const a of e.aliases) {
        if (e.ambiguousAliases.has(a)) continue;
        if (
          norm.includes(` like ${a} `) ||
          norm.includes(` ${a} style `) ||
          norm.includes(` ${a} inspired `)
        ) {
          issues.push({
            code: 'BRAND_COMPARISON',
            severity: 'review',
            field,
            evidence: `${e.canonical} comparison`,
            source: 'text',
            message: `Text compares the item to ${e.canonical}; reword or remove it`,
          });
        }
      }
    }
  }

  // 3. Brand fields ---------------------------------------------------------
  const specEntry = resolveBrand(brandSpecific, index);
  const productEntry = resolveBrand(productBrand, index);
  if (
    brandSpecific &&
    productBrand &&
    normalizeText(brandSpecific) !== normalizeText(productBrand) &&
    !sameBrand(specEntry, productEntry) &&
    !` ${normalizeText(brandSpecific)} `.includes(
      ` ${normalizeText(productBrand)} `,
    ) &&
    !` ${normalizeText(productBrand)} `.includes(
      ` ${normalizeText(brandSpecific)} `,
    )
  ) {
    issues.push({
      code: 'BRAND_FIELD_MISMATCH',
      severity: 'review',
      field: 'brand',
      evidence: `${productBrand} ≠ ${brandSpecific}`,
      source: 'text',
      message: `Brand field "${productBrand}" and Brand item specific "${brandSpecific}" disagree`,
    });
  }

  let declaredText = brandSpecific || productBrand;
  let declaredEntry = specEntry ?? productEntry;

  // Missing brand: fill only when the title clearly starts with a known brand.
  if (!declaredText) {
    const hits = brandsInText(title, index, null);
    const first = hits[0];
    const titleNorm = normalizeText(title);
    if (
      first &&
      hits.length === 1 &&
      titleNorm.startsWith(`${first.alias} `)
    ) {
      fixes.push({
        field: 'brand',
        before: null,
        after: first.entry.canonical,
        reason: `Title starts with the brand "${first.entry.canonical}"`,
      });
      brandSpecific = first.entry.canonical;
      declaredText = first.entry.canonical;
      declaredEntry = first.entry;
      issues.push({
        code: 'BRAND_MISSING',
        severity: 'info',
        field: 'brand',
        autoFixed: true,
        source: 'text',
        message: `Brand item specific was empty; filled with "${first.entry.canonical}" from the title`,
      });
    } else {
      issues.push({
        code: 'BRAND_MISSING',
        severity: 'review',
        field: 'brand',
        source: 'text',
        message:
          'No Brand item specific. Set the brand (or "Unbranded") before publishing',
      });
    }
  }

  // 4. Keyword spam & title/brand consistency ------------------------------
  const titleHits = brandsInText(title, index, declaredEntry);
  const declaredNorm = normalizeText(declaredText);
  const isDeclared = (h: BrandHit) =>
    sameBrand(h.entry, declaredEntry) ||
    (!!declaredNorm &&
      (` ${declaredNorm} `.includes(` ${h.alias} `) ||
        h.alias.includes(declaredNorm)));
  const otherBrands = titleHits.filter((h) => !isDeclared(h));
  const collab =
    /×/.test(title) ||
    /(^| )(x|collab|collaboration)( |$)/.test(normalizeText(title));

  if (otherBrands.length) {
    const declaredInTitle =
      titleHits.some(isDeclared) ||
      (!!declaredNorm && ` ${normalizeText(title)} `.includes(` ${declaredNorm} `));
    if (collab || !declaredText) {
      issues.push({
        code: collab ? 'BRAND_COLLAB_CHECK' : 'KEYWORD_SPAM',
        severity: 'review',
        field: 'title',
        evidence: otherBrands.map((h) => h.entry.canonical).join(', '),
        source: 'text',
        message: collab
          ? `Title names more than one brand (${otherBrands.map((h) => h.entry.canonical).join(', ')}); confirm the collaboration is genuine`
          : `Title names several brands (${otherBrands.map((h) => h.entry.canonical).join(', ')}) and the listing has no brand`,
      });
    } else if (!declaredInTitle && otherBrands.length === 1) {
      issues.push({
        code: 'BRAND_TITLE_MISMATCH',
        severity: 'review',
        field: 'title',
        evidence: `${otherBrands[0].entry.canonical} vs ${declaredText}`,
        source: 'text',
        message: `Title names ${otherBrands[0].entry.canonical} but the brand is ${declaredText}`,
      });
    } else {
      // Real brand is in the title; the others are keyword spam. Remove them.
      let next = title;
      for (const h of otherBrands) {
        const aliasRaw = h.alias;
        next = removePhrase(next, aliasRaw);
      }
      next = tidyTitle(next);
      if (next && next !== title) {
        fixes.push({
          field: 'title',
          before: title,
          after: next,
          reason: `Removed other brand names: ${otherBrands.map((h) => h.entry.canonical).join(', ')}`,
        });
        issues.push({
          code: 'KEYWORD_SPAM',
          severity: 'warn',
          field: 'title',
          autoFixed: true,
          evidence: otherBrands.map((h) => h.entry.canonical).join(', '),
          source: 'text',
          message: `Removed extra brand names from the title: ${otherBrands.map((h) => h.entry.canonical).join(', ')}`,
        });
        title = next;
      }
    }
  }

  // Description naming a different protected brand.
  if (description && declaredText) {
    const descHits = brandsInText(description, index, declaredEntry).filter(
      (h) => h.entry.protected && !isDeclared(h),
    );
    if (descHits.length) {
      issues.push({
        code: 'BRAND_DESCRIPTION_MISMATCH',
        severity: 'review',
        field: 'description',
        evidence: descHits.map((h) => h.entry.canonical).join(', '),
        source: 'text',
        message: `Description mentions ${descHits.map((h) => h.entry.canonical).join(', ')} but the brand is ${declaredText}`,
      });
    }
  }

  // 5. Filler words (safe auto-fix) -----------------------------------------
  let cleaned = title.replace(EMOJI_RE, ' ');
  const removedFiller: string[] = [];
  for (const term of config.fillerTerms) {
    if (findPhrase(cleaned, term)) {
      cleaned = removePhrase(cleaned, term);
      removedFiller.push(term);
    }
  }
  cleaned = tidyTitle(cleaned);
  if (cleaned !== title && cleaned) {
    fixes.push({
      field: 'title',
      before: title,
      after: cleaned,
      reason: removedFiller.length
        ? `Removed filler: ${removedFiller.join(', ')}`
        : 'Removed emoji and repeated punctuation',
    });
    issues.push({
      code: 'TITLE_FILLER',
      severity: 'info',
      field: 'title',
      autoFixed: true,
      evidence: removedFiller.join(', ') || 'emoji/punctuation',
      source: 'text',
      message: 'Removed filler words or symbols from the title',
    });
    title = cleaned;
  }

  if (title.length > EBAY_TITLE_MAX) {
    issues.push({
      code: 'TITLE_TOO_LONG',
      severity: 'warn',
      field: 'title',
      evidence: String(title.length),
      source: 'text',
      message: `Title is ${title.length} characters; eBay allows ${EBAY_TITLE_MAX}`,
    });
  }

  // 6. Price -----------------------------------------------------------------
  if (listing.price == null || !(Number(listing.price) > 0)) {
    issues.push({
      code: 'PRICE_MISSING',
      severity: 'review',
      field: 'price',
      source: 'text',
      message: 'Listing has no price',
    });
  } else if (declaredEntry?.protected && declaredEntry.priceFloor) {
    if (Number(listing.price) < declaredEntry.priceFloor) {
      issues.push({
        code: 'PRICE_BELOW_BRAND_FLOOR',
        severity: 'block',
        field: 'price',
        evidence: `$${Number(listing.price).toFixed(2)} < $${declaredEntry.priceFloor}`,
        source: 'text',
        message: `${declaredEntry.canonical} priced at $${Number(listing.price).toFixed(2)}, below the $${declaredEntry.priceFloor} floor for genuine items`,
      });
    }
  }

  // 7. Authenticity Guarantee categories -----------------------------------
  const ag = authenticityGuaranteeLabel(listing, config);
  if (ag) {
    issues.push({
      code: 'AUTHENTICITY_GUARANTEE',
      severity: declaredEntry?.protected ? 'review' : 'warn',
      field: 'category',
      evidence: ag,
      source: 'text',
      message: `${ag} at this price go through eBay Authenticity Guarantee; the item ships via an authenticator and must match the listing exactly`,
    });
  }

  if (declaredEntry?.protected && !issues.some((i) => i.code === 'PRICE_BELOW_BRAND_FLOOR')) {
    issues.push({
      code: 'PROTECTED_BRAND',
      severity: 'info',
      field: 'brand',
      evidence: declaredEntry.canonical,
      source: 'text',
      message: `${declaredEntry.canonical} is an actively protected (VeRO) brand`,
    });
  }

  return {
    issues: dedupeIssues(issues),
    fixes,
    fixed: {
      ...listing,
      title,
      brandSpecific,
      brand: productBrand ?? (fixes.some((f) => f.field === 'brand') ? brandSpecific : null),
    },
    declaredBrand: declaredEntry?.canonical ?? declaredText ?? null,
    authenticityGuarantee: ag,
  };
}

function dedupeIssues(issues: ComplianceIssue[]): ComplianceIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.code}|${i.field ?? ''}|${i.evidence ?? ''}|${i.imageIndex ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  info: 2,
  warn: 8,
  review: 25,
  block: 100,
};

/** 0–100. Any blocking issue scores at least 90. Auto-fixed issues count half. */
export function riskScore(issues: ComplianceIssue[]): number {
  if (issues.some((i) => i.severity === 'block' && !i.autoFixed)) {
    const extra = issues.filter((i) => i.severity !== 'block').length;
    return Math.min(100, 90 + extra * 2);
  }
  const raw = issues.reduce(
    (sum, i) => sum + SEVERITY_WEIGHT[i.severity] * (i.autoFixed ? 0.5 : 1),
    0,
  );
  return Math.min(89, Math.round(raw));
}

export function decide(issues: ComplianceIssue[]): ComplianceDecision {
  const open = issues.filter((i) => !i.autoFixed);
  if (open.some((i) => i.severity === 'block')) return 'BLOCKED';
  if (open.some((i) => i.severity === 'review')) return 'NEEDS_REVIEW';
  if (issues.some((i) => i.autoFixed)) return 'AUTO_FIXED';
  return 'PASS';
}
