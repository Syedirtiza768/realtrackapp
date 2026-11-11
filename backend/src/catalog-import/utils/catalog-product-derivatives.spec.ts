import type { CatalogProduct } from '../entities/catalog-product.entity.js';
import { computeCatalogProductDerived } from './catalog-product-derivatives.js';

function productWithFitment(
  fitmentData: Record<string, unknown>[],
): CatalogProduct {
  return {
    title: 'Bosch Alternator 123456 OEM Replacement',
    price: 45.99,
    quantity: 1,
    brand: 'Bosch',
    brandNormalized: 'BOSCH',
    partType: 'Alternator',
    mpn: '123456',
    description: 'Replacement alternator for listed vehicle applications.',
    imageUrls: ['https://example.com/product-image.jpg'],
    fitmentData,
    shippingProfile: 'Superior US shipping',
    returnProfile: '30 day returns',
    paymentProfile: 'Superior payment policy',
    oemPartNumber: '123456',
    categoryId: '33577',
  } as CatalogProduct;
}

describe('computeCatalogProductDerived', () => {
  it('keeps separate trims and engines for the same Y/M/M publish-ready', () => {
    const product = productWithFitment([
      {
        Year: '2019',
        Make: 'Tesla',
        Model: 'Model 3',
        Trim: 'Electric Motor Saloon',
        Engine: '-- 192KW 261HP 3D1;3D6',
        Platform: '--',
        MvlStatus: 'valid',
      },
      {
        Year: '2019',
        Make: 'Tesla',
        Model: 'Model 3',
        Trim: 'Electric Motor Saloon',
        Engine: '-- 258KW 351HP 3D3;3D5;3D7',
        Platform: '--',
        MvlStatus: 'valid',
      },
    ]);

    const derived = computeCatalogProductDerived(product);

    expect(derived.duplicate_fitment_row_count).toBe(0);
    expect(derived.readiness_status).toBe('ready');
    expect(derived.marketplace_us_ready).toBe(true);
  });

  it('ignores repeated normalized MVL rows with case/spacing differences', () => {
    const vehicle = {
      Year: '1998',
      Make: 'Mazda',
      Model: '626',
      Trim: 'Petrol Hatch',
      Engine: '1840cc 66KW 90HP FPY3',
      Platform: 'MK V',
      MvlStatus: 'valid',
    };
    const product = productWithFitment([
      vehicle,
      { ...vehicle, Make: ' mazda ', Platform: 'mk   v' },
    ]);

    const derived = computeCatalogProductDerived(product);

    expect(derived.duplicate_fitment_row_count).toBe(0);
    expect(derived.manual_review_reasons).not.toContain('DUP_FITMENT');
    expect(derived.readiness_status).toBe('ready');
  });

  it('keeps conflicting rows for the same vehicle configuration in review', () => {
    const vehicle = {
      Year: '1998',
      Make: 'Mazda',
      Model: '626',
      Trim: 'Petrol Hatch',
      Engine: '1840cc 66KW 90HP FPY3',
      Platform: 'MK V',
      MvlStatus: 'valid',
    };
    const product = productWithFitment([
      { ...vehicle, Source: 'US_MVL_2025' },
      { ...vehicle, Source: 'US_MVL_2026' },
    ]);

    const derived = computeCatalogProductDerived(product);

    expect(derived.duplicate_fitment_row_count).toBe(1);
    expect(derived.manual_review_reasons).toContain('DUP_FITMENT');
    expect(derived.readiness_status).toBe('needs_review');
  });

  it('accepts one valid item image for US marketplace readiness', () => {
    const product = productWithFitment([
      {
        Year: '2019',
        Make: 'Tesla',
        Model: 'Model 3',
        Trim: 'Electric Motor Saloon',
        Engine: '-- 192KW 261HP 3D1;3D6',
        MvlStatus: 'valid',
      },
    ]);

    const derived = computeCatalogProductDerived(product);

    expect(derived.image_count).toBe(1);
    expect(derived.readiness_status).toBe('ready');
    expect(derived.marketplace_us_ready).toBe(true);
  });
});
