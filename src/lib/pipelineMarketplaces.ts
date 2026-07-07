/** Canonical pipeline marketplace codes — US, UK, AU, DE. */

export const PIPELINE_MARKETPLACE_CODES = ['US', 'UK', 'AU', 'DE'] as const;

export type PipelineMarketplaceCode = (typeof PIPELINE_MARKETPLACE_CODES)[number];

export const PIPELINE_MARKETPLACE_LABELS: Record<PipelineMarketplaceCode, string> = {
  US: 'United States',
  UK: 'United Kingdom',
  AU: 'Australia',
  DE: 'Germany',
};

export function pipelineMarketplaceToEbayId(code: PipelineMarketplaceCode): string {
  switch (code) {
    case 'US':
      return 'EBAY_MOTORS_US';
    case 'UK':
      return 'EBAY_GB';
    case 'AU':
      return 'EBAY_AU';
    case 'DE':
      return 'EBAY_DE';
    default:
      return 'EBAY_MOTORS_US';
  }
}

const EBAY_ID_TO_PIPELINE: Record<string, PipelineMarketplaceCode> = {
  EBAY_US: 'US',
  EBAY_MOTORS_US: 'US',
  EBAY_MOTORS: 'US',
  EBAY_GB: 'UK',
  EBAY_AU: 'AU',
  EBAY_DE: 'DE',
};

export function ebayMarketplaceIdToPipelineCode(
  ebayMarketplaceId: string | null | undefined,
): PipelineMarketplaceCode | null {
  if (!ebayMarketplaceId) return null;
  const upper = ebayMarketplaceId.toUpperCase();
  if (EBAY_ID_TO_PIPELINE[upper]) return EBAY_ID_TO_PIPELINE[upper];
  if (upper.startsWith('EBAY_')) {
    const suffix = upper.replace('EBAY_', '');
    if (suffix === 'MOTORS_US' || suffix === 'MOTORS') return 'US';
    if (suffix === 'GB') return 'UK';
    if ((PIPELINE_MARKETPLACE_CODES as readonly string[]).includes(suffix)) {
      return suffix as PipelineMarketplaceCode;
    }
  }
  return null;
}

export function storeMatchesPipelineMarketplace(
  ebayMarketplaceId: string | null | undefined,
  code: PipelineMarketplaceCode,
): boolean {
  if (!ebayMarketplaceId) return false;
  const normalized = ebayMarketplaceId.toUpperCase();
  if (code === 'US') {
    return (
      normalized === 'EBAY_US' ||
      normalized === 'EBAY_MOTORS_US' ||
      normalized === 'EBAY_MOTORS'
    );
  }
  return normalized === pipelineMarketplaceToEbayId(code);
}
