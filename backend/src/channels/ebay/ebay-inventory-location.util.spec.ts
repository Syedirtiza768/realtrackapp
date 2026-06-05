import {
  buildDefaultInventoryLocationPayload,
  resolveInventoryLocationAddress,
  resolvePreferredMerchantLocationKey,
  DEFAULT_MERCHANT_LOCATION_KEY,
} from './ebay-inventory-location.util.js';

function mockConfig(values: Record<string, string> = {}): {
  get: (key: string, fallback?: string) => string;
} {
  return {
    get: (key: string, fallback = '') => values[key] ?? fallback,
  };
}

describe('ebay-inventory-location.util', () => {
  it('uses store locationKey when set', () => {
    const key = resolvePreferredMerchantLocationKey(
      mockConfig() as never,
      { locationKey: 'warehouse-1', config: {} },
    );
    expect(key).toBe('warehouse-1');
  });

  it('falls back to default merchant location key', () => {
    const key = resolvePreferredMerchantLocationKey(
      mockConfig() as never,
      { locationKey: null, config: {} },
    );
    expect(key).toBe(DEFAULT_MERCHANT_LOCATION_KEY);
  });

  it('builds US warehouse payload with env overrides', () => {
    const config = mockConfig({
      EBAY_DEFAULT_INVENTORY_CITY: 'Dallas',
      EBAY_DEFAULT_INVENTORY_STATE: 'TX',
      EBAY_DEFAULT_INVENTORY_POSTAL_CODE: '75201',
      EBAY_DEFAULT_INVENTORY_COUNTRY: 'US',
    });
    const payload = buildDefaultInventoryLocationPayload(config as never, {
      storeName: 'Test Store',
      config: {},
    });
    expect(payload.locationTypes).toEqual(['WAREHOUSE']);
    expect(payload.merchantLocationStatus).toBe('ENABLED');
    expect(payload.location.address.city).toBe('Dallas');
    expect(payload.location.address.country).toBe('US');
  });

  it('reads ship-from address from store config', () => {
    const config = mockConfig();
    const address = resolveInventoryLocationAddress(config as never, {
      storeName: 'Shop',
      config: {
        shipFromAddress: {
          city: 'Austin',
          stateOrProvince: 'TX',
          postalCode: '78701',
          country: 'US',
          addressLine1: '100 Main St',
        },
      },
    });
    expect(address.city).toBe('Austin');
    expect(address.addressLine1).toBe('100 Main St');
  });
});
