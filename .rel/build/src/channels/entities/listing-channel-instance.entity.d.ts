import { ChannelConnection } from './channel-connection.entity.js';
import { Store } from './store.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
export declare class ListingChannelInstance {
    id: string;
    listingId: string;
    listing: ListingRecord;
    connectionId: string;
    connection: ChannelConnection;
    storeId: string;
    store: Store;
    channel: string;
    externalId: string | null;
    externalUrl: string | null;
    overridePrice: number | null;
    overrideQuantity: number | null;
    overrideTitle: string | null;
    channelSpecificData: Record<string, unknown>;
    syncStatus: 'synced' | 'pending' | 'publishing' | 'error' | 'ended' | 'draft';
    lastPushedVersion: number | null;
    lastSyncedAt: Date | null;
    lastError: string | null;
    retryCount: number;
    isDemo: boolean;
    createdAt: Date;
    updatedAt: Date;
}
