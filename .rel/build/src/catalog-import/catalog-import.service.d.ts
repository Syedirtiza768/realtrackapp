import type { ProductVertical } from '../verticals/vertical.types.js';
import type { Queue } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { CatalogImport } from './entities/catalog-import.entity.js';
import { CatalogImportRow } from './entities/catalog-import-row.entity.js';
import { CatalogProduct } from './entities/catalog-product.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import type { CsvImportJobData } from './processors/csv-import.processor.js';
import { HeavyJobLimiterService } from '../common/jobs/heavy-job-limiter.service.js';
export interface ImportAccessScope {
    organizationId: string;
    viewerId: string;
    viewAll: boolean;
    verticals: ProductVertical[];
}
export interface ImportVerificationSummary {
    importId: string;
    expectedInsertedRows: number;
    catalogProductsByImport: number;
    listingRecordsByImport: number;
    sampleSkus: string[];
    db: {
        database: string;
        schema: string;
    } | null;
}
export interface BackfillListingsResult {
    scannedImports: number;
    insertedListingRecords: number;
    imports: Array<{
        importId: string;
        fileName: string;
        catalogProducts: number;
        insertedListingRecords: number;
    }>;
}
export declare class CatalogImportService {
    private readonly importRepo;
    private readonly rowRepo;
    private readonly productRepo;
    private readonly listingRepo;
    private readonly importQueue;
    private readonly dataSource;
    private readonly heavyJobLimiter;
    private readonly logger;
    private readonly uploadDir;
    constructor(importRepo: Repository<CatalogImport>, rowRepo: Repository<CatalogImportRow>, productRepo: Repository<CatalogProduct>, listingRepo: Repository<ListingRecord>, importQueue: Queue<CsvImportJobData>, dataSource: DataSource, heavyJobLimiter: HeavyJobLimiterService);
    clearAllCatalog(confirm: string): Promise<{
        motorsProductsUnlinked: number;
        listingRecordsDeleted: number;
        catalogProductsDeleted: number;
        catalogImportsDeleted: number;
        catalogImportRowsDeleted: number;
        complianceAuditLogsDeleted: number;
    }>;
    handleUpload(file: Express.Multer.File, columnMapping?: Record<string, string>, userId?: string, vertical?: ProductVertical, organizationId?: string): Promise<CatalogImport>;
    private convertExcelToCsv;
    startImport(importId: string, columnMapping?: Record<string, string>, actorId?: string, viewAll?: boolean): Promise<CatalogImport>;
    listImports(status?: string, limit?: number, offset?: number, viewerId?: string, viewAll?: boolean, scope?: ImportAccessScope): Promise<{
        imports: CatalogImport[];
        total: number;
    }>;
    getImport(id: string, viewerId?: string, viewAll?: boolean, scope?: ImportAccessScope): Promise<{
        import: CatalogImport;
        verification: ImportVerificationSummary | null;
    }>;
    private applyImportScope;
    previewImport(record: CatalogImport): Promise<Record<string, string>[]>;
    getImportRows(importId: string, status?: string, limit?: number, offset?: number): Promise<{
        rows: CatalogImportRow[];
        total: number;
    }>;
    cancelImport(id: string, actorId?: string, viewAll?: boolean): Promise<CatalogImport>;
    retryImport(id: string, actorId?: string, viewAll?: boolean): Promise<CatalogImport>;
    getImportStats(scope?: ImportAccessScope): Promise<{
        totalImports: number;
        totalProductsInserted: number;
        totalDuplicatesSkipped: number;
        totalInvalidRows: number;
        totalCatalogProducts: number;
        recentImports: CatalogImport[];
    }>;
    backfillListings(importId?: string): Promise<BackfillListingsResult>;
    private logicalLineIterator;
    private scanUploadedCsvForMetadata;
    autoMapColumns(headers: string[]): Record<string, string>;
    private parseCsvLine;
    getCatalogFields(): Array<{
        field: string;
        label: string;
        required: boolean;
    }>;
    private buildVerificationSummary;
    private mapCatalogProductToListingRecord;
}
