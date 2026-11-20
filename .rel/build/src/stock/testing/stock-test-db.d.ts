import { DataSource } from 'typeorm';
export declare const STOCK_IT_URL: string | undefined;
export declare function createStockTestDb(additionalEntities?: Function[]): Promise<{
    ds: DataSource;
    schema: string;
    close: () => Promise<void>;
}>;
export declare function seedBasics(ds: DataSource): Promise<{
    orgId: string;
    warehouseId: string;
    locationId: string;
    itemId: string;
    catalogProductId: string;
}>;
