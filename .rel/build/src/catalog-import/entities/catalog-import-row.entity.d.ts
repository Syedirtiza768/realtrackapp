import { CatalogImport } from './catalog-import.entity.js';
import { CatalogProduct } from './catalog-product.entity.js';
export type ImportRowStatus = 'inserted' | 'duplicate_skipped' | 'duplicate_flagged' | 'updated' | 'invalid' | 'error';
export declare class CatalogImportRow {
    id: string;
    importId: string;
    import?: CatalogImport;
    rowNumber: number;
    status: ImportRowStatus;
    matchStrategy: string | null;
    matchedProductId: string | null;
    matchedProduct?: CatalogProduct;
    createdProductId: string | null;
    message: string | null;
    rawData: Record<string, string> | null;
    createdAt: Date;
}
