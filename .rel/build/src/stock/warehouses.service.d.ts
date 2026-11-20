import { DataSource, EntityManager } from 'typeorm';
import { StoreStockPolicy, StoreWarehouseLink, UserWarehouseAssignment, Warehouse, WarehouseLocation } from './entities/index.js';
import { GenerateLocationsDto, LocationDto, SetStoreLinksDto, StorePolicyDto, UpdateLocationDto, UpdateWarehouseDto, WarehouseDto } from './dto/stock.dto.js';
import { StockAccessService, StockScope } from './stock-access.service.js';
import { StockLedgerService } from './stock-ledger.service.js';
export declare class WarehousesService {
    private readonly db;
    private readonly access;
    private readonly ledger;
    constructor(db: DataSource, access: StockAccessService, ledger: StockLedgerService);
    list(scope: StockScope, includeInactive?: boolean): Promise<any>;
    get(scope: StockScope, id: string): Promise<Warehouse>;
    create(scope: StockScope, dto: WarehouseDto): Promise<Warehouse>;
    update(scope: StockScope, id: string, dto: UpdateWarehouseDto): Promise<Warehouse>;
    ensureDefault(organizationId: string, em?: EntityManager, code?: string, name?: string): Promise<Warehouse>;
    private clearDefault;
    listLocations(scope: StockScope, warehouseId: string, includeInactive?: boolean): Promise<any>;
    createLocation(scope: StockScope, warehouseId: string, dto: LocationDto): Promise<WarehouseLocation>;
    generateLocations(scope: StockScope, warehouseId: string, dto: GenerateLocationsDto): Promise<{
        requested: number;
        created: number;
    }>;
    updateLocation(scope: StockScope, locationId: string, dto: UpdateLocationDto): Promise<WarehouseLocation>;
    storeOverview(scope: StockScope): Promise<any>;
    private assertStore;
    setStoreLinks(scope: StockScope, storeId: string, dto: SetStoreLinksDto): Promise<StoreWarehouseLink[]>;
    setStorePolicy(scope: StockScope, storeId: string, dto: StorePolicyDto): Promise<StoreStockPolicy>;
    ensurePolicy(em: EntityManager, organizationId: string, storeId: string): Promise<StoreStockPolicy>;
    markStoreDirty(em: EntityManager, organizationId: string, storeId: string): Promise<void>;
    getAssignments(scope: StockScope, userId: string): Promise<UserWarehouseAssignment[]>;
    setAssignments(scope: StockScope, userId: string, warehouseIds: string[]): Promise<{
        userId: string;
        warehouseIds: string[];
        restricted: boolean;
    }>;
}
