import type { ProductVertical } from '../../../verticals/vertical.types.js';
import type Redis from 'ioredis';
export interface EbayOAuthPendingPayload {
    userId: string;
    organizationId: string;
    internalStoreId: string | null;
    marketplaceId: string;
    environment: 'sandbox' | 'production';
    scopes: string[];
    accountDisplayName: string;
    vertical?: ProductVertical;
    reconnectAccountId?: string | null;
}
export declare class EbayOAuthStateStore {
    private readonly redis;
    constructor(redis: Redis);
    save(state: string, payload: EbayOAuthPendingPayload): Promise<void>;
    consume(state: string): Promise<EbayOAuthPendingPayload | null>;
}
