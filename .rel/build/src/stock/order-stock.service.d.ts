import { DataSource, EntityManager } from 'typeorm';
import { StockAccessService, StockScope } from './stock-access.service.js';
import { StockLedgerService } from './stock-ledger.service.js';
import { ReservationsService } from './reservations.service.js';
import { ProcurementService } from './procurement.service.js';
import { WarehousesService } from './warehouses.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
export type OrderLineStockStatus = 'unmatched' | 'reserved' | 'picked' | 'awaiting_procurement' | 'backorder' | 'dropshipped' | 'shipped' | 'released';
export declare class OrderStockService {
    private readonly db;
    private readonly access;
    private readonly ledger;
    private readonly reservations;
    private readonly procurement;
    private readonly warehouses;
    private readonly notifications;
    private readonly logger;
    constructor(db: DataSource, access: StockAccessService, ledger: StockLedgerService, reservations: ReservationsService, procurement: ProcurementService, warehouses: WarehousesService, notifications: NotificationsService);
    onOrderNew(payload: {
        orderId: string;
    }): Promise<void>;
    onOrderCancelled(payload: {
        orderId: string;
    }): Promise<void>;
    onOrderShipped(payload: {
        orderId: string;
    }): Promise<void>;
    onStockReceived(payload: {
        organizationId: string;
        itemIds: string[];
    }): Promise<void>;
    onLineUpdated(payload: {
        orderItemId: string;
    }): Promise<void>;
    private safe;
    allocateOrder(orderId: string, opts?: {
        reclaimOpenRequests?: boolean;
    }): Promise<{
        orderId: string;
        alerts: {
            status: OrderLineStockStatus;
            sku: string | null;
        }[];
    } | undefined>;
    private allocateOnce;
    private coveredQty;
    private canSource;
    private receivingWarehouseFor;
    private reclaimOpenRequests;
    private resolveItem;
    refreshLineStatus(em: EntityManager, orderItemId: string): Promise<OrderLineStockStatus>;
    allocateBackorders(organizationId: string, itemIds: string[]): Promise<{
        orders: number;
    }>;
    releaseOrder(orderId: string, actorUserId: string | null): Promise<{
        released: number;
    }>;
    pickOrder(scope: StockScope, orderId: string): Promise<{
        picked: number;
    }>;
    shipOrder(orderId: string, actorUserId: string | null): Promise<{
        shipped: number;
        warnings: string[];
    }>;
    private assertOrderInScope;
    orderStock(scope: StockScope, orderId: string): Promise<{
        orderId: string;
        lines: any;
    }>;
    exceptions(scope: StockScope): Promise<any>;
    linkLine(scope: StockScope, orderId: string, orderItemId: string, itemId: string): Promise<{
        orderId: string;
        alerts: {
            status: OrderLineStockStatus;
            sku: string | null;
        }[];
    } | undefined>;
    pickList(scope: StockScope, warehouseId?: string): Promise<any>;
    private notifyLines;
}
