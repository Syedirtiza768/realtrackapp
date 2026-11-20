import { Repository } from 'typeorm';
import type { PropertyValueOption } from './ebay-mvl.service.js';
import { EbayMvlEntry } from './entities/ebay-mvl-entry.entity.js';
import { EbayMvlRelease, type EbayMvlReleaseStatus } from './entities/ebay-mvl-release.entity.js';
import type { MvlMarketplace } from './ebay-mvl-marketplace.util.js';
export declare class EbayMvlStoreService {
    private readonly releaseRepo;
    private readonly entryRepo;
    private readonly logger;
    private readonly activeReleaseCache;
    constructor(releaseRepo: Repository<EbayMvlRelease>, entryRepo: Repository<EbayMvlEntry>);
    clearCache(marketplace?: MvlMarketplace): void;
    hasActiveRelease(marketplace: MvlMarketplace): Promise<boolean>;
    hasAnyActiveRelease(): Promise<boolean>;
    getActiveReleaseId(marketplace: MvlMarketplace): Promise<string | null>;
    listReleases(marketplace?: MvlMarketplace): Promise<EbayMvlRelease[]>;
    getStatusSummary(): Promise<Array<{
        marketplace: string;
        activeRelease: EbayMvlRelease | null;
        entryCount: number;
    }>>;
    getMakes(marketplace: MvlMarketplace, query?: string, limit?: number, offset?: number): Promise<{
        options: PropertyValueOption[];
        hasMore: boolean;
    }>;
    getModels(marketplace: MvlMarketplace, make: string, query?: string, limit?: number, offset?: number): Promise<{
        options: PropertyValueOption[];
        hasMore: boolean;
    }>;
    getYears(marketplace: MvlMarketplace, make: string, model: string): Promise<{
        options: PropertyValueOption[];
        hasMore: boolean;
    }>;
    getPropertyValues(marketplace: MvlMarketplace, propertyName: string, filters?: Record<string, string>, query?: string, limit?: number, offset?: number): Promise<{
        options: PropertyValueOption[];
        hasMore: boolean;
    }>;
    hasMake(marketplace: MvlMarketplace, make: string): Promise<boolean>;
    hasModel(marketplace: MvlMarketplace, make: string, model: string): Promise<boolean>;
    hasYear(marketplace: MvlMarketplace, make: string, model: string, year: string): Promise<boolean>;
    batchExistingMakes(marketplace: MvlMarketplace, makes: string[]): Promise<Set<string>>;
    batchExistingModels(marketplace: MvlMarketplace, pairs: Array<{
        make: string;
        model: string;
    }>): Promise<Set<string>>;
    batchExistingYears(marketplace: MvlMarketplace, triples: Array<{
        make: string;
        model: string;
        year: string;
    }>): Promise<Set<string>>;
    resolveCanonicalMakeModel(marketplace: MvlMarketplace, make: string, model?: string): Promise<{
        make?: string;
        model?: string;
        mvlMatched: boolean;
    }>;
    queryYearsInRange(marketplace: MvlMarketplace, make: string, model: string, yearStart: number, yearEnd: number): Promise<number[]>;
    queryModelsInYearRange(marketplace: MvlMarketplace, make: string, yearStart: number, yearEnd: number): Promise<Array<{
        model: string;
        minYear: number;
        maxYear: number;
    }>>;
    queryModelsByPlatform(marketplace: MvlMarketplace, make: string, platform: string): Promise<Array<{
        model: string;
        minYear: number;
        maxYear: number;
    }>>;
    filterRowsAgainstMvl(marketplace: MvlMarketplace, rows: Array<{
        year: string;
        make: string;
        model: string;
        trim?: string;
        engine?: string;
        submodel?: string;
        bodyType?: string;
        notes?: string;
        source: string;
        mvlSource?: string;
    }>): Promise<{
        accepted: typeof rows;
        rejectedCount: number;
        usedDb: boolean;
    }>;
    private pickCanonical;
    markReleaseStatus(releaseId: string, status: EbayMvlReleaseStatus, patch?: Partial<Pick<EbayMvlRelease, 'entryCount' | 'errorMessage' | 'importedAt'>>): Promise<void>;
    supersedeActiveRelease(marketplace: MvlMarketplace, exceptReleaseId?: string): Promise<void>;
    deleteEntriesForRelease(releaseId: string): Promise<void>;
}
