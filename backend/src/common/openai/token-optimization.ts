/**
 * Token optimization helpers — profile selection without changing models.
 */

export const DEFAULT_LOW_VALUE_MAX_PRICE = 50;

export type EnrichmentProfile = 'compact' | 'full';

export function getLowValueMaxPrice(
  configured?: number | string | null,
): number {
  const n = Number(configured ?? DEFAULT_LOW_VALUE_MAX_PRICE);
  return Number.isNaN(n) ? DEFAULT_LOW_VALUE_MAX_PRICE : n;
}

export function isLowValueSku(
  price?: number | string | null,
  lowValueMaxPrice = DEFAULT_LOW_VALUE_MAX_PRICE,
): boolean {
  if (price == null || price === '') return false;
  const n = typeof price === 'number' ? price : Number(price);
  if (Number.isNaN(n)) return false;
  return n < lowValueMaxPrice;
}

export function getEnrichmentProfile(
  price?: number | string | null,
  lowValueMaxPrice = DEFAULT_LOW_VALUE_MAX_PRICE,
): EnrichmentProfile {
  return isLowValueSku(price, lowValueMaxPrice) ? 'compact' : 'full';
}

/** Compact JSON for prompts — no pretty-print whitespace. */
export function compactJson(value: unknown): string {
  return JSON.stringify(value);
}
