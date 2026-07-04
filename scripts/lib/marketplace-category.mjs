/**
 * Per-marketplace eBay Motors category tree configuration for the enrichment pipeline.
 * Category IDs are marketplace-specific — never reuse a US ID on AU/DE listings.
 */

/** @typedef {'US' | 'AU' | 'DE'} MarketplaceCode */

/** @typedef {{ code: MarketplaceCode; ebayMarketplaceId: string; treeId: string; label: string; fallbackQuery: string }} MarketplaceConfig */

export const PIPELINE_MARKETPLACES = /** @type {const} */ (['US', 'AU', 'DE']);

/** Verified via eBay Taxonomy API + sync-ebay-store-categories.mjs */
export const MARKETPLACE_CONFIG = /** @type {Record<MarketplaceCode, MarketplaceConfig>} */ ({
  US: {
    code: 'US',
    ebayMarketplaceId: 'EBAY_MOTORS_US',
    treeId: '0',
    label: 'eBay Motors US',
    fallbackQuery: 'car truck parts accessories',
  },
  AU: {
    code: 'AU',
    ebayMarketplaceId: 'EBAY_AU',
    treeId: '15',
    label: 'eBay Motors AU',
    fallbackQuery: 'car truck parts accessories',
  },
  DE: {
    code: 'DE',
    ebayMarketplaceId: 'EBAY_DE',
    treeId: '77',
    label: 'eBay DE Auto & Motorrad',
    fallbackQuery: 'auto ersatzteile',
  },
});

/**
 * @param {string} code
 * @returns {MarketplaceConfig}
 */
export function getMarketplaceConfig(code) {
  const cfg = MARKETPLACE_CONFIG[code];
  if (!cfg) throw new Error(`Unknown marketplace code: ${code}`);
  return cfg;
}

/**
 * @param {object} part
 * @param {MarketplaceCode} marketplace
 */
export function getPartCategory(part, marketplace) {
  if (part._categories?.[marketplace]) return part._categories[marketplace];
  if (marketplace === 'US' && part._category) return part._category;
  return null;
}

/**
 * @param {object} part
 * @param {MarketplaceCode} marketplace
 * @param {object|null} category
 */
export function setPartCategory(part, marketplace, category) {
  if (!part._categories) part._categories = {};
  if (category) {
    part._categories[marketplace] = { ...category, marketplace, treeId: getMarketplaceConfig(marketplace).treeId };
  } else {
    part._categories[marketplace] = null;
  }
  if (marketplace === 'US') {
    part._category = category ? part._categories[marketplace] : null;
  }
}

/**
 * Build taxonomy suggestion keywords for a part lookup.
 * @param {{ parts: object[] }} lookup
 * @param {(part: object) => { make?: string }} getVehicle
 * @param {string} [extraHint]
 */
export function buildCategoryKeywords(lookup, getVehicle, extraHint = '') {
  const part = lookup.parts[0];
  const vehicle = getVehicle(part) || {};
  const base = `${vehicle.make || ''} ${part.partName || ''} ${extraHint}`.replace(/[^\w\s]/g, ' ').trim();
  return base.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize a category result object for storage.
 * @param {object} raw
 * @param {MarketplaceCode} marketplace
 * @param {string} source
 */
export function normalizeCategoryResult(raw, marketplace, source) {
  if (!raw?.categoryId) return null;
  const cfg = getMarketplaceConfig(marketplace);
  return {
    categoryId: String(raw.categoryId),
    categoryName: raw.categoryName || '',
    categoryPath: raw.categoryPath || '',
    source,
    marketplace,
    treeId: cfg.treeId,
    aiConfidence: raw.aiConfidence ?? null,
    aiModel: raw.aiModel ?? null,
  };
}
