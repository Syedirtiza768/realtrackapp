export const EBAY_MAX_LISTING_IMAGES = 24;

const SINGLE_IMAGE_BRAND_PATTERN =
  /\b(?:febi(?:\s+bilstein)?|lemforder|lemförder)\b/i;

const PLACEHOLDER_IMAGE_PATTERN =
  /placeholder|no-image|default-image|logo-only/i;

const PARTSFINDER_ROTATING_IMAGE_TEMPLATE =
  /(\/pf-allaround-)zoomed(\/[^/]+\/[^/]+\/)([^/]+)-\{col\}(\.[a-z0-9]+)([?#].*)?$/i;

/**
 * Parse a raw image URL field from the database into an array of valid URLs.
 * Handles pipe, comma, newline, and space delimiters — the field may contain
 * any combination of these separators.
 */
export function parseImageUrlField(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n|,]+/)
    .flatMap((s) => s.split(/\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /^https?:\/\//i.test(s))
    .map((s) => s.replace(/^http:\/\//i, 'https://'));
}

/** Expand pipe-delimited image strings and drop blank entries. */
export function flattenImageUrlInputs(
  urls: string[] | null | undefined,
): string[] {
  if (!urls?.length) return [];
  const out: string[] = [];
  for (const raw of urls) {
    if (typeof raw !== 'string') continue;
    const parts = raw
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);
    out.push(...parts);
  }
  return out;
}

/** Normalize a raw image URL to https when possible. */
export function normalizePublishImageUrl(url: string): string | null {
  let trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) trimmed = `https:${trimmed}`;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (trimmed.length > 2048) return null;

  // PartsFinder stores rotating-gallery URLs as a client-side `{col}`
  // template. eBay Picture Services cannot download that literal URL. The
  // details/01 image is the stable primary frame exposed by the same page.
  trimmed = trimmed.replace(
    PARTSFINDER_ROTATING_IMAGE_TEMPLATE,
    '$1details$2$3-01$4$5',
  );

  // Do not send unresolved image templates to eBay. They look like valid
  // HTTP URLs to the rest of the application but are not downloadable files.
  if (/[{}]/.test(trimmed)) return null;
  return trimmed;
}

/** True when the URL is a non-empty http(s) link suitable for marketplace publish. */
export function isValidPublishImageUrl(url: string): boolean {
  return normalizePublishImageUrl(url) != null;
}

export interface EbayImageUrlsResult {
  imageUrls: string[];
  warnings: string[];
}

/** Prefer large eBay CDN sizes for marketplace consumers (s-l1600). */
export function preferLargeEbayImageUrl(url: string): string {
  return url
    .replace(/\/s-l(64|96|140|225|300|400|500)\./gi, '/s-l1600.')
    .replace(/([?&]s-l)(64|96|140|225|300|400|500)(?=\D|$)/gi, '$11600');
}

/** True for brands whose catalog images are intentionally reduced to one primary image. */
export function isSingleImageBrand(
  brandOrTitle: string | null | undefined,
): boolean {
  return SINGLE_IMAGE_BRAND_PATTERN.test(brandOrTitle?.trim() ?? '');
}

function embeddedEbayImageDimensions(url: string): [number, number] | null {
  const token = url.match(/\/s\/([^/]+)\//i)?.[1];
  if (!token) {
    const size = url.match(/(?:^|[/?])s-l(\d+)(?:\D|$)/i)?.[1];
    return size ? [Number(size), Number(size)] : null;
  }

  try {
    const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (normalized.length % 4)) % 4;
    const padded = normalized.padEnd(normalized.length + padding, '=');
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const match = decoded.match(/(\d{2,5})x(\d{2,5})/i);
    return match ? [Number(match[1]), Number(match[2])] : null;
  } catch {
    return null;
  }
}

/**
 * Keep one high-resolution primary image for FEBI/Lemförder listings.
 * eBay URLs commonly carry dimensions in either an s-l size or a base64 path
 * segment; unknown-resolution URLs retain their original order.
 */
export function selectPrimaryImageForBrand(
  urls: string[] | null | undefined,
  brandOrTitle: string | null | undefined,
): string[] {
  if (!isSingleImageBrand(brandOrTitle)) {
    return sanitizeEbayImageUrls((urls ?? []).map(preferLargeEbayImageUrl))
      .imageUrls;
  }

  const rawCount = Math.max(flattenImageUrlInputs(urls).length, 1);
  const candidates = sanitizeEbayImageUrls(
    (urls ?? []).map(preferLargeEbayImageUrl),
    { maxImages: rawCount },
  ).imageUrls;
  if (candidates.length <= 1) return candidates;

  let best = candidates[0];
  let bestScore = -1;
  for (const candidate of candidates) {
    const dimensions = embeddedEbayImageDimensions(candidate);
    const score = dimensions ? dimensions[0] * dimensions[1] : 0;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return [best];
}

/**
 * Prefer the richer gallery when merging sync sources.
 * Never shrink a previously-enriched multi-image set down to a single GalleryURL.
 * When counts tie, prefer URLs already upgraded to large eBay sizes.
 */
export function preferRicherImageUrls(
  primary: string[] | null | undefined,
  secondary: string[] | null | undefined,
): string[] {
  const a = sanitizeEbayImageUrls(
    (primary ?? []).map((u) => preferLargeEbayImageUrl(u)),
  ).imageUrls;
  const b = sanitizeEbayImageUrls(
    (secondary ?? []).map((u) => preferLargeEbayImageUrl(u)),
  ).imageUrls;
  if (a.length > b.length) return a;
  if (b.length > a.length) return b;
  return a.length > 0 ? a : b;
}

/** Normalize, dedupe, and cap listing images for eBay / SellerPundit publish. */
export function sanitizeEbayImageUrls(
  urls: string[] | null | undefined,
  options?: { maxImages?: number },
): EbayImageUrlsResult {
  const warnings: string[] = [];
  const maxImages = options?.maxImages ?? EBAY_MAX_LISTING_IMAGES;
  const seen = new Set<string>();
  const imageUrls: string[] = [];

  for (const raw of flattenImageUrlInputs(urls)) {
    const normalized = normalizePublishImageUrl(raw);
    if (!normalized) {
      warnings.push(`Skipped invalid image URL: ${raw.slice(0, 80)}`);
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (PLACEHOLDER_IMAGE_PATTERN.test(normalized)) {
      warnings.push(
        `Skipped placeholder image URL: ${normalized.slice(0, 80)}`,
      );
      continue;
    }
    imageUrls.push(normalized);
    if (imageUrls.length >= maxImages) break;
  }

  const rawCount = flattenImageUrlInputs(urls).length;
  if (rawCount > imageUrls.length && imageUrls.length > 0) {
    warnings.push(
      `Using ${imageUrls.length} valid image URL(s) after filtering invalid or duplicate entries`,
    );
  }
  if (rawCount > maxImages && imageUrls.length === maxImages) {
    warnings.push(`Image list capped at ${maxImages} URLs for eBay publish`);
  }

  return { imageUrls, warnings };
}

/** Apply optional per-store image order override (array of URLs or source URLs). */
export function applyImageOrderOverride(
  imageUrls: string[],
  override: unknown,
): string[] {
  if (!Array.isArray(override) || !override.length || !imageUrls.length) {
    return imageUrls;
  }

  const ordered: string[] = [];
  const remaining = new Map(
    imageUrls.map((url) => [url.toLowerCase(), url] as const),
  );

  for (const entry of override) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const match = remaining.get(trimmed.toLowerCase());
    if (match) {
      ordered.push(match);
      remaining.delete(trimmed.toLowerCase());
    }
  }

  for (const url of imageUrls) {
    if (!ordered.includes(url)) ordered.push(url);
  }

  return ordered;
}
