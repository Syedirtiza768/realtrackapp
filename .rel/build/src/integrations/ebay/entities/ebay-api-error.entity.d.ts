import { Organization } from '../../../auth/entities/organization.entity.js';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';
import { EbayListingChannel } from './ebay-listing-channel.entity.js';
export declare class EbayApiError {
    id: string;
    organizationId: string;
    organization: Organization;
    ebayAccountId: string | null;
    ebayAccount: ConnectedEbayAccount | null;
    marketplaceId: string | null;
    catalogProductId: string | null;
    catalogProduct: CatalogProduct | null;
    ebayListingChannelId: string | null;
    ebayListingChannel: EbayListingChannel | null;
    apiName: string;
    endpoint: string;
    responseCode: number | null;
    ebayErrorId: string | null;
    ebayErrorDomain: string | null;
    ebayErrorCategory: string | null;
    ebayErrorMessage: string | null;
    ebayLongMessage: string | null;
    retryable: boolean;
    rawResponse: Record<string, unknown> | null;
    createdAt: Date;
}
