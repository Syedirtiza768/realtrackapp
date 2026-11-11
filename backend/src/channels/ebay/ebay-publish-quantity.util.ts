export const EBAY_MAX_PUBLISH_QUANTITY = 10;

export function capEbayPublishQuantity(quantity: number): number {
  return Math.min(quantity, EBAY_MAX_PUBLISH_QUANTITY);
}
