/**
 * The Fashion publish pipeline records the eBay JPEG masters it produced as
 * two string-array attributes on the listing:
 *   _ebayMasterUrls        S3 URLs of the masters, in photo order
 *   _ebayMasterSourceUrls  the catalog image URLs those masters were made from
 *
 * Publishing uses the masters only while the catalog photos still equal the
 * source list, so editing a listing's photos falls back to the normal path
 * until the pipeline runs again.
 *
 * Only strings, numbers, booleans and string arrays pass the Fashion attribute
 * validator. An object-typed attribute (the first version wrote one) makes every
 * save of the listing fail with "Invalid Fashion attributes", so keep these flat.
 */
export const EBAY_MASTER_URLS_KEY = '_ebayMasterUrls';
export const EBAY_MASTER_SOURCE_URLS_KEY = '_ebayMasterSourceUrls';

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((item) => typeof item === 'string') ? (value as string[]) : null;
}

export function fashionEbayMasterImages(
  product: {
    vertical?: string | null;
    imageUrls?: string[] | null;
    verticalAttributes?: Record<string, unknown> | null;
  } | null,
): string[] | null {
  if (!product || product.vertical !== 'fashion') return null;
  const attrs = product.verticalAttributes ?? {};
  const masters = stringArray(attrs[EBAY_MASTER_URLS_KEY]);
  const sources = stringArray(attrs[EBAY_MASTER_SOURCE_URLS_KEY]);
  if (!masters?.length || !sources) return null;
  const current = (product.imageUrls ?? []).map((u) => u.trim());
  if (current.length !== sources.length || current.some((u, i) => u !== sources[i]))
    return null;
  return masters;
}

/** Attribute values to store for a set of masters and the photos they came from. */
export function ebayMasterAttributes(
  masterUrls: string[],
  sourceUrls: string[],
): Record<string, string[]> {
  return {
    [EBAY_MASTER_URLS_KEY]: [...masterUrls],
    [EBAY_MASTER_SOURCE_URLS_KEY]: sourceUrls.map((u) => u.trim()),
  };
}
