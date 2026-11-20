import { ChannelConnection } from './channel-connection.entity.js';
export declare class Store {
    id: string;
    connectionId: string;
    organizationId: string | null;
    connection: ChannelConnection;
    channel: string;
    storeName: string;
    storeUrl: string | null;
    externalStoreId: string | null;
    status: 'active' | 'paused' | 'suspended' | 'archived';
    isPrimary: boolean;
    config: Record<string, unknown>;
    verticalConfig: Record<string, unknown> | null;
    metricsCache: Record<string, unknown>;
    listingCount: number;
    ebayUserId: string | null;
    ebaySiteId: string | null;
    ebayMarketplaceId: string | null;
    fulfillmentPolicyId: string | null;
    paymentPolicyId: string | null;
    returnPolicyId: string | null;
    locationKey: string | null;
    tokenExpiresAt: Date | null;
    lastSyncAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
