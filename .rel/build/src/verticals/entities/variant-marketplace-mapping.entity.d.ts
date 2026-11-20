import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { ProductVariant } from './product-variant.entity.js';
export declare class VariantMarketplaceMapping {
    id: string;
    variantId: string;
    variant: ProductVariant;
    ebayAccountId: string;
    ebayAccount: ConnectedEbayAccount;
    marketplaceId: string;
    inventorySku: string;
    offerId: string | null;
    listingId: string | null;
    status: 'pending' | 'processing' | 'published' | 'failed' | 'ended';
    lastError: string | null;
    resultPayload: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
}
