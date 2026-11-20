export declare class InventoryEvent {
    id: string;
    listingId: string;
    eventType: 'initial_stock' | 'manual_adjust' | 'sale' | 'return' | 'reserve' | 'release_reserve' | 'sync_correction' | 'bulk_import' | 'damage_writeoff';
    quantityChange: number;
    quantityBefore: number;
    quantityAfter: number;
    storeId: string | null;
    sourceChannel: string | null;
    sourceOrderId: string | null;
    sourceReference: string | null;
    idempotencyKey: string | null;
    reason: string | null;
    createdBy: string | null;
    createdAt: Date;
}
