import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ProductFamily } from './product-family.entity.js';
import type { ProductAttributes, ProductVertical } from '../vertical.types.js';
export declare class ProductVariant {
    id: string;
    organizationId: string;
    familyId: string;
    family: ProductFamily;
    catalogProductId: string | null;
    catalogProduct: CatalogProduct | null;
    vertical: ProductVertical;
    sku: string;
    price: number | null;
    quantity: number;
    upc: string | null;
    ean: string | null;
    mpn: string | null;
    conditionId: string | null;
    attributes: ProductAttributes;
    imageUrls: string[];
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
