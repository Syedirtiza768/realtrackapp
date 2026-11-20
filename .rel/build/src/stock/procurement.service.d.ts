import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { InventoryItem, InventoryItemSource, ProcurementRequest, StockDocument } from './entities/index.js';
import { CreateProcurementRequestDto, CreatePurchaseOrderDto, DropshipDto, FromRequestsDto, ProcurementQueryDto, ReceiveDocumentDto, UpdateProcurementRequestDto } from './dto/stock.dto.js';
import { StockAccessService, StockScope } from './stock-access.service.js';
import { StockLedgerService } from './stock-ledger.service.js';
import { StockOperationsService } from './stock-operations.service.js';
import { ReservationsService } from './reservations.service.js';
import { WarehousesService } from './warehouses.service.js';
export declare const ORDER_LINE_STOCK_EVENT = "stock.order-line.updated";
export declare class ProcurementService {
    private readonly db;
    private readonly access;
    private readonly ledger;
    private readonly ops;
    private readonly reservations;
    private readonly warehouses;
    private readonly events;
    private readonly logger;
    constructor(db: DataSource, access: StockAccessService, ledger: StockLedgerService, ops: StockOperationsService, reservations: ReservationsService, warehouses: WarehousesService, events: EventEmitter2);
    bestSource(em: EntityManager, itemId: string, mode?: 'ship_to_warehouse' | 'dropship'): Promise<InventoryItemSource | null>;
    requestForOrderLine(em: EntityManager, organizationId: string, item: InventoryItem, qty: number, target: {
        orderId: string;
        orderItemId: string;
        storeId: string | null;
        warehouseId: string | null;
    }): Promise<ProcurementRequest>;
    listRequests(scope: StockScope, q: ProcurementQueryDto): Promise<{
        total: any;
        items: any;
    }>;
    createRequest(scope: StockScope, dto: CreateProcurementRequestDto): Promise<ProcurementRequest>;
    updateRequest(scope: StockScope, id: string, dto: UpdateProcurementRequestDto): Promise<ProcurementRequest>;
    cancelRequest(scope: StockScope, id: string): Promise<ProcurementRequest>;
    private lockRequest;
    markDropshipped(scope: StockScope, id: string, dto: DropshipDto): Promise<ProcurementRequest>;
    createPurchaseOrder(scope: StockScope, dto: CreatePurchaseOrderDto): Promise<StockDocument>;
    purchaseOrdersFromRequests(scope: StockScope, dto: FromRequestsDto): Promise<StockDocument[]>;
    orderPurchaseOrder(scope: StockScope, id: string): Promise<StockDocument>;
    receivePurchaseOrder(scope: StockScope, id: string, dto: ReceiveDocumentDto): Promise<StockDocument>;
    cancelPurchaseOrder(scope: StockScope, id: string): Promise<StockDocument>;
    private lockPo;
    reorderSuggestions(scope: StockScope, createRequests?: boolean): Promise<{
        suggestions: {
            suggestedQty: number;
            id: string;
            reorderPoint: number;
            reorderQty: number;
            position: number;
        }[];
        created: number;
    }>;
    summary(scope: StockScope): Promise<Record<string, number>>;
}
