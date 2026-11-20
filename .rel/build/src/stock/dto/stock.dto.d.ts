declare class OrgQueryDto {
    organizationId?: string;
}
export declare class WarehouseDto {
    code: string;
    name: string;
    type?: 'owned' | '3pl' | 'virtual';
    countryCode?: string;
    timezone?: string;
    address?: Record<string, string>;
    ebayMerchantLocationKey?: string;
    isDefault?: boolean;
    isSellable?: boolean;
    active?: boolean;
}
export declare class UpdateWarehouseDto {
    name?: string;
    type?: 'owned' | '3pl' | 'virtual';
    countryCode?: string;
    timezone?: string;
    address?: Record<string, string>;
    ebayMerchantLocationKey?: string;
    isDefault?: boolean;
    isSellable?: boolean;
    active?: boolean;
}
declare const LOCATION_TYPES: readonly ["storage", "receiving", "staging", "returns", "quarantine"];
export declare class LocationDto {
    code: string;
    zone?: string;
    aisle?: string;
    rack?: string;
    shelf?: string;
    bin?: string;
    barcode?: string;
    type?: (typeof LOCATION_TYPES)[number];
    isPickable?: boolean;
    capacityUnits?: number;
    active?: boolean;
}
export declare class UpdateLocationDto {
    zone?: string;
    barcode?: string;
    type?: (typeof LOCATION_TYPES)[number];
    isPickable?: boolean;
    capacityUnits?: number;
    active?: boolean;
}
export declare class GenerateLocationsDto {
    aisles: string[];
    racks: number;
    shelves: number;
    prefix?: string;
    zone?: string;
}
export declare class StoreLinkDto {
    warehouseId: string;
    priority?: number;
    active?: boolean;
}
export declare class SetStoreLinksDto {
    links: StoreLinkDto[];
}
export declare class StorePolicyDto {
    pushEnabled?: boolean;
    bufferQty?: number;
    maxQty?: number | null;
    includeSourceable?: boolean;
    maxSourceableQty?: number;
}
export declare class WarehouseAssignmentsDto {
    warehouseIds: string[];
}
declare const SUPPLIER_TYPES: readonly ["distributor", "manufacturer", "marketplace", "salvage_yard", "individual", "other"];
export declare class SupplierDto {
    code: string;
    name: string;
    type?: (typeof SUPPLIER_TYPES)[number];
    contactName?: string;
    email?: string;
    phone?: string;
    website?: string;
    currency?: string;
    defaultLeadTimeDays?: number;
    supportsDropship?: boolean;
    notes?: string;
    active?: boolean;
}
export declare class UpdateSupplierDto {
    name?: string;
    type?: (typeof SUPPLIER_TYPES)[number];
    contactName?: string;
    email?: string;
    phone?: string;
    website?: string;
    currency?: string;
    defaultLeadTimeDays?: number;
    supportsDropship?: boolean;
    notes?: string;
    active?: boolean;
}
export declare class ItemSourceDto {
    supplierId: string;
    supplierSku?: string;
    unitCost?: number;
    currency?: string;
    availableQty?: number | null;
    leadTimeDays?: number;
    priority?: number;
    fulfillmentMode?: 'ship_to_warehouse' | 'dropship';
    url?: string;
    active?: boolean;
}
export declare class ItemsQueryDto extends OrgQueryDto {
    q?: string;
    warehouseId?: string;
    filter?: string;
    sourcingMode?: string;
    status?: string;
    vertical?: string;
    sort?: string;
    dir?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
export declare class CreateItemDto {
    sku: string;
    title?: string;
    vertical?: string;
    catalogProductId?: string;
    listingRecordId?: string;
    productVariantId?: string;
    trackingMode?: 'quantity' | 'serial' | 'one_off';
    sourcingMode?: 'stocked' | 'on_demand' | 'hybrid';
    unitCost?: number;
    barcode?: string;
    lowStockThreshold?: number;
    reorderPoint?: number;
    reorderQty?: number;
}
export declare class UpdateItemDto {
    title?: string;
    catalogProductId?: string | null;
    listingRecordId?: string | null;
    productVariantId?: string | null;
    trackingMode?: 'quantity' | 'serial' | 'one_off';
    sourcingMode?: 'stocked' | 'on_demand' | 'hybrid';
    unitCost?: number | null;
    barcode?: string | null;
    lowStockThreshold?: number;
    reorderPoint?: number;
    reorderQty?: number;
    status?: 'active' | 'discontinued' | 'archived';
}
export declare class ReceiveDto {
    itemId: string;
    warehouseId: string;
    locationId?: string;
    quantity: number;
    unitCost?: number;
    serials?: string[];
    lotCode?: string;
    conditionId?: string;
    reference?: string;
    note?: string;
    idempotencyKey?: string;
}
export declare const ADJUSTMENT_REASONS: readonly ["found", "lost", "damaged", "theft", "correction", "write_off", "return_to_supplier", "sample", "other"];
export declare class AdjustDto {
    itemId: string;
    warehouseId: string;
    locationId?: string;
    quantity: number;
    reasonCode: (typeof ADJUSTMENT_REASONS)[number];
    unitId?: string;
    note?: string;
    idempotencyKey?: string;
}
export declare class MoveDto {
    itemId: string;
    warehouseId: string;
    fromLocationId?: string | null;
    toLocationId?: string | null;
    quantity: number;
    unitId?: string;
    idempotencyKey?: string;
}
export declare class DamageDto {
    itemId: string;
    warehouseId: string;
    locationId?: string;
    quantity: number;
    note?: string;
}
export declare class DocumentLineDto {
    itemId: string;
    locationId?: string;
    destLocationId?: string;
    unitId?: string;
    quantity: number;
    unitCost?: number;
    serials?: string[];
    note?: string;
}
export declare class CreateTransferDto {
    warehouseId: string;
    destWarehouseId: string;
    reference?: string;
    note?: string;
    expectedAt?: string;
    lines: DocumentLineDto[];
}
export declare class ReceiveLineDto {
    lineId: string;
    quantity: number;
    locationId?: string;
    serials?: string[];
}
export declare class ReceiveDocumentDto {
    lines: ReceiveLineDto[];
}
export declare class CreateAdjustmentDocDto {
    warehouseId: string;
    reasonCode: (typeof ADJUSTMENT_REASONS)[number];
    note?: string;
    lines: DocumentLineDto[];
}
export declare class CreateCountDto {
    warehouseId: string;
    locationIds?: string[];
    itemIds?: string[];
    note?: string;
}
export declare class CountLineDto {
    lineId?: string;
    itemId?: string;
    locationId?: string;
    countedQty: number;
}
export declare class RecordCountDto {
    lines: CountLineDto[];
}
export declare class DocumentsQueryDto extends OrgQueryDto {
    type?: string;
    status?: string;
    warehouseId?: string;
    supplierId?: string;
    limit?: number;
    offset?: number;
}
export declare class MovementsQueryDto extends OrgQueryDto {
    itemId?: string;
    warehouseId?: string;
    type?: string;
    orderId?: string;
    documentId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
}
export declare class ProcurementQueryDto extends OrgQueryDto {
    status?: string;
    supplierId?: string;
    itemId?: string;
    limit?: number;
    offset?: number;
}
export declare class CreateProcurementRequestDto {
    itemId: string;
    quantity: number;
    supplierId?: string;
    warehouseId?: string;
    fulfillmentMode?: 'ship_to_warehouse' | 'dropship';
    neededBy?: string;
    note?: string;
}
export declare class UpdateProcurementRequestDto {
    supplierId?: string;
    warehouseId?: string;
    fulfillmentMode?: 'ship_to_warehouse' | 'dropship';
    estimatedUnitCost?: number;
    note?: string;
}
export declare class CreatePurchaseOrderDto {
    supplierId: string;
    warehouseId: string;
    requestIds?: string[];
    lines?: DocumentLineDto[];
    reference?: string;
    note?: string;
    expectedAt?: string;
}
export declare class FromRequestsDto {
    requestIds: string[];
    warehouseId?: string;
}
export declare class DropshipDto {
    supplierTracking?: string;
    carrier?: string;
    unitCost?: number;
    note?: string;
}
export declare class ReorderSuggestDto {
    createRequests?: boolean;
}
export declare class BootstrapDto {
    dryRun?: boolean;
    openingBalances?: boolean;
    claimUnscopedAutomotive?: boolean;
    defaultWarehouseCode?: string;
    defaultWarehouseName?: string;
}
export declare class ScanDto {
    code: string;
}
export {};
