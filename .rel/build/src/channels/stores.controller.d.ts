import { StoresService } from './stores.service.js';
import { CreateStoreDto, UpdateStoreDto, CreateInstanceDto, PublishInstanceDto, BulkPublishInstancesDto } from './dto/store.dto.js';
import { User } from '../auth/entities/user.entity.js';
export declare class StoresController {
    private readonly storesService;
    constructor(storesService: StoresService);
    getStores(connectionId?: string): Promise<import("./entities/store.entity.js").Store[]>;
    getStoresByChannel(channel: string, user: User): Promise<any[]>;
    getStore(storeId: string): Promise<import("./entities/store.entity.js").Store>;
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
    createStore(dto: CreateStoreDto): Promise<import("./entities/store.entity.js").Store>;
    updateStore(storeId: string, dto: UpdateStoreDto): Promise<import("./entities/store.entity.js").Store>;
    deleteStore(storeId: string): Promise<void>;
    getInstances(listingId?: string, storeId?: string, connectionId?: string, channel?: string, syncStatus?: string): Promise<import("./entities/listing-channel-instance.entity.js").ListingChannelInstance[]>;
    getInstance(instanceId: string): Promise<import("./entities/listing-channel-instance.entity.js").ListingChannelInstance>;
    createInstance(dto: CreateInstanceDto): Promise<import("./entities/listing-channel-instance.entity.js").ListingChannelInstance>;
    publishInstance(dto: PublishInstanceDto): Promise<import("./entities/listing-channel-instance.entity.js").ListingChannelInstance>;
    bulkPublishInstances(dto: BulkPublishInstancesDto): Promise<{
        results: Array<{
            instanceId: string;
            status: string;
            externalId?: string;
            error?: string;
        }>;
    }>;
    endInstance(instanceId: string): Promise<import("./entities/listing-channel-instance.entity.js").ListingChannelInstance>;
    publishToMultipleStores(dto: {
        listingId: string;
        storeIds: string[];
        overrides?: Record<string, {
            price?: number;
            quantity?: number;
            title?: string;
        }>;
    }): Promise<{
        results: Array<{
            storeId: string;
            instanceId?: string;
            status: string;
            error?: string;
        }>;
    }>;
    getListingChannelOverview(listingId: string): Promise<{
        instances: import("./entities/listing-channel-instance.entity.js").ListingChannelInstance[];
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
    getDemoLogs(channel?: string, operationType?: string, listingId?: string, limit?: string, offset?: string): Promise<{
        logs: import("./entities/demo-simulation-log.entity.js").DemoSimulationLog[];
        total: number;
    }>;
    simulateOrder(instanceId: string): Promise<import("./entities/demo-simulation-log.entity.js").DemoSimulationLog>;
}
