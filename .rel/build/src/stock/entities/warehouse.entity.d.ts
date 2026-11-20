export type WarehouseType = 'owned' | '3pl' | 'virtual';
export declare class Warehouse {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    type: WarehouseType;
    address: Record<string, string> | null;
    countryCode: string | null;
    timezone: string | null;
    ebayMerchantLocationKey: string | null;
    isDefault: boolean;
    isSellable: boolean;
    active: boolean;
    legacyFashionWarehouseId: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export type WarehouseLocationType = 'storage' | 'receiving' | 'staging' | 'returns' | 'quarantine';
export declare class WarehouseLocation {
    id: string;
    organizationId: string;
    warehouseId: string;
    code: string;
    zone: string | null;
    aisle: string | null;
    rack: string | null;
    shelf: string | null;
    bin: string | null;
    barcode: string | null;
    type: WarehouseLocationType;
    isPickable: boolean;
    capacityUnits: number | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
