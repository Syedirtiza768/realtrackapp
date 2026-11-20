import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ChannelsService } from './channels.service.js';
import { StoresService } from './stores.service.js';
import { InventoryRealtimeSyncService } from './inventory-realtime-sync.service.js';
import { PublishListingDto, SyncInventoryDto, PublishMultiDto, BulkPublishDto } from './dto/channel.dto.js';
import { User } from '../auth/entities/user.entity.js';
export declare class ChannelsController {
    private readonly channelsService;
    private readonly storesService;
    private readonly inventorySync;
    constructor(channelsService: ChannelsService, storesService: StoresService, inventorySync: InventoryRealtimeSyncService);
    getConnections(user: User): Promise<import("./entities/channel-connection.entity.js").ChannelConnection[]>;
    getAuthUrl(channel: string, state: string): {
        url: string;
    };
    handleCallback(channel: string, code: string, state: string, res: Response): Promise<void>;
    disconnect(connectionId: string, user: User): Promise<void>;
    testConnection(connectionId: string, user: User): Promise<{
        ok: boolean;
        error?: string;
    }>;
    publish(dto: PublishListingDto): Promise<{
        jobId: string;
    }>;
    syncInventory(dto: SyncInventoryDto): Promise<{
        jobId: string;
    }>;
    getChannelListings(connectionId: string): Promise<import("./entities/listing-channel-instance.entity.js").ListingChannelInstance[]>;
    getListingChannels(listingId: string): Promise<{
        channel: string;
        connectionId: string;
        status: string;
        externalId: string | null;
        externalUrl: string | null;
        lastSyncedAt: Date | null;
        lastError: string | null;
    }[]>;
    publishMulti(dto: PublishMultiDto): Promise<{
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
    bulkPublish(dto: BulkPublishDto): Promise<{
        total: number;
        enqueued: number;
        errors: string[];
    }>;
    seedDemoEbay(): Promise<{
        connectionId: string;
        storeId: string;
        message: string;
    }>;
    connectEbayLegacyToken(body: {
        token: string;
    }, user: User): Promise<{
        ok: boolean;
        error: string;
    } | {
        connection: import("./entities/channel-connection.entity.js").ChannelConnection;
        storeId: string;
        message: string;
        ok: boolean;
        error?: undefined;
    }>;
    ebayWebhook(req: RawBodyRequest<Request>, signature: string, body: Record<string, unknown>): Promise<{
        status: string;
    }>;
    shopifyWebhook(req: RawBodyRequest<Request>, signature: string, topic: string, shopDomain: string, body: Record<string, unknown>): Promise<{
        status: string;
    }>;
    amazonWebhook(body: Record<string, unknown>): Promise<{
        status: string;
    }>;
    walmartWebhook(signature: string, body: Record<string, unknown>): Promise<{
        status: string;
    }>;
}
