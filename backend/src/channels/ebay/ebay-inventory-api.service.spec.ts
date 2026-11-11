import { ConfigService } from '@nestjs/config';
import { EbayInventoryApiService } from './ebay-inventory-api.service.js';
import type { EbayLocation } from './ebay-api.types.js';

describe('EbayInventoryApiService Fashion warehouse resolution', () => {
  const dallas: EbayLocation = {
    merchantLocationKey: 'US_Dallas_75234',
    merchantLocationStatus: 'ENABLED',
    location: {
      address: { city: 'Dallas', country: 'US', postalCode: '75234' },
    },
    locationTypes: ['WAREHOUSE'],
  };

  function setup() {
    const service = new EbayInventoryApiService(
      { getApiConfig: () => ({ baseUrl: 'https://api.ebay.com' }) } as never,
      {} as never,
      new ConfigService(),
      {
        findOneBy: jest.fn().mockResolvedValue({
          locationKey: 'AE_Dubai',
          verticalConfig: { enabledVerticals: ['fashion'] },
        }),
      } as never,
    );
    const getLocation = jest.spyOn(service, 'getLocation');
    const getLocations = jest.spyOn(service, 'getLocations');
    const createLocation = jest.spyOn(service, 'createLocation');
    return { service, getLocation, getLocations, createLocation };
  }

  it('uses the enabled marketplace warehouse when the store has a different location', async () => {
    const { service, getLocation, getLocations, createLocation } = setup();
    getLocation.mockResolvedValue(dallas);

    await expect(
      service.ensureMerchantLocation(
        'fashion-store',
        dallas.merchantLocationKey,
      ),
    ).resolves.toBe(dallas.merchantLocationKey);
    expect(getLocation).toHaveBeenCalledWith(
      'fashion-store',
      dallas.merchantLocationKey,
    );
    expect(getLocations).not.toHaveBeenCalled();
    expect(createLocation).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...dallas, merchantLocationStatus: 'DISABLED' } satisfies EbayLocation,
  ])(
    'blocks an unavailable warehouse without falling back (%j)',
    async (location) => {
      const { service, getLocation, getLocations, createLocation } = setup();
      getLocation.mockResolvedValue(location);

      await expect(
        service.ensureMerchantLocation(
          'fashion-store',
          dallas.merchantLocationKey,
        ),
      ).rejects.toThrow('is missing or disabled on eBay');
      expect(getLocations).not.toHaveBeenCalled();
      expect(createLocation).not.toHaveBeenCalled();
    },
  );
});
