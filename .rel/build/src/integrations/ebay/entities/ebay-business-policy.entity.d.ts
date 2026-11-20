import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';
export type EbayPolicyType = 'payment' | 'return' | 'fulfillment';
export declare class EbayBusinessPolicy {
    id: string;
    ebayAccountId: string;
    ebayAccount: ConnectedEbayAccount;
    marketplaceId: string;
    policyType: EbayPolicyType;
    ebayPolicyId: string;
    name: string;
    rawPayload: Record<string, unknown>;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}
