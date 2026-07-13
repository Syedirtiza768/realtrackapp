export const EBAY_TITLE_MAX_LENGTH = 80;
/** eBay Inventory API `listingDescription` / offer description limit. */
export const EBAY_OFFER_DESCRIPTION_MAX_LENGTH = 4000;
/** @deprecated Use EBAY_OFFER_DESCRIPTION_MAX_LENGTH — kept for imports. */
export const EBAY_DESCRIPTION_MAX_LENGTH = EBAY_OFFER_DESCRIPTION_MAX_LENGTH;

export interface EbayTitleSource {
  title?: string | null;
  titleOverride?: string | null;
  brand?: string | null;
  partType?: string | null;
  mpn?: string | null;
  sku?: string | null;
  /** Structured composition fields. When `make` and at least one of
   * `partName`/`oemPartNumber` are present, the title is assembled
   * deterministically via buildStructuredEbayTitle instead of using `title`. */
  yearRange?: string | null;
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  position?: string | null;
  partName?: string | null;
  oemPartNumber?: string | null;
}

/** Deterministic eBay Motors title structure input:
 * Year Range → Make → Model/Generation → Position → Part Name → OEM Part Number. */
export interface EbayStructuredTitleInput {
  yearRange?: string | null;
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  position?: string | null;
  partName?: string | null;
  oemPartNumber?: string | null;
}

export interface EbayTitleResult {
  title: string;
  warnings: string[];
}

export interface EbayDescriptionSource {
  description?: string | null;
  title?: string | null;
  brand?: string | null;
  mpn?: string | null;
  sku?: string | null;
  partType?: string | null;
}

export interface EbayDescriptionResult {
  description: string;
  warnings: string[];
}

/** Collapse whitespace and trim user-facing listing text. */
export function normalizeListingText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Truncate to eBay's title limit, preferring a word boundary. */
export function truncateEbayTitle(
  title: string,
  maxLength: number = EBAY_TITLE_MAX_LENGTH,
): string {
  const normalized = normalizeListingText(title);
  if (normalized.length <= maxLength) return normalized;

  const truncated = normalized.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace).trim();
  }
  return truncated.trim();
}

/** Truncate on a word boundary, preferring to keep >=50% of the text. */
function truncateAtWord(text: string, maxLength: number): string {
  const normalized = normalizeListingText(text);
  if (normalized.length <= maxLength) return normalized;
  const cut = normalized.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > maxLength * 0.5
    ? cut.slice(0, lastSpace).trim()
    : cut.trim();
}

/** Suffix appended to structured titles when space permits. */
const EBAY_TITLE_SUFFIX = 'OEM Used';

/** Ordered body segments of a structured Motors title. */
const EBAY_TITLE_STRUCTURED_KEYS = [
  'yearRange',
  'make',
  'model',
  'generation',
  'position',
  'partName',
  'oemPartNumber',
] as const;

/** Optional segments dropped in priority order (least valuable first) when the
 * composed title exceeds the limit. Year range, make, and OEM part number are
 * always retained because they anchor buyer search. */
const EBAY_TITLE_DROPPABLE_KEYS = [
  'position',
  'generation',
  'model',
  'partName',
] as const;

/**
 * Deterministically compose an eBay Motors listing title following the house
 * structure: Year Range → Make → Model/Generation → Position → Part Name →
 * OEM Part Number → "OEM Used". The result is capped at `maxLength` (80) on a
 * word boundary; when over budget, optional segments are dropped in priority
 * order before any token is split, and the "OEM Used" suffix is retained
 * whenever a non-empty body fits. Returns an empty string when no body
 * segments are available so callers can fall back to other strategies.
 */
export function buildStructuredEbayTitle(
  input: EbayStructuredTitleInput,
  maxLength: number = EBAY_TITLE_MAX_LENGTH,
): string {
  const segmentsByKey: Record<string, string> = {};
  for (const key of EBAY_TITLE_STRUCTURED_KEYS) {
    let value = input[key]?.trim();
    // Parts with multiple superseding/interchange OEM numbers store them as a
    // single comma/semicolon-joined field (observed: 5 numbers, ~60 chars).
    // yearRange, make, and oemPartNumber are never dropped below (see
    // EBAY_TITLE_DROPPABLE_KEYS), so an unbounded oemPartNumber silently
    // starved out year/model/part name on every over-budget title. eBay
    // search only needs one identifying number in the title — the rest
    // belong in the description/item specifics, not here.
    if (key === 'oemPartNumber' && value) {
      value = value.split(/[,;]/)[0]?.trim();
    }
    if (value) segmentsByKey[key] = value;
  }

  const buildSegments = (dropped: Set<string>): string[] =>
    EBAY_TITLE_STRUCTURED_KEYS.filter((k) => !dropped.has(k))
      .map((k) => segmentsByKey[k])
      .filter((v): v is string => Boolean(v));

  const coreOf = (dropped: Set<string>): string =>
    buildSegments(dropped).join(' ');

  const withSuffixOf = (dropped: Set<string>): string => {
    const core = coreOf(dropped);
    return core ? `${core} ${EBAY_TITLE_SUFFIX}` : '';
  };

  const noneDropped = new Set<string>();
  if (!buildSegments(noneDropped).length) return '';

  // Full structure fits with the suffix.
  const fullWithSuffix = withSuffixOf(noneDropped);
  if (fullWithSuffix.length <= maxLength) {
    return normalizeListingText(fullWithSuffix);
  }

  // Progressively drop optional segments (least valuable first), preferring a
  // result that keeps the "OEM Used" suffix. Track the least-dropped body
  // that fits without the suffix as a fallback.
  let dropped = new Set<string>();
  let bestCoreDropped: Set<string> | null = null;
  if (coreOf(dropped).length <= maxLength) bestCoreDropped = new Set(dropped);

  for (const key of EBAY_TITLE_DROPPABLE_KEYS) {
    if (!segmentsByKey[key]) continue;
    const next = new Set([...dropped, key]);
    if (!buildSegments(next).length) break;
    const withSuffix = withSuffixOf(next);
    if (withSuffix.length <= maxLength) {
      return normalizeListingText(withSuffix);
    }
    if (bestCoreDropped === null && coreOf(next).length <= maxLength) {
      bestCoreDropped = next;
    }
    dropped = next;
  }

  // No combination fits with the suffix — use the least-dropped body that fits
  // without it (suffix dropped because space does not permit).
  if (bestCoreDropped) {
    return normalizeListingText(coreOf(bestCoreDropped));
  }

  // Only essential segments remain and still exceed the limit: fit the body to
  // the remaining budget on a word boundary, then re-append the suffix.
  const core = coreOf(dropped);
  if (!core) return '';
  const budget = maxLength - (EBAY_TITLE_SUFFIX.length + 1);
  const truncatedCore = truncateAtWord(core, Math.max(0, budget));
  const withSuffix = `${truncatedCore} ${EBAY_TITLE_SUFFIX}`;
  if (truncatedCore && withSuffix.length <= maxLength) {
    return normalizeListingText(withSuffix);
  }
  return truncateAtWord(core, maxLength);
}

/** Build a publish-safe eBay title from catalog fields and optional overrides. */
export function buildEbayListingTitle(
  source: EbayTitleSource,
): EbayTitleResult {
  const warnings: string[] = [];

  const override = source.titleOverride?.trim();
  if (override) {
    const title = truncateEbayTitle(override);
    if (normalizeListingText(override).length > EBAY_TITLE_MAX_LENGTH) {
      warnings.push(
        `Title override truncated from ${normalizeListingText(override).length} to ${EBAY_TITLE_MAX_LENGTH} characters for eBay`,
      );
    }
    return { title, warnings };
  }

  const make = (source.make ?? source.brand)?.trim() || '';
  const partName = (source.partName ?? source.partType)?.trim() || '';
  const oemPartNumber = (source.oemPartNumber ?? source.mpn)?.trim() || '';

  if (make && (partName || oemPartNumber)) {
    const composed = buildStructuredEbayTitle({
      yearRange: source.yearRange,
      make,
      model: source.model,
      generation: source.generation,
      position: source.position,
      partName,
      oemPartNumber,
    });
    if (composed) {
      const hadTitle = Boolean(source.title?.trim());
      if (hadTitle && normalizeListingText(source.title!) !== composed) {
        warnings.push(
          'Listing title recomposed from structured fields (year/make/model/position/part name/OEM number)',
        );
      } else if (!hadTitle) {
        warnings.push(
          'Title was empty — composed from structured catalog fields',
        );
      }
      return { title: composed, warnings };
    }
  }

  const raw = source.title?.trim() || '';
  let title = raw ? truncateEbayTitle(raw) : '';

  if (raw && normalizeListingText(raw).length > EBAY_TITLE_MAX_LENGTH) {
    warnings.push(
      `Title truncated from ${normalizeListingText(raw).length} to ${EBAY_TITLE_MAX_LENGTH} characters for eBay`,
    );
  }

  if (!title) {
    const parts = [source.brand, source.partType, source.mpn]
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part));
    if (parts.length) {
      title = truncateEbayTitle(parts.join(' '));
      warnings.push('Title was empty — generated from brand/part type/MPN');
    }
  }

  if (!title && source.sku?.trim()) {
    title = truncateEbayTitle(source.sku.trim());
    warnings.push('Title was empty — using SKU as listing title');
  }

  if (!title) {
    title = 'Automotive Part';
    warnings.push('Title was empty — using generic fallback title');
  }

  return { title, warnings };
}

/** Remove heavy boilerplate that inflates imported listing HTML beyond eBay limits. */
export function stripListingHtmlBoilerplate(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

function hasVisibleText(html: string): boolean {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildDescriptionFallback(source: EbayDescriptionSource): string {
  const metadata = [source.brand, source.partType, source.mpn]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');

  const summary =
    source.title?.trim() ||
    metadata ||
    (source.sku?.trim() ? `SKU ${source.sku.trim()}` : '') ||
    'Automotive part';

  return `<p>${escapeHtmlText(summary)}. See photos for condition and fitment details.</p>`;
}

/** Truncate description to eBay's offer limit, preferring HTML/sentence boundaries. */
export function truncateEbayDescription(
  description: string,
  maxLength: number = EBAY_OFFER_DESCRIPTION_MAX_LENGTH,
): string {
  if (description.length <= maxLength) return description;

  let cut = description.slice(0, maxLength);
  const breakPoints = ['</p>', '</li>', '</div>', '. ', '\n'];
  for (const bp of breakPoints) {
    const idx = cut.lastIndexOf(bp);
    if (idx > maxLength * 0.6) {
      cut = cut.slice(0, idx + (bp === '. ' ? 1 : bp.length));
      break;
    }
  }
  return cut.trim();
}

/** Build a publish-safe eBay description (1–4000 chars) from catalog fields. */
export function buildEbayListingDescription(
  source: EbayDescriptionSource,
): EbayDescriptionResult {
  const warnings: string[] = [];
  let raw = (source.description ?? '').trim();

  if (raw) {
    const stripped = stripListingHtmlBoilerplate(raw);
    if (stripped.length < raw.length) {
      warnings.push(
        'Removed embedded style/script blocks from description for eBay publish',
      );
    }
    raw = stripped;
  }

  if (!raw || !hasVisibleText(raw)) {
    raw = buildDescriptionFallback(source);
    warnings.push('Description was empty — generated fallback text for eBay');
  }

  if (raw.length > EBAY_OFFER_DESCRIPTION_MAX_LENGTH) {
    const before = raw.length;
    raw = truncateEbayDescription(raw);
    warnings.push(
      `Description truncated from ${before} to ${raw.length} characters for eBay (max ${EBAY_OFFER_DESCRIPTION_MAX_LENGTH})`,
    );
  }

  if (raw.length < 1) {
    raw = buildDescriptionFallback(source);
  }

  return { description: raw, warnings };
}

/** Ensure description is non-empty and within eBay's offer size limit. */
export function sanitizeEbayDescription(
  description?: string | null,
  source?: Omit<EbayDescriptionSource, 'description'>,
): string {
  return buildEbayListingDescription({
    description,
    ...source,
  }).description;
}

/** Final safety pass before Inventory API / SellerPundit publish. */
export function sanitizePublishListingText(req: {
  title: string;
  description: string;
  sku?: string | null;
  brand?: string | null;
  mpn?: string | null;
  partType?: string | null;
  yearRange?: string | null;
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  position?: string | null;
  partName?: string | null;
  oemPartNumber?: string | null;
}): { title: string; description: string; warnings: string[] } {
  const built = buildEbayListingTitle({
    title: req.title,
    sku: req.sku,
    brand: req.brand,
    mpn: req.mpn,
    partType: req.partType,
    yearRange: req.yearRange,
    make: req.make,
    model: req.model,
    generation: req.generation,
    position: req.position,
    partName: req.partName,
    oemPartNumber: req.oemPartNumber,
  });
  const desc = buildEbayListingDescription({
    description: req.description,
    title: built.title,
    sku: req.sku,
    brand: req.brand,
    mpn: req.mpn,
    partType: req.partType,
  });
  return {
    title: built.title,
    description: desc.description,
    warnings: [...built.warnings, ...desc.warnings],
  };
}
