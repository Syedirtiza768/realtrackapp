export const DEFAULT_LOW_VALUE_MAX_PRICE = 50;

export function getLowValueMaxPrice(env = {}) {
  const n = Number(env.AI_LOW_VALUE_MAX_PRICE ?? DEFAULT_LOW_VALUE_MAX_PRICE);
  return Number.isNaN(n) ? DEFAULT_LOW_VALUE_MAX_PRICE : n;
}

export function isLowValueSku(price, lowValueMaxPrice = DEFAULT_LOW_VALUE_MAX_PRICE) {
  if (price == null || price === '') return false;
  const n = Number(price);
  if (Number.isNaN(n)) return false;
  return n < lowValueMaxPrice;
}

export function getEnrichmentProfile(price, lowValueMaxPrice = DEFAULT_LOW_VALUE_MAX_PRICE) {
  return isLowValueSku(price, lowValueMaxPrice) ? 'compact' : 'full';
}

export function compactJson(value) {
  return JSON.stringify(value);
}
