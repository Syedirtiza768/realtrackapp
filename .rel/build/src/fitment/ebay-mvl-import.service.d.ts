import { Repository } from 'typeorm';
import { EbayMvlEntry } from './entities/ebay-mvl-entry.entity.js';
import { EbayMvlRelease } from './entities/ebay-mvl-release.entity.js';
import type { MvlMarketplace } from './ebay-mvl-marketplace.util.js';
import { EbayMvlStoreService } from './ebay-mvl-store.service.js';
export interface EbayMvlImportResult {
    releaseId: string;
    marketplace: MvlMarketplace;
    versionLabel: string;
    fileName: string;
    fileSha256: string;
    sourceRowCount: number;
    entryCount: number;
    skippedDuplicate: boolean;
}
export interface EbayMvlDirectoryImportSummary {
    imported: EbayMvlImportResult[];
    errors: Array<{
        file: string;
        error: string;
    }>;
}
export declare class EbayMvlImportService {
    private readonly releaseRepo;
    private readonly entryRepo;
    private readonly store;
    private readonly logger;
    private readonly insertBatchSize;
    constructor(releaseRepo: Repository<EbayMvlRelease>, entryRepo: Repository<EbayMvlEntry>, store: EbayMvlStoreService);
    resolveAllowedDirectory(requested?: string): string;
    importDirectory(directory?: string, options?: {
        force?: boolean;
    }): Promise<EbayMvlDirectoryImportSummary>;
    importFile(filePath: string, marketplaceOverride?: MvlMarketplace, options?: {
        force?: boolean;
        password?: string;
    }): Promise<EbayMvlImportResult>;
    private parseAndInsertInChunks;
    private bulkInsertEntries;
}
