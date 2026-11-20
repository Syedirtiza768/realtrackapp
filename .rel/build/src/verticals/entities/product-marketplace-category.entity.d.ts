import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import type { ProductVertical } from '../vertical.types.js';
export declare class ProductMarketplaceCategory {
    id: string;
    organizationId: string | null;
    catalogProductId: string;
    catalogProduct: CatalogProduct;
    vertical: ProductVertical;
    marketplaceId: string;
    categoryTreeId: string;
    categoryId: string;
    categoryName: string | null;
    aspectMetadata: Record<string, unknown>[];
    conditionMetadata: string[];
    supportsVariations: boolean | null;
    fetchedAt: Date | null;
    invalidatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
