import { MasterProduct } from './master-product.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
export declare class EbayOffer {
    id: string;
    masterProductId: string;
    masterProduct: MasterProduct;
    storeId: string;
    store: Store;
    sku: string;
    ebayOfferId: string | null;
    ebayListingId: string | null;
    marketplaceId: string;
    titleOverride: string | null;
    price: number | null;
    quantity: number | null;
    categoryId: string | null;
    format: 'FIXED_PRICE' | 'AUCTION';
    fulfillmentPolicyId: string | null;
    paymentPolicyId: string | null;
    returnPolicyId: string | null;
    merchantLocationKey: string | null;
    status: 'draft' | 'pending' | 'published' | 'ended' | 'error';
    lastError: string | null;
    lastSyncedAt: Date | null;
    publishedAt: Date | null;
    endedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
