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
const DEFAULT_MARKETPLACES = [
  'EBAY_US',
  'EBAY_MOTORS_US',
  'EBAY_DE',
  'EBAY_GB',
  'EBAY_AU',
] as const;

const SVG_REGION_TO_MARKETPLACE: Record<string, string> = {
  DE: 'EBAY_DE',
  UK: 'EBAY_GB',
  AU: 'EBAY_AU',
  US: 'EBAY_US',
};

/** Infer eBay marketplace from SellerPundit account naming (e.g. "(SVG-DE) German Salvage"). */
export function inferMarketplaceFromAccountName(
  accountName: string,
): string | null {
  const trimmed = accountName.trim();
  if (!trimmed) return null;

  const svg = trimmed.match(/\(\s*SVG-([A-Z]{2})\s*\)/i);
  if (svg) {
    const mp = SVG_REGION_TO_MARKETPLACE[svg[1].toUpperCase()];
    if (mp) return mp;
  }

  if (/\bAutos?\s+De\b/i.test(trimmed)) return 'EBAY_DE';
  if (/\bBlackline\s+Uk\b/i.test(trimmed) || /\bUk\b$/i.test(trimmed)) {
    return 'EBAY_GB';
  }
  if (/\bautos?\s*au\b/i.test(trimmed) || /\bAU\b/.test(trimmed)) {
    return 'EBAY_AU';
  }

  return null;
}

@Injectable()
export class SellerpunditMarketplaceRegistry {
  siteIdFor(marketplaceId: string): string {
    return SITE_BY_MARKETPLACE[marketplaceId] ?? 'EBAY_US';
  }

  defaultMarketplacesForImport(): string[] {
    return [...DEFAULT_MARKETPLACES];
  }

  inferMarketplaceFromAccountName(accountName: string): string | null {
    return inferMarketplaceFromAccountName(accountName);
  }

  resolveMarketplaceForAccount(
    accountName: string,
    fallbackMarketplaceId: string,
  ): string {
    return (
      inferMarketplaceFromAccountName(accountName)?.trim() ||
      fallbackMarketplaceId.trim() ||
      'EBAY_MOTORS_US'
    );
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
