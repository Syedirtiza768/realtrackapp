export declare class StoreWarehouseLink {
    id: string;
    organizationId: string;
    storeId: string;
    warehouseId: string;
    priority: number;
    active: boolean;
    createdAt: Date;
}
export declare class StoreStockPolicy {
    storeId: string;
    organizationId: string;
    pushEnabled: boolean;
    bufferQty: number;
    maxQty: number | null;
    includeSourceable: boolean;
    maxSourceableQty: number;
    updatedAt: Date;
}
export type ChannelSyncStatus = 'pending' | 'synced' | 'shadow' | 'failed' | 'no_target' | 'paused';
export declare class ChannelStockSyncState {
    storeId: string;
    inventoryItemId: string;
    organizationId: string;
    dirty: boolean;
    desiredQty: number | null;
    pushedQty: number | null;
    channelQty: number | null;
    status: ChannelSyncStatus;
    attempts: number;
    lastError: string | null;
    targets: Array<Record<string, unknown>>;
    lastPushedAt: Date | null;
    updatedAt: Date;
}
export declare class UserWarehouseAssignment {
    userId: string;
    warehouseId: string;
    organizationId: string;
    createdAt: Date;
}
