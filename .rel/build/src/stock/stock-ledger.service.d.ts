import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { InventoryUnitStatus, StockMovement, StockMovementType } from './entities/index.js';
export interface StockMovementCommand {
    itemId: string;
    warehouseId: string;
    locationId?: string | null;
    type: StockMovementType;
    onHand?: number;
    reserved?: number;
    damaged?: number;
    inbound?: number;
    unitId?: string | null;
    unitPatch?: {
        status?: InventoryUnitStatus;
        warehouseId?: string | null;
        locationId?: string | null;
        reservationId?: string | null;
    };
    unitCost?: number | string | null;
    reasonCode?: string | null;
    note?: string | null;
    documentId?: string | null;
    sourceChannel?: string | null;
    storeId?: string | null;
    orderId?: string | null;
    orderItemId?: string | null;
}
export interface LedgerContext {
    organizationId: string;
    actorUserId?: string | null;
    operationKey?: string | null;
}
export interface LedgerResult {
    movements: StockMovement[];
    replayed: boolean;
}
export declare class InsufficientStockException extends ConflictException {
    readonly details: Array<{
        itemId: string;
        warehouseId: string;
        locationId: string | null;
        onHand: number;
        reserved: number;
        damaged: number;
        inbound: number;
    }>;
    constructor(details: Array<{
        itemId: string;
        warehouseId: string;
        locationId: string | null;
        onHand: number;
        reserved: number;
        damaged: number;
        inbound: number;
    }>);
}
export declare const STOCK_CHANGED_EVENT = "stock.changed";
export declare class StockLedgerService {
    private readonly db;
    private readonly events;
    private readonly logger;
    constructor(db: DataSource, events: EventEmitter2);
    apply(ctx: LedgerContext, commands: StockMovementCommand[], em?: EntityManager): Promise<LedgerResult>;
    emitChanged(organizationId: string, commands: Array<{
        itemId: string;
    }>): void;
    findByOperation(em: EntityManager, organizationId: string, operationKey: string): Promise<StockMovement[]>;
    markChannelDirty(em: EntityManager, organizationId: string, itemIds: string[]): Promise<void>;
    private validateCommands;
    private applyInTransaction;
    private assertOwnership;
    private projectLegacyQuantities;
}
export declare function isUniqueViolation(err: unknown, constraint?: string): boolean;
