import { createHash } from 'node:crypto';
import type { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';

/**
 * Stable hash of source fields that drive optimization.
 * Re-run optimization only when this hash changes.
 */
export function computeSourceDataHash(product: CatalogProduct): string {
  const payload = {
    title: product.title,
    description: product.description,
    brand: product.brand,
    mpn: product.mpn,
    oemPartNumber: product.oemPartNumber,
    partType: product.partType,
    placement: product.placement,
    categoryId: product.categoryId,
    fitmentData: product.fitmentData,
    imageUrls: product.imageUrls,
    price: product.price,
    quantity: product.quantity,
    conditionId: product.conditionId,
    donorVin: product.donorVin,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
