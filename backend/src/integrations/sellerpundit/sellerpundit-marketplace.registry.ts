import { Injectable } from '@nestjs/common';

/** Maps RealTrack eBay marketplace ids to SellerPundit siteId strings. */
const SITE_BY_MARKETPLACE: Record<string, string> = {
  EBAY_US: 'EBAY_US',
  EBAY_MOTORS_US: 'EBAY_MOTORS_US',
  EBAY_GB: 'EBAY_GB',
  EBAY_DE: 'EBAY_DE',
  EBAY_AU: 'EBAY_AU',
};

/** Default RealTrack marketplaces enabled when importing a SellerPundit token. */
const DEFAULT_MARKETPLACES = ['EBAY_US', 'EBAY_MOTORS_US'] as const;

@Injectable()
export class SellerpunditMarketplaceRegistry {
  siteIdFor(marketplaceId: string): string {
    return SITE_BY_MARKETPLACE[marketplaceId] ?? 'EBAY_US';
  }

  defaultMarketplacesForImport(): string[] {
    return [...DEFAULT_MARKETPLACES];
  }

  countryForSite(siteId: string): string {
    if (siteId.includes('GB')) return 'GB';
    if (siteId.includes('DE')) return 'DE';
    if (siteId.includes('AU')) return 'AU';
    return 'US';
  }

  currencyForMarketplace(marketplaceId: string): string {
    if (marketplaceId === 'EBAY_GB') return 'GBP';
    if (marketplaceId === 'EBAY_DE') return 'EUR';
    if (marketplaceId === 'EBAY_AU') return 'AUD';
    return 'USD';
  }
}
