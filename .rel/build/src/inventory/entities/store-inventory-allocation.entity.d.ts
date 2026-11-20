import { ListingRecord } from '../../listings/listing-record.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
export declare class StoreInventoryAllocation {
    id: string;
    listingId: string;
    listing: ListingRecord;
    storeId: string;
    store: Store;
    allocatedQty: number;
    reservedQty: number;
    availableQty: number | null;
    version: number;
    updatedAt: Date;
}
