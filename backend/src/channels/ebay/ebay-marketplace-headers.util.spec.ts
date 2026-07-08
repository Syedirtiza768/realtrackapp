import {
  resolveMarketplaceId,
  toEbayInventoryApiMarketplaceId,
} from './ebay-marketplace-headers.util.js';

describe('ebay marketplace headers util', () => {
  it('maps EBAY_MOTORS_US to Inventory API offer enum EBAY_MOTORS', () => {
    expect(toEbayInventoryApiMarketplaceId('EBAY_MOTORS_US')).toBe(
      'EBAY_MOTORS',
    );
  });

  it('passes through standard marketplace ids', () => {
    expect(toEbayInventoryApiMarketplaceId('EBAY_US')).toBe('EBAY_US');
    expect(toEbayInventoryApiMarketplaceId('EBAY_GB')).toBe('EBAY_GB');
  });

  it('defaults resolveMarketplaceId to EBAY_MOTORS_US', () => {
    expect(resolveMarketplaceId({})).toBe('EBAY_MOTORS_US');
  });
});
