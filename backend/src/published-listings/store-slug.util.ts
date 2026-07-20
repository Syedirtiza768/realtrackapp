/**
 * Maps public eBay storefront URL slugs (ebay.com/str/{slug}) to RealTrack stores.
 * Prefer stores.config.storeSlug when set; these aliases are a documented fallback.
 */
export const EBAY_STORE_SLUG_ALIASES: Record<string, string[]> = {
  // https://www.ebay.com/str/salvagea — active K. Salvage Auto Parts account
  salvagea: ['3b84b063-3811-481f-a61d-f7846a03558f'],
  salvage: ['3b84b063-3811-481f-a61d-f7846a03558f'],
  // https://www.ebay.com/str/blacklineusedautoparts
  blacklineusedautoparts: ['d16199c4-55b5-429e-ad27-892bed94e00d'],
  blackline: ['d16199c4-55b5-429e-ad27-892bed94e00d'],
};

/**
 * Default published-listings reader scope when no storeId/storeSlug is provided.
 * Override with PUBLISHED_LISTINGS_DEFAULT_STORE_SLUGS, or pass storeSlug=all for every store.
 */
export const DEFAULT_PUBLISHED_LISTINGS_STORE_SLUGS = 'salvagea,blackline';

export function resolveDefaultPublishedListingsStoreSlugs(): string {
  const fromEnv = process.env.PUBLISHED_LISTINGS_DEFAULT_STORE_SLUGS?.trim();
  if (fromEnv === '' || fromEnv === 'all' || fromEnv === '*') return '';
  return fromEnv || DEFAULT_PUBLISHED_LISTINGS_STORE_SLUGS;
}

export function normalizeStoreSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?ebay\.com\/str\//i, '')
    .replace(/\/+$/, '')
    .replace(/[^a-z0-9_-]/g, '');
}

export function parseStoreSlugQuery(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'all' || normalized === '*') return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => normalizeStoreSlug(s))
        .filter(Boolean),
    ),
  ];
}

/** True when the caller explicitly asked for every store (no slug filter). */
export function isAllStoresSlugQuery(raw: string | undefined): boolean {
  const normalized = raw?.trim().toLowerCase();
  return normalized === 'all' || normalized === '*';
}
