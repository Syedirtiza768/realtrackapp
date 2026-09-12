/**
 * Return the deterministic, postfix-free Seller SKU used when a canonical
 * Blackline SKU is already owned by another remote eBay item.
 *
 * The alternate namespace is intentionally narrow. Unknown SKU families do
 * not receive an invented fallback and must remain fail-closed.
 */
export function conflictSafeSkuFor(canonicalSku: string): string | null {
  const match = canonicalSku.trim().match(/^BLA-(.+)$/i);
  if (!match?.[1]) return null;
  const candidate = `BLAP-${match[1]}`;
  return /^[A-Za-z0-9._-]{1,50}$/.test(candidate) ? candidate : null;
}
