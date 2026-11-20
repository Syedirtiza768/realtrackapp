import { EntityManager } from 'typeorm';
import { InventoryItem, StockReservation } from './entities/index.js';
import { StockLedgerService } from './stock-ledger.service.js';
import { StockOperationsService } from './stock-operations.service.js';
export interface ReservationTarget {
    orderId: string | null;
    orderItemId: string | null;
    storeId: string | null;
}
export interface CandidateLevel {
    warehouseId: string;
    locationId: string | null;
    available: number;
    priority: number;
    isPickable: boolean;
}
export declare class ReservationsService {
    private readonly ledger;
    private readonly ops;
    constructor(ledger: StockLedgerService, ops: StockOperationsService);
    candidates(em: EntityManager, organizationId: string, itemId: string, storeId: string | null, needed: number): Promise<CandidateLevel[]>;
    allocate(em: EntityManager, organizationId: string, actorUserId: string | null, item: InventoryItem, needed: number, target: ReservationTarget, restrictTo?: {
        warehouseId: string;
        locationId: string | null;
    }): Promise<number>;
    reserveAt(em: EntityManager, organizationId: string, actorUserId: string | null, item: InventoryItem, warehouseId: string, locationId: string | null, qty: number, target: ReservationTarget): Promise<StockReservation>;
    release(em: EntityManager, organizationId: string, actorUserId: string | null, reservations: StockReservation[], note: string): Promise<string[]>;
}
