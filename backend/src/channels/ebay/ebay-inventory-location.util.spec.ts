import {
  buildDefaultInventoryLocationPayload,
  pickPreferredInventoryLocationKey,
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
    const key = resolvePreferredMerchantLocationKey(mockConfig() as never, {
      locationKey: 'warehouse-1',
      config: {},
    });
    expect(key).toBe('warehouse-1');
  });

  it('falls back to AE_Dubai merchant location key', () => {
    const key = resolvePreferredMerchantLocationKey(mockConfig() as never, {
      locationKey: null,
      config: {},
    });
    expect(key).toBe(DEFAULT_MERCHANT_LOCATION_KEY);
    expect(key).toBe('AE_Dubai');
  });

  it('builds Dubai warehouse payload with env overrides', () => {
    const config = mockConfig({
      EBAY_DEFAULT_INVENTORY_CITY: 'Abu Dhabi',
      EBAY_DEFAULT_INVENTORY_COUNTRY: 'AE',
    });
    const payload = buildDefaultInventoryLocationPayload(config as never, {
      storeName: 'Test Store',
      config: {},
    });
    expect(payload.locationTypes).toEqual(['WAREHOUSE']);
    expect(payload.merchantLocationStatus).toBe('ENABLED');
    expect(payload.location.address.city).toBe('Abu Dhabi');
    expect(payload.location.address.country).toBe('AE');
    expect(payload.name).toBe('Test Store - Dubai');
  });

  it('defaults ship-from address to Dubai AE', () => {
    const address = resolveInventoryLocationAddress(mockConfig() as never, {
      storeName: 'Shop',
      config: {},
    });
    expect(address.city).toBe('Dubai');
    expect(address.country).toBe('AE');
    expect(address.postalCode).toBeUndefined();
    expect(address.stateOrProvince).toBeUndefined();
  });

  it('never emits US state/ZIP when country is AE even if env sets them', () => {
    const address = resolveInventoryLocationAddress(
      mockConfig({
        EBAY_DEFAULT_INVENTORY_STATE: 'TX',
        EBAY_DEFAULT_INVENTORY_POSTAL_CODE: '77001',
        EBAY_DEFAULT_INVENTORY_COUNTRY: 'AE',
      }) as never,
      { storeName: 'Shop', config: {} },
    );
    expect(address.country).toBe('AE');
    expect(address.stateOrProvince).toBeUndefined();
    expect(address.postalCode).toBeUndefined();
  });

  it('reads ship-from address from store config', () => {
    const config = mockConfig();
    const address = resolveInventoryLocationAddress(config as never, {
      storeName: 'Shop',
      config: {
        shipFromAddress: {
          city: 'Sharjah',
          country: 'AE',
          addressLine1: 'Warehouse 12',
        },
      },
    });
    expect(address.city).toBe('Sharjah');
    expect(address.addressLine1).toBe('Warehouse 12');
    expect(address.country).toBe('AE');
  });

  it('prefers AE_Dubai over legacy US_77001', () => {
    const key = pickPreferredInventoryLocationKey([
      {
        merchantLocationKey: 'US_77001',
        location: { address: { country: 'US', postalCode: '77001' } },
      },
      {
        merchantLocationKey: 'default',
        location: {
          address: { city: 'Houston', country: 'US', postalCode: '77001' },
        },
      },
      {
        merchantLocationKey: 'AE_Dubai',
        location: { address: { city: 'Dubai', country: 'AE' } },
      },
    ]);
    expect(key).toBe('AE_Dubai');
  });

  it('honors explicit key hint when present', () => {
    const key = pickPreferredInventoryLocationKey(
      [
        { merchantLocationKey: 'AE_Dubai' },
        { merchantLocationKey: 'default' },
      ],
      'default',
    );
    expect(key).toBe('default');
  });
});
