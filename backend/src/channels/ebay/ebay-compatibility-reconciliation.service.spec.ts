import { BadRequestException } from '@nestjs/common';
import { EbayCompatibilityReconciliationService } from './ebay-compatibility-reconciliation.service.js';

const row = (year: string) => ({
  compatibilityProperties: [
    { name: 'Make', value: 'Mini' },
    { name: 'Model', value: 'Cooper' },
    { name: 'Year', value: year },
  ],
});

describe('EbayCompatibilityReconciliationService', () => {
  it('clears Inventory API compatibility and verifies an empty result', async () => {
    const inventory = {
      deleteCompatibility: jest.fn().mockResolvedValue(undefined),
      getCompatibility: jest.fn().mockResolvedValue({ compatibleProducts: [] }),
      setCompatibility: jest.fn(),
    };
    const trading = { getItemDetails: jest.fn(), replaceItemCompatibility: jest.fn() };
    const service = new EbayCompatibilityReconciliationService(
      inventory as any,
      trading as any,
    );

    await service.syncInventory('store-1', 'SKU-1');

    expect(inventory.deleteCompatibility).toHaveBeenCalledWith(
      'store-1',
      'SKU-1',
    );
    expect(inventory.setCompatibility).not.toHaveBeenCalled();
  });

  it('rejects stale rows instead of treating them as a successful readback', async () => {
    const inventory = {
      deleteCompatibility: jest.fn(),
      getCompatibility: jest
        .fn()
        .mockResolvedValue({ compatibleProducts: [row('2007')] }),
      setCompatibility: jest.fn(),
    };
    const service = new EbayCompatibilityReconciliationService(
      inventory as any,
      {} as any,
    );

    await expect(
      service.syncInventory('store-1', 'SKU-1', {
        compatibleProducts: [row('2018')],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revises a legacy listing and verifies the Trading API readback', async () => {
    const inventory = {};
    const trading = {
      getItemDetails: jest
        .fn()
        .mockResolvedValueOnce({ compatibility: { compatibleProducts: [row('2007')] } })
        .mockResolvedValueOnce({ compatibility: { compatibleProducts: [row('2018')] } }),
      replaceItemCompatibility: jest.fn().mockResolvedValue(undefined),
    };
    const service = new EbayCompatibilityReconciliationService(
      inventory as any,
      trading as any,
    );
    const expected = { compatibleProducts: [row('2018')] };

    await service.syncLiveListing(
      'store-1',
      'item-1',
      'EBAY_MOTORS_US',
      'SKU-1',
      expected,
    );

    expect(trading.replaceItemCompatibility).toHaveBeenCalledWith(
      'store-1',
      'item-1',
      expected,
      'EBAY_MOTORS_US',
      undefined,
    );
    expect(trading.getItemDetails).toHaveBeenCalledTimes(2);
  });
});
