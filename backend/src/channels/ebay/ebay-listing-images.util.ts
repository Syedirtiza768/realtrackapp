export const EBAY_MAX_LISTING_IMAGES = 12;

const PLACEHOLDER_IMAGE_PATTERN = /placeholder|no-image|default-image|logo-only/i;

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
    .filter((s) => s.length > 0 && /^https?:\/\//i.test(s));
}

/** Expand pipe-delimited image strings and drop blank entries. */
export function flattenImageUrlInputs(urls: string[] | null | undefined): string[] {
  if (!urls?.length) return [];
  const out: string[] = [];
  for (const raw of urls) {
    if (typeof raw !== 'string') continue;
    const parts = raw.split('|').map((part) => part.trim()).filter(Boolean);
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
      warnings.push(`Skipped placeholder image URL: ${normalized.slice(0, 80)}`);
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
