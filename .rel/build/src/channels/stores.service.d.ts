import { Repository, DataSource } from 'typeorm';
import { Store } from './entities/store.entity.js';
import { ListingChannelInstance } from './entities/listing-channel-instance.entity.js';
import { DemoSimulationLog } from './entities/demo-simulation-log.entity.js';
import { ChannelConnection } from './entities/channel-connection.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { ConfigService } from '@nestjs/config';
import { EbayPublishService } from './ebay/ebay-publish.service.js';
import { StoreAccessService } from './store-access.service.js';
import { User } from '../auth/entities/user.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayBusinessPolicy } from '../integrations/ebay/entities/ebay-business-policy.entity.js';
import { ShippingProfile } from '../settings/entities/shipping-profile.entity.js';
export declare class StoresService {
    private readonly storeRepo;
    private readonly instanceRepo;
    private readonly demoLogRepo;
    private readonly connectionRepo;
    private readonly listingRepo;
    private readonly connectedAccountRepo;
    private readonly policyRepo;
    private readonly shippingProfileRepo;
    private readonly dataSource;
    private readonly config;
    private readonly ebayPublish;
    private readonly storeAccess;
    private readonly logger;
    constructor(storeRepo: Repository<Store>, instanceRepo: Repository<ListingChannelInstance>, demoLogRepo: Repository<DemoSimulationLog>, connectionRepo: Repository<ChannelConnection>, listingRepo: Repository<ListingRecord>, connectedAccountRepo: Repository<ConnectedEbayAccount>, policyRepo: Repository<EbayBusinessPolicy>, shippingProfileRepo: Repository<ShippingProfile>, dataSource: DataSource, config: ConfigService, ebayPublish: EbayPublishService, storeAccess: StoreAccessService);
    private get isDemoMode();
    getStores(connectionId?: string): Promise<Store[]>;
    getStoresByChannel(channel: string, user?: User): Promise<any[]>;
    getStore(storeId: string): Promise<Store>;
    getStoreProfiles(storeId: string): Promise<{
        shippingProfiles: Array<{
            id: string;
            name: string;
            carrier: string;
            service: string;
            costType: string;
            ebayPolicyId?: string;
            shippingCost?: number;
            currency?: string;
        }>;
        returnProfiles: Array<{
            id: string;
            name: string;
            ebayPolicyId: string;
        }>;
        paymentProfiles: Array<{
            id: string;
            name: string;
            ebayPolicyId: string;
        }>;
    }>;
    createStore(data: {
        connectionId: string;
        channel: string;
        storeName: string;
        storeUrl?: string;
        externalStoreId?: string;
        isPrimary?: boolean;
        config?: Record<string, unknown>;
    }): Promise<Store>;
    updateStore(storeId: string, data: Partial<{
        storeName: string;
        storeUrl: string;
        status: string;
        isPrimary: boolean;
        config: Record<string, unknown>;
    }>): Promise<Store>;
    deleteStore(storeId: string): Promise<void>;
    getInstances(filters: {
        listingId?: string;
        storeId?: string;
        connectionId?: string;
        channel?: string;
        syncStatus?: string;
    }): Promise<ListingChannelInstance[]>;
    getInstance(instanceId: string): Promise<ListingChannelInstance>;
    createInstance(data: {
        listingId: string;
        storeId: string;
        overridePrice?: number;
        overrideQuantity?: number;
        overrideTitle?: string;
        channelSpecificData?: Record<string, unknown>;
    }): Promise<ListingChannelInstance>;
    publishInstance(instanceId: string): Promise<ListingChannelInstance>;
    bulkPublishInstances(instanceIds: string[]): Promise<{
        results: Array<{
            instanceId: string;
            status: string;
            externalId?: string;
            error?: string;
        }>;
    }>;
    endInstance(instanceId: string): Promise<ListingChannelInstance>;
    publishToMultipleStores(listingId: string, storeIds: string[], overrides?: Record<string, {
        price?: number;
        quantity?: number;
        title?: string;
    }>): Promise<{
        results: Array<{
            storeId: string;
            instanceId?: string;
            status: string;
            error?: string;
        }>;
    }>;
    getListingChannelOverview(listingId: string): Promise<{
        instances: ListingChannelInstance[];
        channelSummary: Array<{
            channel: string;
            storeCount: number;
            publishedCount: number;
            totalStores: Array<{
                storeId: string;
                storeName: string;
                syncStatus: string;
                externalId: string | null;
            }>;
        }>;
    }>;
    getDemoLogs(filters: {
        channel?: string;
        operationType?: string;
        listingId?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        logs: DemoSimulationLog[];
        total: number;
    }>;
    simulateIncomingOrder(instanceId: string): Promise<DemoSimulationLog>;
    private updateStoreListingCount;
    private generateDemoUrl;
    private logDemo;
}
