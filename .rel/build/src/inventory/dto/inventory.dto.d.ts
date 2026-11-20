export declare class AdjustInventoryDto {
    change: number;
    reason: string;
    idempotencyKey: string;
    sourceChannel?: string;
}
export declare class ReserveInventoryDto {
    quantity: number;
    orderId: string;
}
export declare class ReleaseInventoryDto {
    quantity: number;
    orderId: string;
}
export declare class ReconcileDto {
    listingIds: string[];
}
export declare class LowStockQueryDto {
    threshold?: number;
    limit?: number;
}
export declare class InventoryEventsQueryDto {
    listingId?: string;
    type?: string;
    since?: string;
    limit?: number;
    offset?: number;
}
