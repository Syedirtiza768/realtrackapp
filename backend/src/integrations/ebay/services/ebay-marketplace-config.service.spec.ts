import { EbayMarketplaceConfigService } from './ebay-marketplace-config.service';

describe('EbayMarketplaceConfigService', () => {
  const svc = new EbayMarketplaceConfigService();

  it('returns config for EBAY_MOTORS_US', () => {
    const c = svc.require('EBAY_MOTORS_US');
    expect(c.currency).toBe('USD');
    expect(c.supportsMotorsFitment).toBe(true);
  });

  it('throws for unknown marketplace', () => {
    expect(() => svc.require('EBAY_XX')).toThrow(/Unsupported marketplace/);
  });

  it('marks DE as requiring localized description', () => {
    expect(svc.require('EBAY_DE').requiresLocalizedDescription).toBe(true);
  });
});
