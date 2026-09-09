import { BadRequestException } from '@nestjs/common';
import { EbayVariantPublishingService } from './ebay-variant-publishing.service.js';
import type { ProductFamily } from './entities/product-family.entity.js';
import type { ProductVariant } from './entities/product-variant.entity.js';

describe('EbayVariantPublishingService', () => {
  const service = Object.create(EbayVariantPublishingService.prototype) as EbayVariantPublishingService;

  const family = {
    vertical: 'fashion',
    name: 'Everyday Shirt',
  } as ProductFamily;

  it('builds an eBay item-group payload from shared variant aspects', async () => {
    const payload = await service.buildGroupPayload(family, [
      { sku: 'SHIRT-M-NAVY', vertical: 'fashion', attributes: { size: 'M', color: 'Navy' } },
      { sku: 'SHIRT-L-NAVY', vertical: 'fashion', attributes: { size: 'L', color: 'Navy' } },
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
    await expect(service.buildGroupPayload(
      { ...family, vertical: 'automotive' } as ProductFamily,
      [{ sku: 'AUTO-1', vertical: 'automotive', attributes: { fitment: 'Sedan' } }] as ProductVariant[],
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires at least one variation aspect', async () => {
    await expect(service.buildGroupPayload(
      family,
      [{ sku: 'SHIRT-1', vertical: 'fashion', attributes: {} }] as ProductVariant[],
    )).rejects.toThrow('At least one shared variation aspect is required');
  });
});
