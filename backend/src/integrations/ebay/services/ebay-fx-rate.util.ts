/**
 * USD to marketplace-currency conversion for eBay listing prices.
 *
 * Catalogue prices are stored in USD. A listing on a marketplace whose currency is not USD
 * (EBAY_GB, GBP) needs its price converted with an explicitly configured rate, read from
 * `EBAY_FX_USD_<CURRENCY>`, for example `EBAY_FX_USD_GBP=0.79`. The rate has no default:
 * when the variable is missing or is not a positive number, the conversion throws, so no
 * listing is built with a guessed rate.
 */
export function usdRateEnvName(currency: string): string {
  return `EBAY_FX_USD_${currency}`;
}

export function convertUsdToCurrency(
  amountUsd: number,
  currency: string,
  env: NodeJS.ProcessEnv = process.env,
): number {
  if (currency === 'USD') return amountUsd;
  const name = usdRateEnvName(currency);
  const raw = env[name]?.trim() ?? '';
  const rate = raw === '' ? Number.NaN : Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      `${name} must be set to a positive USD to ${currency} rate before ${currency} listings can be built`,
    );
  }
  return Math.round(amountUsd * rate * 100) / 100;
}
