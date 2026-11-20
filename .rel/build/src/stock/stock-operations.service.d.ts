import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { InventoryItem, InventoryUnit, InventoryUnitStatus, StockDocument, StockDocumentType, Warehouse, WarehouseLocation } from './entities/index.js';
import { AdjustDto, CreateAdjustmentDocDto, CreateCountDto, CreateTransferDto, DamageDto, DocumentsQueryDto, MovementsQueryDto, MoveDto, ReceiveDocumentDto, ReceiveDto, RecordCountDto } from './dto/stock.dto.js';
import { StockAccessService, StockScope } from './stock-access.service.js';
import { StockLedgerService, StockMovementCommand } from './stock-ledger.service.js';
export declare const STOCK_RECEIVED_EVENT = "stock.received";
export declare const ADJUST_APPROVAL_QTY: number;
export interface OperationPerms {
    canApprove: boolean;
}
export declare class StockOperationsService {
    private readonly db;
    private readonly access;
    private readonly ledger;
    private readonly events;
    constructor(db: DataSource, access: StockAccessService, ledger: StockLedgerService, events: EventEmitter2);
    nextDocNumber(em: EntityManager, type: StockDocumentType): Promise<string>;
    loadItem(em: EntityManager, scope: StockScope, itemId: string): Promise<InventoryItem>;
    loadWarehouse(em: EntityManager, scope: StockScope, warehouseId: string): Promise<Warehouse>;
    assertLocation(em: EntityManager, warehouseId: string, locationId?: string | null): Promise<WarehouseLocation | null>;
    pickUnits(em: EntityManager, itemId: string, warehouseId: string, locationId: string | null | undefined, statuses: InventoryUnitStatus[], qty: number, preferred?: string | null): Promise<InventoryUnit[]>;
    private isUnitTracked;
    createReceivedUnits(em: EntityManager, scope: StockScope, item: InventoryItem, base: Omit<StockMovementCommand, 'onHand' | 'unitId' | 'unitPatch'>, quantity: number, opts: {
        serials?: string[];
        lotCode?: string | null;
        conditionId?: string | null;
        unitCost?: number | null;
        sourceRef?: string | null;
    }): Promise<StockMovementCommand[]>;
    receive(scope: StockScope, dto: ReceiveDto): Promise<{
        documentId: string | null;
        replayed: boolean;
        itemId: string;
    }>;
    afterReceipt(organizationId: string, itemIds: string[]): void;
    updateAverageCost(em: EntityManager, item: InventoryItem, qty: number, unitCost: number): Promise<void>;
    adjust(scope: StockScope, dto: AdjustDto, perms: OperationPerms): Promise<StockDocument | {
        status: string;
        message: string;
        id: string;
        organizationId: string;
        docType: StockDocumentType;
        docNumber: string;
        warehouseId: string;
        destWarehouseId: string | null;
        supplierId: string | null;
        reasonCode: string | null;
        reference: string | null;
        note: string | null;
        expectedAt: Date | null;
        currency: string | null;
        metadata: Record<string, unknown>;
        createdBy: string | null;
        approvedBy: string | null;
        completedBy: string | null;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    } | {
        status: string;
        replayed: boolean;
    }>;
    private afterAdjust;
    adjustmentCommands(em: EntityManager, scope: StockScope, item: InventoryItem, a: {
        warehouseId: string;
        locationId: string | null;
        unitId: string | null;
        quantity: number;
        reasonCode: string | null;
        note: string | null;
        type: 'adjustment' | 'count_variance';
        documentId: string | null;
    }): Promise<StockMovementCommand[]>;
    move(scope: StockScope, dto: MoveDto): Promise<{
        moved: number;
    }>;
    damage(scope: StockScope, dto: DamageDto): Promise<{
        ok: boolean;
    }>;
    createDocument(em: EntityManager, scope: StockScope, data: Partial<StockDocument> & {
        docType: StockDocumentType;
        warehouseId: string;
    }): Promise<StockDocument>;
    listDocuments(scope: StockScope, q: DocumentsQueryDto): Promise<{
        total: any;
        items: any;
    }>;
    getDocument(scope: StockScope, id: string): Promise<{
        lines: any;
        id: string;
        organizationId: string;
        docType: StockDocumentType;
        docNumber: string;
        status: import("./entities/stock-document.entity.js").StockDocumentStatus;
        warehouseId: string;
        destWarehouseId: string | null;
        supplierId: string | null;
        reasonCode: string | null;
        reference: string | null;
        note: string | null;
        expectedAt: Date | null;
        currency: string | null;
        metadata: Record<string, unknown>;
        createdBy: string | null;
        approvedBy: string | null;
        completedBy: string | null;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    cancelDocument(scope: StockScope, id: string): Promise<StockDocument>;
    createAdjustmentDocument(scope: StockScope, dto: CreateAdjustmentDocDto, perms: OperationPerms): Promise<StockDocument | {
        status: string;
        message: string;
        id: string;
        organizationId: string;
        docType: StockDocumentType;
        docNumber: string;
        warehouseId: string;
        destWarehouseId: string | null;
        supplierId: string | null;
        reasonCode: string | null;
        reference: string | null;
        note: string | null;
        expectedAt: Date | null;
        currency: string | null;
        metadata: Record<string, unknown>;
        createdBy: string | null;
        approvedBy: string | null;
        completedBy: string | null;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    approveAdjustment(scope: StockScope, id: string, perms: OperationPerms): Promise<StockDocument>;
    createTransfer(scope: StockScope, dto: CreateTransferDto): Promise<StockDocument>;
    shipTransfer(scope: StockScope, id: string): Promise<StockDocument>;
    receiveTransfer(scope: StockScope, id: string, dto: ReceiveDocumentDto): Promise<StockDocument>;
    createCount(scope: StockScope, dto: CreateCountDto): Promise<StockDocument>;
    recordCount(scope: StockScope, id: string, dto: RecordCountDto): Promise<{
        saved: number;
    }>;
    submitCount(scope: StockScope, id: string, perms: OperationPerms): Promise<StockDocument | {
        variances: number;
        message: string;
        id: string;
        organizationId: string;
        docType: StockDocumentType;
        docNumber: string;
        status: import("./entities/stock-document.entity.js").StockDocumentStatus;
        warehouseId: string;
        destWarehouseId: string | null;
        supplierId: string | null;
        reasonCode: string | null;
        reference: string | null;
        note: string | null;
        expectedAt: Date | null;
        currency: string | null;
        metadata: Record<string, unknown>;
        createdBy: string | null;
        approvedBy: string | null;
        completedBy: string | null;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    listMovements(scope: StockScope, q: MovementsQueryDto): Promise<{
        total: any;
        items: any;
    }>;
}
