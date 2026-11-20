import { Organization } from '../../auth/entities/organization.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
export type BusinessIndustrialUnitStatus = 'available' | 'allocated' | 'sold' | 'quarantined';
export declare class BusinessIndustrialUnit {
    id: string;
    organizationId: string;
    organization: Organization;
    catalogProductId: string;
    catalogProduct: CatalogProduct;
    serialNumberPrivate: string;
    serialNumberPublic: string | null;
    status: BusinessIndustrialUnitStatus;
    allocatedStoreId: string | null;
    allocatedOfferId: string | null;
    createdAt: Date;
    updatedAt: Date;
}
