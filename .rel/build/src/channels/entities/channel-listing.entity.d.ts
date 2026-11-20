import { ChannelConnection } from './channel-connection.entity.js';
export declare class ChannelListing {
    id: string;
    connectionId: string;
    connection: ChannelConnection;
    listingId: string;
    externalId: string;
    externalUrl: string | null;
    syncStatus: string;
    lastPushedVersion: number;
    lastSyncedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
}
