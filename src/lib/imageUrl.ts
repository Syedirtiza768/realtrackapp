/**
 * Centralized image URL utilities.
 *
 * The backend generates responsive variants alongside originals:
 *   _thumb.webp  (200×200 cover)
 *   _sm.webp     (320×320 inside)
 *   _medium.webp (800×800 inside)
 *   _lg.webp     (1200×1200 inside)
 *
 * Given `https://cdn.example.com/path/photo.webp` →
 *   getThumbUrl  → `https://cdn.example.com/path/photo_thumb.webp`
 *   getSmallUrl  → `https://cdn.example.com/path/photo_sm.webp`
 *   getMediumUrl → `https://cdn.example.com/path/photo_medium.webp`
 *   getLargeUrl  → `https://cdn.example.com/path/photo_lg.webp`
 */

/**
 * Rewrite an S3 / CDN URL for browser access via the nginx-cached proxy.
 *
 * Routes our own S3 image URLs through /api/storage/serve/{key} so that
 * nginx proxy_cache (30-day, 1 GB) serves repeated requests locally on the
 * EC2 host — no per-request round-trip to S3, no separate DNS/TLS connection
 * to the S3 hostname. The browser reuses its existing connection to the app
 * origin instead of opening a new one to S3.
 *
 * External URLs (eBay, etc.) are returned as-is.
 */
export function toProxyUrl(url: string | null | undefined): string {
  if (!url) return '';
  const proxyPath = toBackendProxyPath(url);
  if (proxyPath) return proxyPath;
  return url;
}

/**
 * Build the backend proxy path for an S3 URL. Used by OptimizedImage
 * when direct S3 access returns 403.
 */
export function toBackendProxyPath(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const isOurS3 =
      host.includes('amazonaws.com') || host.includes('realtrack-images');
    if (isOurS3) {
      const path = parsed.pathname.replace(/^\//, '');
      return `/api/storage/serve/${path}`;
    }
  } catch {
    // Not a valid absolute URL
  }
  return '';
}

/**
 * Check if a URL is a catalog image (no responsive variants available).
 */
export function isCatalogImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).pathname.includes('/catalog-images/');
  } catch {
    return false;
  }
}

export function getVariantUrl(
  url: string | null | undefined,
  suffix: string,
): string {
  if (!url) return '';
  return url.replace(/(\.\w{3,4})(\?.*)?$/, `${suffix}.webp$2`);
}

export function getThumbUrl(url: string | null | undefined): string {
  return getVariantUrl(url, '_thumb');
}

export function getSmallUrl(url: string | null | undefined): string {
  return getVariantUrl(url, '_sm');
}

export function getMediumUrl(url: string | null | undefined): string {
  return getVariantUrl(url, '_medium');
}

export function getLargeUrl(url: string | null | undefined): string {
  return getVariantUrl(url, '_lg');
}

/**
 * Build a responsive srcset string for an image URL.
 * Uses the backend-generated variants for CDN-served images;
 * returns empty string for external URLs that don't have variants.
 */
export function buildSrcSet(url: string | null | undefined): string {
  if (!url) return '';
  // Only build srcset for our CDN URLs (contain our bucket or CloudFront domain)
  if (!isOurCdnUrl(url)) return '';

  const entries = [
    `${toProxyUrl(getSmallUrl(url))} 320w`,
    `${toProxyUrl(getMediumUrl(url))} 800w`,
    `${toProxyUrl(getLargeUrl(url))} 1200w`,
  ];
  return entries.join(', ');
}

/**
 * Check if a URL is served from our CDN (has variant derivatives).
 */
export function isOurCdnUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host.includes('realtrack-images') ||
      host.includes('cloudfront') ||
      host.includes('amazonaws.com')
    );
  } catch {
    return false;
  }
}

/**
 * React onError handler that falls back through variant chain:
 * derived variant → original URL → empty string (shows fallback).
 */
export function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement>,
  originalUrl: string | null | undefined,
): void {
  const img = e.currentTarget;
  if (originalUrl && img.src !== originalUrl) {
    img.onerror = null;
    img.src = originalUrl;
  } else {
    img.onerror = null;
    img.src = '';
  }
}

/**
 * Parse pipe-separated image URLs (eBay format: url1|url2|url3).
 */
export function parseImageUrls(pipeSeparated: string | null | undefined): string[] {
  if (!pipeSeparated) return [];
  return pipeSeparated
    .split('|')
    .map((u) => u.trim())
    .filter((u) => u.startsWith('http'));
}

export function getFirstImageUrl(pipeSeparated: string | null | undefined): string {
  const urls = parseImageUrls(pipeSeparated);
  return urls[0] ?? '';
}
