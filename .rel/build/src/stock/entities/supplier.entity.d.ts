export type SupplierType = 'distributor' | 'manufacturer' | 'marketplace' | 'salvage_yard' | 'individual' | 'other';
export declare class Supplier {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    type: SupplierType;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    currency: string;
    defaultLeadTimeDays: number;
    supportsDropship: boolean;
    notes: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export type SourceFulfillmentMode = 'ship_to_warehouse' | 'dropship';
export declare class InventoryItemSource {
    id: string;
    organizationId: string;
    inventoryItemId: string;
    supplierId: string;
    supplierSku: string | null;
    unitCost: string | null;
    currency: string;
    availableQty: number | null;
    leadTimeDays: number | null;
    priority: number;
    fulfillmentMode: SourceFulfillmentMode;
    url: string | null;
    active: boolean;
    lastCheckedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
