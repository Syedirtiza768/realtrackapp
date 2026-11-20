import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChannelConnection } from './entities/channel-connection.entity.js';
import { ListingChannelInstance } from './entities/listing-channel-instance.entity.js';
import { ChannelWebhookLog } from './entities/channel-webhook-log.entity.js';
import { Store } from './entities/store.entity.js';
import { TokenEncryptionService } from './token-encryption.service.js';
import { EbayAdapter } from './adapters/ebay/ebay.adapter.js';
import { PartsBazar360Service } from './partsbazar360/partsbazar360.service.js';
export declare class ChannelsService {
    private readonly connectionRepo;
    private readonly instanceRepo;
    private readonly webhookLogRepo;
    private readonly storeRepo;
    private readonly channelsQueue;
    private readonly encryption;
    private readonly ebayAdapter;
    private readonly config;
    private readonly eventEmitter;
    private readonly partsbazar;
    private readonly logger;
    private readonly adapters;
    constructor(connectionRepo: Repository<ChannelConnection>, instanceRepo: Repository<ListingChannelInstance>, webhookLogRepo: Repository<ChannelWebhookLog>, storeRepo: Repository<Store>, channelsQueue: Queue, encryption: TokenEncryptionService, ebayAdapter: EbayAdapter, config: ConfigService, eventEmitter: EventEmitter2, partsbazar: PartsBazar360Service);
    private get isDemoMode();
    private getAdapter;
    getConnections(userId: string): Promise<ChannelConnection[]>;
    getAuthUrl(channel: string, state: string): string;
    handleOAuthCallback(channel: string, code: string, userId: string): Promise<ChannelConnection>;
    connectEbayLegacyToken(legacyToken: string, storesService: any, userId: string): Promise<{
        connection: ChannelConnection;
        storeId: string;
        message: string;
    }>;
    disconnectChannel(connectionId: string, userId: string): Promise<void>;
    testConnection(connectionId: string, userId: string): Promise<{
        ok: boolean;
        error?: string;
    }>;
    enqueuePublish(connectionId: string, listingId: string): Promise<{
        jobId: string;
    }>;
    publishListing(connectionId: string, listingId: string, listingData: Record<string, unknown>): Promise<ListingChannelInstance>;
    recordEbayPublishSuccess(connectionId: string, listingId: string, storeId: string, result: {
        listingId?: string;
        offerId?: string;
    }): Promise<ListingChannelInstance>;
    enqueueSync(connectionId: string): Promise<{
        jobId: string;
    }>;
    getChannelListings(connectionId: string): Promise<ListingChannelInstance[]>;
    getListingChannelStatuses(listingId: string): Promise<Array<{
        channel: string;
        connectionId: string;
        status: string;
        externalId: string | null;
        externalUrl: string | null;
        lastSyncedAt: Date | null;
        lastError: string | null;
    }>>;
    publishMulti(listingId: string, channels: string[], overrides?: Record<string, {
        price?: number;
        title?: string;
        quantity?: number;
    }>, storeId?: string): Promise<{
        results: Array<{
            channel: string;
            jobId?: string;
            error?: string;
        }>;
    }>;
    updateChannelListing(listingId: string, channel: string): Promise<{
        jobId: string;
    }>;
    endChannelListing(listingId: string, channel: string): Promise<{
        success: boolean;
    }>;
    bulkPublish(listingIds: string[], channels: string[], storeId?: string): Promise<{
        total: number;
        enqueued: number;
        errors: string[];
    }>;
    logWebhook(channel: string, eventType: string, payload: Record<string, unknown>, externalId?: string, storeId?: string): Promise<ChannelWebhookLog>;
    resolveStoreFromWebhook(channel: string, externalStoreId?: string): Promise<string | null>;
    seedDemoEbayConnection(storesService: any): Promise<{
        connectionId: string;
        storeId: string;
        message: string;
    }>;
    private decryptTokens;
    private getValidTokens;
    syncConnectionInventory(connectionId: string): Promise<{
        succeeded: number;
        failed: number;
    }>;
    syncAllInventory(channel?: string): Promise<void>;
}
