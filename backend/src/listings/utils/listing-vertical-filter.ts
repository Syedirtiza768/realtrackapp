import { BadRequestException } from '@nestjs/common';

export const LISTING_VERTICALS = [
  'automotive',
  'fashion',
  'business_industrial',
] as const;

/**
 * Restricts listing records to one vertical.
 *
 * Legacy automotive listings have a NULL vertical, so `automotive` matches
 * NULL as well. This is the same rule AutomotiveAccessScopeService applies.
 * Returns null when no vertical is requested, which leaves results unchanged.
 */
export function listingVerticalFilter(
  vertical: string | null | undefined,
  alias = 'r',
): { sql: string; params: Record<string, string> } | null {
  const value = vertical?.trim();
  if (!value) return null;
  if (!(LISTING_VERTICALS as readonly string[]).includes(value)) {
    throw new BadRequestException(`Unknown vertical: ${value}`);
  }
  if (value === 'automotive') {
    return {
      sql: `(${alias}.vertical = :listingVertical OR ${alias}.vertical IS NULL)`,
      params: { listingVertical: value },
    };
  }
  return {
    sql: `${alias}.vertical = :listingVertical`,
    params: { listingVertical: value },
  };
}
