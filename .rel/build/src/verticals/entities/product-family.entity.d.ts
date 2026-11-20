import { Organization } from '../../auth/entities/organization.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ProductVariant } from './product-variant.entity.js';
import type { ProductVertical } from '../vertical.types.js';
export declare class ProductFamily {
    id: string;
    organizationId: string;
    organization: Organization;
    catalogProductId: string;
    catalogProduct: CatalogProduct;
    vertical: ProductVertical;
    slug: string;
    name: string;
    active: boolean;
    variants: ProductVariant[];
    createdAt: Date;
    updatedAt: Date;
}
