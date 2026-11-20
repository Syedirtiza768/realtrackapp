export type TrackingMode = 'quantity' | 'serial' | 'one_off';
export type SourcingMode = 'stocked' | 'on_demand' | 'hybrid';
export type InventoryItemStatus = 'active' | 'discontinued' | 'archived';
export declare class InventoryItem {
    id: string;
    organizationId: string;
    vertical: string;
    sku: string;
    title: string | null;
    imageUrl: string | null;
    catalogProductId: string | null;
    listingRecordId: string | null;
    productVariantId: string | null;
    trackingMode: TrackingMode;
    sourcingMode: SourcingMode;
    unitCost: string | null;
    currency: string;
    barcode: string | null;
    lowStockThreshold: number;
    reorderPoint: number;
    reorderQty: number;
    status: InventoryItemStatus;
    createdAt: Date;
    updatedAt: Date;
}
export declare class StockLevel {
    id: string;
    organizationId: string;
    inventoryItemId: string;
    warehouseId: string;
    locationId: string | null;
    onHand: number;
    reserved: number;
    damaged: number;
    inbound: number;
    available: number | null;
    lastReceivedAt: Date | null;
    version: number;
    updatedAt: Date;
}
export type InventoryUnitStatus = 'available' | 'reserved' | 'picked' | 'shipped' | 'returned' | 'quarantined' | 'written_off';
export declare class InventoryUnit {
    id: string;
    organizationId: string;
    inventoryItemId: string;
    warehouseId: string | null;
    locationId: string | null;
    serialPrivate: string | null;
    serialPublic: string | null;
    lotCode: string | null;
    conditionId: string | null;
    status: InventoryUnitStatus;
    reservationId: string | null;
    unitCost: string | null;
    sourceRef: string | null;
    receivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
