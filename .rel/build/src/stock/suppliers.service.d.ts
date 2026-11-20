import { DataSource } from 'typeorm';
import { InventoryItemSource, Supplier } from './entities/index.js';
import { ItemSourceDto, SupplierDto, UpdateSupplierDto } from './dto/stock.dto.js';
import { StockScope } from './stock-access.service.js';
import { StockLedgerService } from './stock-ledger.service.js';
export declare class SuppliersService {
    private readonly db;
    private readonly ledger;
    constructor(db: DataSource, ledger: StockLedgerService);
    list(scope: StockScope, includeInactive?: boolean): Promise<any>;
    get(scope: StockScope, id: string): Promise<Supplier>;
    create(scope: StockScope, dto: SupplierDto): Promise<Supplier>;
    update(scope: StockScope, id: string, dto: UpdateSupplierDto): Promise<Supplier>;
    listForItem(scope: StockScope, itemId: string): Promise<any>;
    upsertSource(scope: StockScope, itemId: string, dto: ItemSourceDto): Promise<InventoryItemSource>;
    removeSource(scope: StockScope, itemId: string, sourceId: string): Promise<{
        deleted: boolean;
    }>;
}
