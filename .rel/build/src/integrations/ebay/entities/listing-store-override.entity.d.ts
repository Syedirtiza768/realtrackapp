import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';
export declare class ListingStoreOverride {
    id: string;
    catalogProductId: string;
    catalogProduct: CatalogProduct;
    ebayAccountId: string;
    ebayAccount: ConnectedEbayAccount;
    marketplaceId: string;
    titleOverride: string | null;
    priceOverride: string | null;
    quantityOverride: number | null;
    descriptionOverride: string | null;
    categoryIdOverride: string | null;
    conditionOverride: string | null;
    policyOverrides: Record<string, unknown>;
    imageOrderOverride: unknown;
    fitmentOverride: unknown;
    createdAt: Date;
    updatedAt: Date;
}
