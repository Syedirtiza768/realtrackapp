/**
 * The Fashion publish pipeline writes the eBay JPEG masters it produced to
 * `verticalAttributes._ebayMasterImageSet`, together with the catalog image
 * list they were made from. Publishing uses the masters only while that list
 * is unchanged, so editing a listing's photos falls back to the normal path
 * until the pipeline runs again.
 */
export const EBAY_MASTER_IMAGE_SET_KEY = '_ebayMasterImageSet';

export interface EbayMasterImageSet {
  sourceUrls: string[];
  masterUrls: string[];
  batchId: string | null;
  createdAt: string;
}

export function readEbayMasterImageSet(
  attributes: Record<string, unknown> | null | undefined,
): EbayMasterImageSet | null {
  const raw = attributes?.[EBAY_MASTER_IMAGE_SET_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const set = raw as Partial<EbayMasterImageSet>;
  if (!Array.isArray(set.sourceUrls) || !Array.isArray(set.masterUrls))
    return null;
  return {
    sourceUrls: set.sourceUrls.filter((u): u is string => typeof u === 'string'),
    masterUrls: set.masterUrls.filter((u): u is string => typeof u === 'string'),
    batchId: typeof set.batchId === 'string' ? set.batchId : null,
    createdAt: typeof set.createdAt === 'string' ? set.createdAt : '',
  };
}

export function fashionEbayMasterImages(
  product: {
    vertical?: string | null;
    imageUrls?: string[] | null;
    verticalAttributes?: Record<string, unknown> | null;
  } | null,
): string[] | null {
  if (!product || product.vertical !== 'fashion') return null;
  const set = readEbayMasterImageSet(product.verticalAttributes);
  if (!set?.masterUrls.length) return null;
  const current = (product.imageUrls ?? []).map((u) => u.trim());
  if (
    current.length !== set.sourceUrls.length ||
    current.some((u, i) => u !== set.sourceUrls[i])
  )
    return null;
  return set.masterUrls;
}
