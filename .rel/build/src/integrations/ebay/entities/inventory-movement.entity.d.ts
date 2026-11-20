import { Organization } from '../../../auth/entities/organization.entity.js';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';
export type InventoryMovementType = 'manual_adjustment' | 'ebay_sale' | 'ebay_sync' | 'reservation' | 'release' | 'correction';
export declare class InventoryMovement {
    id: string;
    organizationId: string;
    organization: Organization;
    catalogProductId: string;
    catalogProduct: CatalogProduct;
    movementType: InventoryMovementType;
    quantityChange: number;
    sourceChannel: string;
    ebayAccountId: string | null;
    ebayAccount: ConnectedEbayAccount | null;
    ebayOrderId: string | null;
    notes: string | null;
    createdAt: Date;
}
