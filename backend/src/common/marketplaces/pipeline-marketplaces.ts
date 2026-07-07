/**
 * Canonical pipeline / listing marketplace short codes.
 * User-facing: US, UK, AU, DE — known across upload UI, pipeline jobs, and catalog.
 */
export const PIPELINE_MARKETPLACE_CODES = ['US', 'UK', 'AU', 'DE'] as const;

export type PipelineMarketplaceCode = (typeof PIPELINE_MARKETPLACE_CODES)[number];

/** Output XLSX files the enrichment pipeline generates. */
export const PIPELINE_OUTPUT_MARKETPLACE_CODES = ['US', 'UK', 'AU', 'DE'] as const;

export type PipelineOutputMarketplaceCode =
  (typeof PIPELINE_OUTPUT_MARKETPLACE_CODES)[number];

const EBAY_ID_TO_PIPELINE: Record<string, PipelineMarketplaceCode> = {
  EBAY_US: 'US',
  EBAY_MOTORS_US: 'US',
  EBAY_MOTORS: 'US',
  EBAY_GB: 'UK',
  EBAY_AU: 'AU',
  EBAY_DE: 'DE',
};

/** Map a pipeline short code to primary eBay marketplace id for store matching. */
export function pipelineMarketplaceToEbayId(
  code: PipelineMarketplaceCode,
): string {
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

export function isPipelineMarketplaceCode(
  value: string,
): value is PipelineMarketplaceCode {
  return (PIPELINE_MARKETPLACE_CODES as readonly string[]).includes(value);
}

/** True when a store's eBay marketplace id belongs to the selected pipeline marketplace. */
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
    if (isPipelineMarketplaceCode(suffix)) return suffix;
  }
  return null;
}

/** Whether job-level profile defaults should apply to an output file marketplace. */
export function shouldApplyJobProfilesToOutput(
  outputMarketplace: PipelineOutputMarketplaceCode,
  jobMarketplace: PipelineMarketplaceCode | null | undefined,
): boolean {
  if (!jobMarketplace) return false;
  return outputMarketplace === jobMarketplace;
}

/** Whether job-level profile defaults should fill catalog master (US upsert) blanks. */
export function shouldApplyJobProfilesToCatalogMaster(
  jobMarketplace: PipelineMarketplaceCode | null | undefined,
): boolean {
  return jobMarketplace === 'US' || jobMarketplace === 'UK';
}
