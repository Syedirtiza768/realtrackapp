import { DataSource, EntityManager } from 'typeorm';
import { InventoryItem, SourcingMode, TrackingMode } from './entities/index.js';
import { CreateItemDto, ItemsQueryDto, UpdateItemDto } from './dto/stock.dto.js';
import { StockAccessService, StockScope } from './stock-access.service.js';
import { StockLedgerService } from './stock-ledger.service.js';
export interface ProductRef {
    sku: string;
    vertical?: string | null;
    title?: string | null;
    imageUrl?: string | null;
    catalogProductId?: string | null;
    listingRecordId?: string | null;
    productVariantId?: string | null;
    trackingMode?: TrackingMode;
    sourcingMode?: SourcingMode;
}
export declare class InventoryItemsService {
    private readonly db;
    private readonly access;
    private readonly ledger;
    constructor(db: DataSource, access: StockAccessService, ledger: StockLedgerService);
    list(scope: StockScope, q: ItemsQueryDto, canSeeCost: boolean): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
            id: unknown;
            sku: unknown;
            title: unknown;
            imageUrl: unknown;
            vertical: unknown;
            trackingMode: unknown;
            sourcingMode: unknown;
            status: unknown;
            catalogProductId: unknown;
            listingRecordId: unknown;
            productVariantId: unknown;
            onHand: unknown;
            reserved: unknown;
            damaged: unknown;
            inbound: unknown;
            available: unknown;
            sourceable: unknown;
            sourceCount: unknown;
            pendingProcurement: unknown;
            lowStockThreshold: unknown;
            reorderPoint: unknown;
            breakdown: {};
            lastReceivedAt: unknown;
            unitCost: unknown;
            bestSourceCost: unknown;
            updatedAt: unknown;
        }[];
    }>;
    private mapListRow;
    get(scope: StockScope, id: string): Promise<InventoryItem>;
    detail(scope: StockScope, id: string, opts: {
        canSeeCost: boolean;
        canSeePrivateSerials: boolean;
    }): Promise<{
        item: {
            unitCost: string | null | undefined;
            id: string;
            organizationId: string;
            vertical: string;
            sku: string;
            title: string | null;
            imageUrl: string | null;
            catalogProductId: string | null;
            listingRecordId: string | null;
            productVariantId: string | null;
            trackingMode: TrackingMode;
            sourcingMode: SourcingMode;
            currency: string;
            barcode: string | null;
            lowStockThreshold: number;
            reorderPoint: number;
            reorderQty: number;
            status: import("./entities/inventory-item.entity.js").InventoryItemStatus;
            createdAt: Date;
            updatedAt: Date;
        };
        levels: any;
        units: any;
        reservations: any;
        procurement: any;
        channels: any;
        movements: any;
        links: Record<string, unknown>;
    }>;
    create(scope: StockScope, dto: CreateItemDto): Promise<InventoryItem>;
    update(scope: StockScope, id: string, dto: UpdateItemDto): Promise<InventoryItem>;
    private assertLinksInOrg;
    findOrCreate(em: EntityManager, organizationId: string, ref: ProductRef): Promise<InventoryItem>;
    scan(scope: StockScope, code: string, canSeePrivateSerials: boolean): Promise<{
        code: string;
        items: any;
        locations: any;
        units: any;
    }>;
}
