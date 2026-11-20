import { ModuleRef } from '@nestjs/core';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import { SchedulerLeaderService } from '../common/scheduler/scheduler-leader.service.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import { EbayTradingApiService } from '../channels/ebay/ebay-trading-api.service.js';
import { StockScope } from './stock-access.service.js';
export declare const STOCK_CHANNEL_SYNC_QUEUE = "stock-channel-sync";
export declare const STOCK_CHANNEL_PUSH_FLAG = "stock_channel_push";
export type ChannelTarget = {
    kind: 'ebay_offer';
    offerId: string;
    sku: string | null;
    publishedListingId: string;
    channelQty: number;
} | {
    kind: 'ebay_item';
    itemId: string;
    marketplaceId: string;
    publishedListingId: string;
    channelQty: number;
} | {
    kind: 'pb360';
    connectionId: string;
    listingId: string;
    channelQty: number | null;
};
export interface DesiredQuantity {
    desired: number;
    onHandAvailable: number;
    sourceable: number;
    bufferQty: number;
    maxQty: number | null;
    pushEnabled: boolean;
    itemActive: boolean;
}
export declare class ChannelStockSyncService {
    private readonly db;
    private readonly flags;
    private readonly leader;
    private readonly ebayInventory;
    private readonly ebayTrading;
    private readonly moduleRef;
    private readonly queue;
    private readonly logger;
    constructor(db: DataSource, flags: FeatureFlagService, leader: SchedulerLeaderService, ebayInventory: EbayInventoryApiService, ebayTrading: EbayTradingApiService, moduleRef: ModuleRef, queue: Queue);
    onStockChanged(payload: {
        organizationId: string;
    }): Promise<void>;
    cronSweep(): Promise<void>;
    cronDrift(): Promise<void>;
    computeDesired(storeId: string, itemId: string): Promise<DesiredQuantity>;
    globalPushEnabled(): Promise<boolean>;
    findTargets(storeId: string, itemId: string): Promise<ChannelTarget[]>;
    sweep(organizationId?: string, limit?: number): Promise<{
        processed: number;
        pushed: number;
        failed: number;
    }>;
    private processRow;
    private push;
    private partsBazar;
    private reviseTradingQuantity;
    driftCheck(organizationId?: string): Promise<{
        checked: number;
        drift: number;
    }>;
    list(scope: StockScope, q: {
        storeId?: string;
        status?: string;
        driftOnly?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<{
        total: any;
        items: any;
    }>;
    summary(scope: StockScope): Promise<{
        pushGloballyEnabled: boolean;
    }>;
    resync(scope: StockScope, storeId?: string): Promise<{
        processed: number;
        pushed: number;
        failed: number;
    }>;
}
