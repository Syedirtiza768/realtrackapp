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

/** Build a publish-safe eBay title from catalog fields and optional overrides. */
export function buildEbayListingTitle(
  source: EbayTitleSource,
): EbayTitleResult {
  const warnings: string[] = [];
  const raw = source.titleOverride?.trim() || source.title?.trim() || '';

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
}): { title: string; description: string; warnings: string[] } {
  const built = buildEbayListingTitle({
    title: req.title,
    sku: req.sku,
    brand: req.brand,
    mpn: req.mpn,
    partType: req.partType,
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
