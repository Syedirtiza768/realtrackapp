import { ListingRecord } from '../../listings/listing-record.entity.js';
export declare class InventoryLedger {
    id: string;
    listingId: string;
    listing: ListingRecord;
    quantityTotal: number;
    quantityReserved: number;
    quantityAvailable: number | null;
    quantityListedEbay: number;
    quantityListedShopify: number;
    lowStockThreshold: number;
    reorderPoint: number;
    version: number;
    lastReconciledAt: Date | null;
    updatedAt: Date;
}
