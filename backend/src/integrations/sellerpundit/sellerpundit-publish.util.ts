export type SellerpunditPublishFallbackMode =
  | 'auto'
  | 'sellerpundit'
  | 'direct_ebay';

/**
 * SellerPundit production defect: bulk-create SQL references `tokens.marketplaceId`
 * while the column is `marketPlaceId`. Publish must recover via direct eBay API.
 */
function sellerpunditErrorText(error?: string, errors?: string[]): string {
  return [error, ...(errors ?? [])].filter(Boolean).join(' ');
}

export function isSellerpunditGatewayTimeoutError(
  error?: string,
  errors?: string[],
): boolean {
  const text = sellerpunditErrorText(error, errors).toLowerCase();
  return (
    text.includes('504') ||
    text.includes('gateway time-out') ||
    text.includes('gateway timeout') ||
    text.includes('gateway timed out')
  );
}

export function isSellerpunditBulkCreatePlatformError(
  error?: string,
  errors?: string[],
): boolean {
  const text = sellerpunditErrorText(error, errors).toLowerCase();
  if (!text.trim()) return false;
  return (
    isSellerpunditGatewayTimeoutError(error, errors) ||
    text.includes('tokens.marketplaceid does not exist') ||
    text.includes('column tokens.marketplaceid') ||
    text.includes('marketplaceid does not exist') ||
    text.includes('failed to process file') ||
    text.includes('bulk-create-using-api') ||
    text.includes('bulk create')
  );
}

/** SellerPundit proxied eBay errors where direct Inventory API publish may succeed. */
export function isSellerpunditRecoverableEbayPublishError(
  error?: string,
  errors?: string[],
): boolean {
  const text = sellerpunditErrorText(error, errors);
  if (!text.trim()) return false;
  if (
    /non-compliant domestic return policy/i.test(text) ||
    /parts\.?&.?accessories return policy/i.test(text) ||
    /return window to 30-days/i.test(text) ||
    /ShippingCostPaidByOption/i.test(text) ||
    /not P&A-compliant/i.test(text)
  ) {
    return false;
  }
  return (
    /invalid.*(?:fulfillment|shipping|payment|return) policy/i.test(text) ||
    /status code 400/i.test(text)
  );
}

export function tagSellerpunditPlatformError(result: {
  success: boolean;
  error?: string;
  errors?: string[];
  platformError?: boolean;
}): { platformError?: boolean } {
  if (result.success) return {};
  if (
    result.platformError ||
    isSellerpunditBulkCreatePlatformError(result.error, result.errors)
  ) {
    return { platformError: true };
  }
  return {};
}

export function parseSellerpunditPublishFallbackMode(
  raw: string | undefined,
): SellerpunditPublishFallbackMode {
  const mode = (raw ?? 'auto').trim().toLowerCase();
  if (mode === 'sellerpundit' || mode === 'direct_ebay') return mode;
  return 'auto';
}

/** Whether SellerPundit bulk-create should be attempted before direct eBay fallback. */
export function shouldAttemptSellerpunditBulkCreate(
  fallbackMode: SellerpunditPublishFallbackMode,
  forceDirectEbay?: boolean,
): boolean {
  if (forceDirectEbay || fallbackMode === 'direct_ebay') return false;
  return true;
}

/** Whether a failed bulk-create should transparently fall back to direct eBay. */
export function shouldFallbackFromSellerpunditBulkCreate(
  fallbackMode: SellerpunditPublishFallbackMode,
  result: {
    success: boolean;
    error?: string;
    errors?: string[];
    platformError?: boolean;
  },
): boolean {
  if (result.success || fallbackMode === 'sellerpundit') return false;
  return (
    result.platformError === true ||
    isSellerpunditBulkCreatePlatformError(result.error, result.errors) ||
    isSellerpunditRecoverableEbayPublishError(result.error, result.errors)
  );
}
