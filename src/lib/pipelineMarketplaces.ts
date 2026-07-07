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
