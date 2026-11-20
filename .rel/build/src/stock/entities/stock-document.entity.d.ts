export type StockDocumentType = 'receipt' | 'transfer' | 'adjustment' | 'count' | 'purchase_order';
export type StockDocumentStatus = 'draft' | 'pending_approval' | 'ordered' | 'in_transit' | 'partially_received' | 'completed' | 'cancelled';
export declare class StockDocument {
    id: string;
    organizationId: string;
    docType: StockDocumentType;
    docNumber: string;
    status: StockDocumentStatus;
    warehouseId: string;
    destWarehouseId: string | null;
    supplierId: string | null;
    reasonCode: string | null;
    reference: string | null;
    note: string | null;
    expectedAt: Date | null;
    currency: string | null;
    metadata: Record<string, unknown>;
    createdBy: string | null;
    approvedBy: string | null;
    completedBy: string | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare class StockDocumentLine {
    id: string;
    documentId: string;
    inventoryItemId: string;
    locationId: string | null;
    destLocationId: string | null;
    unitId: string | null;
    quantity: number;
    processedQty: number;
    countedQty: number | null;
    systemQty: number | null;
    unitCost: string | null;
    serials: string[];
    note: string | null;
    createdAt: Date;
}
