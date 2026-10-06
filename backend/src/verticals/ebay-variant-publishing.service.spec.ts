import { BadRequestException } from '@nestjs/common';
import { EbayVariantPublishingService } from './ebay-variant-publishing.service.js';
import type { ProductFamily } from './entities/product-family.entity.js';
import type { ProductVariant } from './entities/product-variant.entity.js';

describe('EbayVariantPublishingService', () => {
  const service = Object.create(
    EbayVariantPublishingService.prototype,
  ) as EbayVariantPublishingService;

  const family = {
    vertical: 'fashion',
    name: 'Everyday Shirt',
  } as ProductFamily;

  it('builds an eBay item-group payload from shared variant aspects', async () => {
    const payload = await service.buildGroupPayload(family, [
      {
        sku: 'SHIRT-M-NAVY',
        vertical: 'fashion',
        attributes: { size: 'M', color: 'Navy' },
      },
      {
        sku: 'SHIRT-L-NAVY',
        vertical: 'fashion',
        attributes: { size: 'L', color: 'Navy' },
      },
    ] as ProductVariant[]);

    expect(payload).toEqual({
      variantSKUs: ['SHIRT-M-NAVY', 'SHIRT-L-NAVY'],
      title: 'Everyday Shirt',
      description: 'Everyday Shirt',
      variesBy: {
        specifications: [
          { name: 'size', values: ['M', 'L'] },
          { name: 'color', values: ['Navy'] },
        ],
      },
    });
  });

  it('keeps automotive on the existing Motors workflow', async () => {
    await expect(
      service.buildGroupPayload(
        { ...family, vertical: 'automotive' } as ProductFamily,
        [
          {
            sku: 'AUTO-1',
            vertical: 'automotive',
            attributes: { fitment: 'Sedan' },
          },
        ] as ProductVariant[],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires at least one variation aspect', async () => {
    await expect(
      service.buildGroupPayload(family, [
        { sku: 'SHIRT-1', vertical: 'fashion', attributes: {} },
      ] as ProductVariant[]),
    ).rejects.toThrow('At least one shared variation aspect is required');
  });

  it('fails closed instead of publishing new Inventory API item groups', async () => {
    const inventoryApi = {
      createOrReplaceItem: jest.fn(),
      createOffer: jest.fn(),
      createOrReplaceInventoryItemGroup: jest.fn(),
      publishOfferByInventoryItemGroup: jest.fn(),
    };
    const serviceWithPilot = Object.assign(
      Object.create(EbayVariantPublishingService.prototype),
      {
        featureFlags: { isEnabled: jest.fn().mockResolvedValue(true) },
        inventoryApi,
      },
    ) as EbayVariantPublishingService;

    await expect(serviceWithPilot.publishFamily({} as never)).rejects.toThrow(
      'until it can create Seller Hub-managed Trading API listings',
    );
    expect(inventoryApi.createOrReplaceItem).not.toHaveBeenCalled();
    expect(inventoryApi.createOffer).not.toHaveBeenCalled();
  });
});
