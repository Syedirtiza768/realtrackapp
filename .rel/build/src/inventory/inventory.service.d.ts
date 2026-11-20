import { DataSource, Repository } from 'typeorm';
import { InventoryLedger } from './entities/inventory-ledger.entity.js';
import { InventoryEvent } from './entities/inventory-event.entity.js';
import { StoreInventoryAllocation } from './entities/store-inventory-allocation.entity.js';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
export declare class InventoryService {
    private readonly ledgerRepo;
    private readonly eventRepo;
    private readonly allocationRepo;
    private readonly dataSource;
    private readonly featureFlags;
    private readonly logger;
    constructor(ledgerRepo: Repository<InventoryLedger>, eventRepo: Repository<InventoryEvent>, allocationRepo: Repository<StoreInventoryAllocation>, dataSource: DataSource, featureFlags: FeatureFlagService);
    getLedger(listingId: string): Promise<{
        ledger: InventoryLedger;
        recentEvents: InventoryEvent[];
    }>;
    getLowStock(threshold?: number, limit?: number): Promise<InventoryLedger[]>;
    getEvents(listingId?: string, type?: string, since?: string, limit?: number, offset?: number): Promise<{
        events: InventoryEvent[];
        total: number;
    }>;
    adjustQuantity(listingId: string, change: number, reason: string, idempotencyKey: string, sourceChannel?: string): Promise<{
        ledger: InventoryLedger;
        event: InventoryEvent;
    }>;
    reserveQuantity(listingId: string, quantity: number, orderId: string): Promise<{
        ledger: InventoryLedger;
        event: InventoryEvent;
    }>;
    releaseReservation(listingId: string, quantity: number, orderId: string): Promise<{
        ledger: InventoryLedger;
        event: InventoryEvent;
    }>;
    reconcile(listingIds: string[]): Promise<{
        results: Array<{
            listingId: string;
            status: string;
            diff?: number;
        }>;
    }>;
    findDuplicates(confidence?: number): Promise<Array<{
        idA: string;
        idB: string;
        matchType: string;
        score: number;
    }>>;
    getAllocations(listingId: string, storeId?: string): Promise<StoreInventoryAllocation[]>;
    allocateToStore(listingId: string, storeId: string, quantity: number): Promise<StoreInventoryAllocation>;
    reserveFromStore(listingId: string, storeId: string, quantity: number, orderId: string): Promise<StoreInventoryAllocation>;
}
