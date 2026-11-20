export declare class CreateStoreDto {
    connectionId: string;
    channel: string;
    storeName: string;
    storeUrl?: string;
    externalStoreId?: string;
    isPrimary?: boolean;
    config?: Record<string, unknown>;
}
export declare class UpdateStoreDto {
    storeName?: string;
    storeUrl?: string;
    status?: string;
    isPrimary?: boolean;
    config?: Record<string, unknown>;
}
export declare class CreateInstanceDto {
    listingId: string;
    storeId: string;
    overridePrice?: number;
    overrideQuantity?: number;
    overrideTitle?: string;
    channelSpecificData?: Record<string, unknown>;
}
export declare class PublishInstanceDto {
    instanceId: string;
}
export declare class BulkPublishInstancesDto {
    instanceIds: string[];
}
