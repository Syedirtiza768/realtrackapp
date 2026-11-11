/** Storage-key helpers shared by Fashion photo upload, analysis and generated images. */

/** Filesystem-safe SKU stem for stored filenames (`<SKU>-<timestamp>-<id>.webp`). Empty when no SKU. */
export function fashionSkuStem(sku?: string | null): string {
  return (sku ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Resolves `/api/storage/serve/<key>` URLs (relative or absolute) to their storage key. */
export function keyFromServeUrl(url: string): string | null {
  try {
    const parsed = new URL(url, 'http://localhost');
    const marker = '/api/storage/serve/';
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

/** True only for keys this organization's Fashion workspace wrote. */
export function isOrganizationFashionKey(key: string, organizationId: string) {
  return (
    key.includes(`fashion/intake/${organizationId}/`) ||
    key.includes(`fashion/size-charts/${organizationId}/`)
  );
}
