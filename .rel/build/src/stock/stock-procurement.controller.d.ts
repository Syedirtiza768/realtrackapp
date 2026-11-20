import { User } from '../auth/entities/user.entity.js';
import { CreateProcurementRequestDto, CreatePurchaseOrderDto, DropshipDto, FromRequestsDto, ProcurementQueryDto, ReceiveDocumentDto, ReorderSuggestDto, SupplierDto, UpdateProcurementRequestDto, UpdateSupplierDto } from './dto/stock.dto.js';
import { StockAccessService } from './stock-access.service.js';
import { SuppliersService } from './suppliers.service.js';
import { ProcurementService } from './procurement.service.js';
import { OrderStockService } from './order-stock.service.js';
import { ChannelStockSyncService } from './channel-stock-sync.service.js';
declare class LinkLineDto {
    itemId: string;
}
export declare class StockProcurementController {
    private readonly access;
    private readonly suppliers;
    private readonly procurement;
    private readonly orders;
    private readonly channels;
    constructor(access: StockAccessService, suppliers: SuppliersService, procurement: ProcurementService, orders: OrderStockService, channels: ChannelStockSyncService);
    private scope;
    listSuppliers(user: User, org?: string, inactive?: string): Promise<any>;
    createSupplier(user: User, dto: SupplierDto, org?: string): Promise<import("./entities/supplier.entity.js").Supplier>;
    updateSupplier(user: User, id: string, dto: UpdateSupplierDto, org?: string): Promise<import("./entities/supplier.entity.js").Supplier>;
    procurementSummary(user: User, org?: string): Promise<Record<string, number>>;
    listRequests(user: User, q: ProcurementQueryDto, org?: string): Promise<{
        total: any;
        items: any;
    }>;
    createRequest(user: User, dto: CreateProcurementRequestDto, org?: string): Promise<import("./entities/stock-movement.entity.js").ProcurementRequest>;
    updateRequest(user: User, id: string, dto: UpdateProcurementRequestDto, org?: string): Promise<import("./entities/stock-movement.entity.js").ProcurementRequest>;
    cancelRequest(user: User, id: string, org?: string): Promise<import("./entities/stock-movement.entity.js").ProcurementRequest>;
    dropship(user: User, id: string, dto: DropshipDto, org?: string): Promise<import("./entities/stock-movement.entity.js").ProcurementRequest>;
    reorder(user: User, org?: string): Promise<{
        suggestions: {
            suggestedQty: number;
            id: string;
            reorderPoint: number;
            reorderQty: number;
            position: number;
        }[];
        created: number;
    }>;
    createReorder(user: User, dto: ReorderSuggestDto, org?: string): Promise<{
        suggestions: {
            suggestedQty: number;
            id: string;
            reorderPoint: number;
            reorderQty: number;
            position: number;
        }[];
        created: number;
    }>;
    createPo(user: User, dto: CreatePurchaseOrderDto, org?: string): Promise<import("./entities/stock-document.entity.js").StockDocument>;
    poFromRequests(user: User, dto: FromRequestsDto, org?: string): Promise<import("./entities/stock-document.entity.js").StockDocument[]>;
    orderPo(user: User, id: string, org?: string): Promise<import("./entities/stock-document.entity.js").StockDocument>;
    receivePo(user: User, id: string, dto: ReceiveDocumentDto, org?: string): Promise<import("./entities/stock-document.entity.js").StockDocument>;
    cancelPo(user: User, id: string, org?: string): Promise<import("./entities/stock-document.entity.js").StockDocument>;
    exceptions(user: User, org?: string): Promise<any>;
    pickList(user: User, warehouseId?: string, org?: string): Promise<any>;
    orderStock(user: User, orderId: string, org?: string): Promise<{
        orderId: string;
        lines: any;
    }>;
    allocate(user: User, orderId: string, org?: string): Promise<{
        orderId: string;
        alerts: {
            status: import("./order-stock.service.js").OrderLineStockStatus;
            sku: string | null;
        }[];
    } | undefined>;
    pick(user: User, orderId: string, org?: string): Promise<{
        picked: number;
    }>;
    linkLine(user: User, orderId: string, orderItemId: string, dto: LinkLineDto, org?: string): Promise<{
        orderId: string;
        alerts: {
            status: import("./order-stock.service.js").OrderLineStockStatus;
            sku: string | null;
        }[];
    } | undefined>;
    channelSync(user: User, storeId?: string, status?: string, driftOnly?: string, limit?: string, offset?: string, org?: string): Promise<{
        total: any;
        items: any;
    }>;
    channelSummary(user: User, org?: string): Promise<{
        pushGloballyEnabled: boolean;
    }>;
    resync(user: User, storeId?: string, org?: string): Promise<{
        processed: number;
        pushed: number;
        failed: number;
    }>;
}
export {};
