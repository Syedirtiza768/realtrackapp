import { DataSource } from 'typeorm';
import { BootstrapDto } from './dto/stock.dto.js';
import { StockScope } from './stock-access.service.js';
import { StockLedgerService } from './stock-ledger.service.js';
import { WarehousesService } from './warehouses.service.js';
export interface BootstrapReport {
    dryRun: boolean;
    defaultWarehouse: {
        id: string;
        code: string;
    };
    warehousesFromFashion: number;
    items: {
        fromCatalog: number;
        fromListings: number;
        fromVariants: number;
        total: number;
    };
    serialUnitsImported: number;
    openingBalances: {
        items: number;
        units: number;
        skippedAlreadyStocked: number;
    };
    storesLinked: number;
    conflicts: Array<{
        kind: string;
        sku: string;
        detail: string;
    }>;
}
export declare class StockSetupService {
    private readonly db;
    private readonly ledger;
    private readonly warehouses;
    private readonly logger;
    constructor(db: DataSource, ledger: StockLedgerService, warehouses: WarehousesService);
    private hasFashionWarehouses;
    status(scope: StockScope): Promise<{
        initialized: boolean;
    }>;
    bootstrap(scope: StockScope, dto: BootstrapDto): Promise<BootstrapReport>;
    private run;
}
