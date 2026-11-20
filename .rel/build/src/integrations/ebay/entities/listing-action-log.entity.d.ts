import { Organization } from '../../../auth/entities/organization.entity.js';
import { User } from '../../../auth/entities/user.entity.js';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';
import { EbayListingChannel } from './ebay-listing-channel.entity.js';
export declare class ListingActionLog {
    id: string;
    organizationId: string;
    organization: Organization;
    userId: string | null;
    user: User | null;
    ebayAccountId: string | null;
    ebayAccount: ConnectedEbayAccount | null;
    marketplaceId: string | null;
    catalogProductId: string | null;
    catalogProduct: CatalogProduct | null;
    ebayListingChannelId: string | null;
    ebayListingChannel: EbayListingChannel | null;
    action: string;
    beforeSnapshot: Record<string, unknown> | null;
    afterSnapshot: Record<string, unknown> | null;
    result: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
}
