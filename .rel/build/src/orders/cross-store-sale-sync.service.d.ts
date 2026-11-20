import type { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import { EbayTradingApiService } from '../channels/ebay/ebay-trading-api.service.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
export type CrossStoreSyncStatus = 'done' | 'skipped' | 'failed' | 'planned';
export interface CrossStoreSyncResult {
    orderId: string;
    orderItemId: string;
    sku: string | null;
    soldItemId: string | null;
    soldQty: number;
    targetListingId: string | null;
    targetStoreId: string | null;
    targetStoreName: string | null;
    targetItemId: string | null;
    action: 'end' | 'set_quantity' | 'none';
    status: CrossStoreSyncStatus;
    reason: string | null;
    quantityBefore: number | null;
    quantityAfter: number | null;
    error: string | null;
}
export declare class CrossStoreSaleSyncService {
    private readonly db;
    private readonly flags;
    private readonly trading;
    private readonly inventory;
    private readonly notifications;
    private readonly queue;
    private readonly logger;
    constructor(db: DataSource, flags: FeatureFlagService, trading: EbayTradingApiService, inventory: EbayInventoryApiService, notifications: NotificationsService, queue: Queue);
    enabled(): Promise<boolean>;
    onOrderNew(payload: {
        orderId: string;
        channel: string;
    }): Promise<void>;
    enqueue(orderId: string, delayMs?: number): Promise<void>;
    ordersSince(since: Date, limit?: number): Promise<string[]>;
    syncOrder(orderId: string, opts?: {
        dryRun?: boolean;
    }): Promise<CrossStoreSyncResult[]>;
    notifyGaveUp(orderId: string, error: string): Promise<void>;
    listRecent(limit?: number, status?: string): Promise<unknown[]>;
    private syncLine;
    private pushManagedStores;
    private syncTarget;
    private readLive;
    private endListing;
    private setQuantity;
    private markMirror;
    private record;
}
