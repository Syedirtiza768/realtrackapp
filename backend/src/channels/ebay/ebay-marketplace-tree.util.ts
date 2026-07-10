/**
 * Canonical eBay category tree IDs per marketplace.
 *
 * These are the values returned by eBay's
 * `get_default_category_tree_id?marketplace_id=...` endpoint and must match
 * what the Taxonomy API expects for category suggestions, compatibility
 * properties, and MVL value lookups.
 *
 * NOTE: EBAY_AU's tree ID is `15` (verified live against the eBay Taxonomy
 * API). Earlier code assumed `100`, which returns no results. `EBAY_MOTORS_US`
 * shares the US Motors P&A tree (`0`).
 */
export const MARKETPLACE_CATEGORY_TREE_IDS: Record<string, string> = {
  EBAY_US: '0',
  EBAY_MOTORS_US: '100',
  EBAY_GB: '3',
  EBAY_DE: '77',
  EBAY_AU: '15',
};

/** Short marketplace codes used internally (listing_records.marketplace). */
const SHORT_CODE_TO_EBAY: Record<string, string> = {
  US: 'EBAY_US',
  UK: 'EBAY_GB',
  AU: 'EBAY_AU',
  DE: 'EBAY_DE',
  GB: 'EBAY_GB',
};

/**
 * Resolve a marketplace identifier (short code like 'US'/'AU'/'DE' or a full
 * eBay marketplace id like 'EBAY_AU') to its canonical eBay category tree ID.
 * Falls back to the US Motors P&A tree (`0`) when the marketplace is unknown
 * or null (base listings carry no marketplace).
 */
export function resolveCategoryTreeId(marketplace?: string | null): string {
  if (!marketplace) return '0';
  const ebayMkt = marketplace.includes('EBAY_')
    ? marketplace
    : (SHORT_CODE_TO_EBAY[marketplace] ?? 'EBAY_US');
  return MARKETPLACE_CATEGORY_TREE_IDS[ebayMkt] ?? '0';
}
