import { DataSource } from 'typeorm';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { TrackingMode } from './entities/index.js';
import { InventoryItemsService } from './inventory-items.service.js';
import { StockLedgerService } from './stock-ledger.service.js';
import { StockOperationsService } from './stock-operations.service.js';
export declare const STOCK_INTAKE_EVENT = "stock.intake.received";
export declare const STOCK_BI_UNITS_EVENT = "stock.bi-units.saved";
export declare const STOCK_FASHION_WAREHOUSE_EVENT = "stock.fashion-warehouse.saved";
export interface StockIntakePayload {
    organizationId?: string | null;
    userId?: string | null;
    sku: string;
    vertical: string;
    quantity: number;
    catalogProductId?: string | null;
    listingRecordId?: string | null;
    title?: string | null;
    imageUrl?: string | null;
    trackingMode?: TrackingMode;
    warehouseCode?: string | null;
    binCode?: string | null;
    conditionId?: string | null;
    lotCode?: string | null;
    unitCost?: number | null;
    idempotencyKey: string;
}
export declare class StockIntakeListener {
    private readonly db;
    private readonly userOrgs;
    private readonly items;
    private readonly ops;
    private readonly ledger;
    private readonly logger;
    constructor(db: DataSource, userOrgs: UserOrganizationService, items: InventoryItemsService, ops: StockOperationsService, ledger: StockLedgerService);
    private enabledOrg;
    onIntake(p: StockIntakePayload): Promise<void>;
    onBiUnits(p: {
        organizationId: string;
        catalogProductId: string;
        userId?: string | null;
    }): Promise<void>;
    onFashionWarehouse(p: {
        organizationId: string;
        fashionWarehouseId: string;
    }): Promise<void>;
}
