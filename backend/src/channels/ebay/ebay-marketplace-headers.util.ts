import type { EbayMarketplaceConfig } from '../../integrations/ebay/services/ebay-marketplace-config.types.js';

/** eBay REST APIs expect BCP-47 tags with hyphens (en-US), not underscores (en_US). */
export function toContentLanguage(locale: string): string {
  return locale.replace(/_/g, '-');
}

/**
 * RealTrack / Account API marketplace ids (e.g. EBAY_MOTORS_US) vs Inventory API
 * offer body MarketplaceEnum (e.g. EBAY_MOTORS). Headers keep the internal id.
 */
const INVENTORY_OFFER_MARKETPLACE: Record<string, string> = {
  EBAY_MOTORS_US: 'EBAY_MOTORS',
};

export function toEbayInventoryApiMarketplaceId(marketplaceId: string): string {
  const trimmed = marketplaceId.trim();
  return INVENTORY_OFFER_MARKETPLACE[trimmed] ?? trimmed;
}

export function resolveMarketplaceId(store: {
  ebayMarketplaceId?: string | null;
  config?: Record<string, unknown> | null;
}): string {
  const fromColumn = store.ebayMarketplaceId?.trim();
  if (fromColumn) return fromColumn;

  const config = store.config ?? {};
  const fromConfig =
    typeof config.marketplace === 'string' ? config.marketplace.trim() : '';
  if (fromConfig) return fromConfig;

  return 'EBAY_MOTORS_US';
}

export function marketplaceRequestHeaders(
  marketplaceId: string,
  config: EbayMarketplaceConfig | null,
): Record<string, string> {
  const locale = config?.locale ?? 'en_US';
  return {
    'Content-Language': toContentLanguage(locale),
    'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
  };
}
