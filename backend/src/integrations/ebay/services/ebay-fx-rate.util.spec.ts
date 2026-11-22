import { convertUsdToCurrency, usdRateEnvName } from './ebay-fx-rate.util';

describe('convertUsdToCurrency', () => {
  it('leaves USD amounts unchanged and needs no rate', () => {
    expect(convertUsdToCurrency(146, 'USD', {})).toBe(146);
  });

  it('converts with the configured USD to GBP rate and rounds to the penny', () => {
    const env = { EBAY_FX_USD_GBP: '0.8' };
    expect(convertUsdToCurrency(146, 'GBP', env)).toBe(116.8);
    expect(convertUsdToCurrency(65, 'GBP', env)).toBe(52);
    expect(
      convertUsdToCurrency(10.01, 'GBP', { EBAY_FX_USD_GBP: '0.79' }),
    ).toBe(7.91);
  });

  it('throws when the rate is not set', () => {
    expect(() => convertUsdToCurrency(146, 'GBP', {})).toThrow(
      'EBAY_FX_USD_GBP must be set to a positive USD to GBP rate',
    );
  });

  it.each(['', '   ', 'abc', '0', '-1'])(
    'throws for an invalid rate %p',
    (value) => {
      expect(() =>
        convertUsdToCurrency(146, 'GBP', { EBAY_FX_USD_GBP: value }),
      ).toThrow('EBAY_FX_USD_GBP must be set');
    },
  );

  it('names the environment variable after the currency', () => {
    expect(usdRateEnvName('GBP')).toBe('EBAY_FX_USD_GBP');
  });
});
