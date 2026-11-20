import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { ChannelConnection } from '../entities/channel-connection.entity.js';
import { ListingChannelInstance } from '../entities/listing-channel-instance.entity.js';
import { Store } from '../entities/store.entity.js';
import { StorageService } from '../../storage/storage.service.js';
import { TokenEncryptionService } from '../token-encryption.service.js';
import { PartsBazar360Client } from './partsbazar360.client.js';
export declare const PARTSBAZAR360_STATUS_JOB = "partsbazar-status-check";
export interface PartsBazarPublishOverrides {
    price?: number;
    title?: string;
    quantity?: number;
}
export declare class PartsBazar360Service {
    private readonly client;
    private readonly config;
    private readonly encryption;
    private readonly storage;
    private readonly listingRepo;
    private readonly catalogRepo;
    private readonly connectionRepo;
    private readonly storeRepo;
    private readonly instanceRepo;
    private readonly channelsQueue;
    private readonly logger;
    constructor(client: PartsBazar360Client, config: ConfigService, encryption: TokenEncryptionService, storage: StorageService, listingRepo: Repository<ListingRecord>, catalogRepo: Repository<CatalogProduct>, connectionRepo: Repository<ChannelConnection>, storeRepo: Repository<Store>, instanceRepo: Repository<ListingChannelInstance>, channelsQueue: Queue);
    getStatus(): Promise<{
        configured: boolean;
        apiUrl: string;
        stores: {
            storeId: string;
            connectionId: string;
            storeName: string;
            sellerStoreId: string | null;
            status: "active" | "suspended" | "paused" | "archived";
        }[];
    }>;
    connect(userId: string, input: {
        storeName: string;
        sellerStoreId: string;
        accountName?: string;
    }): Promise<{
        connectionId: string;
        storeId: string;
        seller: {
            id: string;
            name: string;
        } | null;
    }>;
    testConnection(connectionId: string): Promise<{
        ok: boolean;
        seller: {
            id: string;
            name: string;
        } | null;
        error?: undefined;
    } | {
        ok: boolean;
        error: string;
        seller?: undefined;
    }>;
    publish(connectionId: string, listingId: string, overrides?: PartsBazarPublishOverrides): Promise<ListingChannelInstance>;
    reconcile(instanceId: string, attempt?: number): Promise<void>;
    refresh(listingId: string): Promise<{
        storeId: string;
        status: "error" | "synced" | "draft" | "pending" | "publishing" | "ended";
        externalId: string | null;
        externalUrl: string | null;
        lastError: string | null;
    }[]>;
    end(listingId: string): Promise<{
        success: boolean;
    }>;
    private targetFor;
    private instanceFor;
    private publicImageUrls;
    private toWebp;
    private webpKeyFor;
    private mirrorExternalAsWebp;
    private refuseWithoutPhotos;
    private awaitOutcome;
    private isPending;
    private applyRemote;
    private fail;
    private scheduleStatusCheck;
    private isPermanent;
    private storeMarketplace;
    private storeCurrency;
    private number;
    private errorMessage;
}
