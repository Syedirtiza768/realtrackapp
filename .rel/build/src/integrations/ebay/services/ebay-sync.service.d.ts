import { Repository } from 'typeorm';
import type { Queue } from 'bullmq';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../entities/ebay-listing-channel.entity.js';
import { EbayListingSyncLog } from '../entities/ebay-listing-sync-log.entity.js';
import { EbayInventoryApiService } from '../../../channels/ebay/ebay-inventory-api.service.js';
import { EbayOrderImportService } from '../../../orders/order-import-ebay.service.js';
import { EbayPolicySyncService } from './ebay-policy-sync.service.js';
import { ListingActionLogWriterService } from './listing-action-log-writer.service.js';
export interface EbayInventorySyncJobPayload {
    ebayAccountId: string;
    organizationId: string;
    userId?: string | null;
    marketplaceId?: string | null;
    syncLogId?: string;
}
export interface EbayOrderSyncJobPayload {
    ebayAccountId: string;
    organizationId: string;
    userId?: string | null;
}
export declare class EbaySyncService {
    private readonly accountRepo;
    private readonly channelRepo;
    private readonly syncLogRepo;
    private readonly inventoryApi;
    private readonly policySync;
    private readonly orderImport;
    private readonly logWriter;
    private readonly inventorySyncQueue;
    private readonly orderSyncQueue;
    private readonly logger;
    constructor(accountRepo: Repository<ConnectedEbayAccount>, channelRepo: Repository<EbayListingChannel>, syncLogRepo: Repository<EbayListingSyncLog>, inventoryApi: EbayInventoryApiService, policySync: EbayPolicySyncService, orderImport: EbayOrderImportService, logWriter: ListingActionLogWriterService, inventorySyncQueue: Queue<EbayInventorySyncJobPayload>, orderSyncQueue: Queue<EbayOrderSyncJobPayload>);
    enqueueListingSync(ebayAccountId: string, organizationId: string, userId?: string | null, marketplaceId?: string | null): Promise<{
        jobId: string;
        syncLogId: string;
    }>;
    syncListingsFromEbay(payload: EbayInventorySyncJobPayload, syncLogId: string): Promise<{
        processed: number;
        updated: number;
        failed: number;
    }>;
    enqueueOrderSync(ebayAccountId: string, organizationId: string, userId?: string | null): Promise<{
        jobId: string;
    }>;
    importOrdersFromEbay(payload: EbayOrderSyncJobPayload): Promise<{
        storeId: string;
        imported: number;
        errors: number;
    }>;
    syncPolicies(ebayAccountId: string, organizationId: string, userId?: string | null): Promise<{
        ok: boolean;
        synced: number;
        message: string;
    }>;
    listSyncLogs(ebayAccountId: string, organizationId: string, limit?: number): Promise<EbayListingSyncLog[]>;
}
