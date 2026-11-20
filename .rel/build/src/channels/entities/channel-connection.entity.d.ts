export declare class ChannelConnection {
    id: string;
    channel: string;
    userId: string;
    organizationId: string | null;
    accountName: string | null;
    externalAccountId: string | null;
    encryptedTokens: string;
    tokenExpiresAt: Date | null;
    scope: string | null;
    status: string;
    lastSyncAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
}
