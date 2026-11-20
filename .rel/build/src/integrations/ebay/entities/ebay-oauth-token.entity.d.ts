import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';
export declare class EbayOAuthToken {
    id: string;
    ebayAccountId: string;
    ebayAccount: ConnectedEbayAccount;
    accessTokenEncrypted: string;
    accessTokenExpiresAt: Date;
    refreshTokenEncrypted: string;
    refreshTokenExpiresAt: Date | null;
    grantedScopes: string[];
    lastRefreshedAt: Date | null;
    revokedAt: Date | null;
    reconnectRequired: boolean;
    createdAt: Date;
    updatedAt: Date;
}
