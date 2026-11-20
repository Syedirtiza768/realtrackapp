import { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import { type ParsedFitmentRow } from './fitment-mvl.util.js';
import { EbayMvlStoreService } from './ebay-mvl-store.service.js';
export interface CompatibilityProperty {
    propertyName: string;
    localizedPropertyName: string;
}
export interface CompatibilityTree {
    categoryId: string;
    categoryTreeId: string;
    properties: CompatibilityProperty[];
}
export interface PropertyValueOption {
    label: string;
    value: string;
}
export interface FitmentSelection {
    make: string;
    model: string;
    year: string;
    trim?: string;
    engine?: string;
    notes?: string;
}
export interface EbayCompatibilityEntry {
    compatibilityProperties: Array<{
        name: string;
        value: string;
    }>;
    notes?: string;
}
export type MvlRowStatus = 'valid' | 'needs_review' | 'rejected';
export interface MvlValidatedRow {
    row: ParsedFitmentRow;
    status: MvlRowStatus;
    rejectedReason?: string;
    serialized: Record<string, unknown>;
}
export interface MvlValidationSummary {
    accepted: Record<string, unknown>[];
    rejectedCount: number;
    needsReviewCount: number;
    validCount: number;
    apiUnavailable: boolean;
}
export declare class EbayMvlService {
    private readonly taxonomyApi;
    private readonly store;
    private readonly logger;
    private static readonly DEFAULT_TREE_ID;
    static readonly MOTORS_PARTS_CATEGORY = "6000";
    constructor(taxonomyApi: EbayTaxonomyApiService, store: EbayMvlStoreService);
    fetchCompatibilityTree(categoryId: string, treeId?: string): Promise<CompatibilityTree>;
    getPropertyValues(categoryId: string, propertyName: string, filters?: Record<string, string>, query?: string, limit?: number, offset?: number, treeId?: string): Promise<{
        options: PropertyValueOption[];
        hasMore: boolean;
    }>;
    private getPropertyValuesFromApi;
    buildCompatibilityArray(selections: FitmentSelection[]): EbayCompatibilityEntry[];
    getMakes(categoryId: string, query?: string, limit?: number, offset?: number, treeId?: string): Promise<{
        options: PropertyValueOption[];
        hasMore: boolean;
    }>;
    getModels(categoryId: string, make: string, query?: string, limit?: number, offset?: number, treeId?: string): Promise<{
        options: PropertyValueOption[];
        hasMore: boolean;
    }>;
    getYears(categoryId: string, make: string, model: string, treeId?: string): Promise<{
        options: PropertyValueOption[];
        hasMore: boolean;
    }>;
    resolveCanonicalMakeModel(categoryId: string, make: string, model?: string, treeId?: string): Promise<{
        make?: string;
        model?: string;
        mvlMatched: boolean;
    }>;
    validateFitmentData(fitmentData: Record<string, unknown>[] | null | undefined, categoryId: string, options?: {
        keepNeedsReview?: boolean;
        treeId?: string;
    }): Promise<MvlValidationSummary>;
    validateParsedRows(rows: ParsedFitmentRow[], categoryId: string, treeId?: string): Promise<MvlValidatedRow[]>;
    private validateSingleRowFromStore;
    private validateParsedRowsFromStore;
    private mapWithConcurrency;
    private validateSingleRowFromApi;
    private pickCanonical;
}
