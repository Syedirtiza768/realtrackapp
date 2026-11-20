import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';
export declare class EbayAccountMarketplace {
    id: string;
    ebayAccountId: string;
    ebayAccount: ConnectedEbayAccount;
    marketplaceId: string;
    currency: string;
    locale: string;
    enabled: boolean;
    defaultInventoryLocationKey: string | null;
    defaultPaymentPolicyId: string | null;
    defaultReturnPolicyId: string | null;
    defaultFulfillmentPolicyId: string | null;
    createdAt: Date;
    updatedAt: Date;
}
