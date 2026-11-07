/**
 * Placeholder values that eBay and our own templates write into identifier
 * columns when no real value exists (for example `P:UPC` = "Does not apply").
 * These must never be stored as identifiers: `catalog_products.upc` has a
 * global unique index (idx_catalog_upc), so two products sharing a placeholder
 * collide with each other and with any legacy row holding the same placeholder.
 */
const UPC_PLACEHOLDERS = new Set([
  '',
  '-',
  'n/a',
  'na',
  'none',
  'null',
  'does not apply',
]);

/**
 * Returns the trimmed UPC, or null when the value is empty or a placeholder.
 * Use the result for catalog_products.upc and for every UPC duplicate key.
 * Listing-level values (ListingRecord.pUpc) keep the raw value so eBay still
 * receives "Does not apply" when the seller intends it.
 */
export function normalizeCatalogUpc(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (UPC_PLACEHOLDERS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}
