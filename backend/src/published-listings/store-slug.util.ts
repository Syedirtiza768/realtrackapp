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
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => normalizeStoreSlug(s))
        .filter(Boolean),
    ),
  ];
}
