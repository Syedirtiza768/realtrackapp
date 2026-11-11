import type { CatalogProduct } from '../entities/catalog-product.entity.js';
import {
  fashionSourceImageUrls,
  isRetryableCatalogImportError,
  isRetryableFashionImageError,
} from './csv-import.processor.js';

describe('catalog import recovery helpers', () => {
  it('uses the complete persisted source image list when mirrored URLs are partial', () => {
    const product = {
      imageUrls: ['https://cdn.example/app/one.webp'],
      verticalAttributes: {
        _sourceImageUrls: [
          ' https://source.example/one.jpg ',
          'https://source.example/two.jpg',
          'https://source.example/one.jpg',
          'javascript:alert(1)',
        ],
      },
    } as CatalogProduct;

    expect(fashionSourceImageUrls(product)).toEqual([
      'https://source.example/one.jpg',
      'https://source.example/two.jpg',
    ]);
  });

  it('retries transient image errors but keeps permanent source failures terminal', () => {
    expect(
      isRetryableFashionImageError(new Error('source image returned HTTP 503')),
    ).toBe(true);
    expect(
      isRetryableFashionImageError(
        Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
      ),
    ).toBe(true);
    expect(
      isRetryableFashionImageError(new Error('source image returned HTTP 404')),
    ).toBe(false);
    expect(
      isRetryableFashionImageError(
        new Error('Image exceeds the maximum pixel count'),
      ),
    ).toBe(false);
  });

  it('retries transient database failures but not uniqueness or validation errors', () => {
    expect(
      isRetryableCatalogImportError({ driverError: { code: '57P01' } }),
    ).toBe(true);
    expect(isRetryableCatalogImportError({ code: 'ECONNRESET' })).toBe(true);
    expect(
      isRetryableCatalogImportError({ driverError: { code: '23505' } }),
    ).toBe(false);
    expect(
      isRetryableCatalogImportError(new Error('Could not detect CSV headers')),
    ).toBe(false);
  });
});
