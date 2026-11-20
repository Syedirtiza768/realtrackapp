import { EntityManager } from 'typeorm';
import { ReservationsService } from '../../stock/reservations.service.js';
import { StockLedgerService } from '../../stock/stock-ledger.service.js';
import type { MotoarkLineDto } from './motoark.dto.js';
export interface MotoarkStockLine {
    id: string;
    inventory_item_id: string;
    order_item_id: string;
    quantity: number;
    shipped: number;
    cancelled: number;
}
export interface MotoarkStockContext {
    organizationId: string;
    actorUserId: string;
    storeId: string;
    orderId: string;
    eventKey: string;
}
export declare class MotoarkStockService {
    private readonly reservations;
    private readonly ledger;
    constructor(reservations: ReservationsService, ledger: StockLedgerService);
    reserve(em: EntityManager, ctx: MotoarkStockContext, line: MotoarkStockLine): Promise<void>;
    consume(em: EntityManager, ctx: MotoarkStockContext, line: MotoarkStockLine, quantity: number, ship: boolean): Promise<void>;
    returnAction(em: EntityManager, ctx: MotoarkStockContext, line: MotoarkStockLine, dto: MotoarkLineDto, returnId: string, action: string): Promise<void>;
    private validateWarehouse;
    private apply;
}
