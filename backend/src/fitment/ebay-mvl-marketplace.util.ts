import { MARKETPLACE_CATEGORY_TREE_IDS } from '../channels/ebay/ebay-marketplace-tree.util.js';

export type MvlMarketplace = 'US' | 'AU' | 'DE' | 'GB';

const TREE_ID_TO_MARKETPLACE: Record<string, MvlMarketplace> = {
  '0': 'US',
  '15': 'AU',
  '77': 'DE',
  '3': 'GB',
};

const SHORT_CODE_TO_MVL: Record<string, MvlMarketplace> = {
  US: 'US',
  AU: 'AU',
  DE: 'DE',
  GB: 'GB',
  UK: 'GB',
};

const EBAY_ID_TO_MVL: Record<string, MvlMarketplace> = {
  EBAY_US: 'US',
  EBAY_MOTORS_US: 'US',
  EBAY_AU: 'AU',
  EBAY_DE: 'DE',
  EBAY_GB: 'GB',
};

/** Resolve eBay category tree ID to MVL marketplace code. */
export function resolveMvlMarketplaceFromTreeId(
  treeId?: string | null,
): MvlMarketplace {
  if (!treeId) return 'US';
  return TREE_ID_TO_MARKETPLACE[treeId] ?? 'US';
}

/** Resolve listing marketplace / eBay site id to MVL marketplace code. */
export function resolveMvlMarketplace(
  marketplace?: string | null,
): MvlMarketplace {
  if (!marketplace) return 'US';
  const upper = marketplace.toUpperCase();
  if (SHORT_CODE_TO_MVL[upper]) return SHORT_CODE_TO_MVL[upper];
  if (EBAY_ID_TO_MVL[upper]) return EBAY_ID_TO_MVL[upper];
  if (upper.includes('EBAY_')) {
    const suffix = upper.replace('EBAY_', '');
    if (suffix === 'MOTORS_US') return 'US';
    if (SHORT_CODE_TO_MVL[suffix]) return SHORT_CODE_TO_MVL[suffix];
  }
  return 'US';
}

export function mvlMarketplaceToTreeId(marketplace: MvlMarketplace): string {
  const ebayId =
    marketplace === 'US'
      ? 'EBAY_US'
      : marketplace === 'GB'
        ? 'EBAY_GB'
        : `EBAY_${marketplace}`;
  return MARKETPLACE_CATEGORY_TREE_IDS[ebayId] ?? '0';
}
