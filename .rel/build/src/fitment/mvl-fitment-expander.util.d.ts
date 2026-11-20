import { type PlatformGeneration, type PlatformRangesMap } from './platform-generation.util.js';
export type FitmentExpansionMode = 'mvl' | 'hybrid' | 'ai';
export type FitmentAiInterchange = 'off' | 'auto' | 'always';
export type SiblingExpansionMode = 'off' | 'conservative' | 'aggressive';
export type PartExpansionTier = 'body' | 'interior' | 'mechanical' | 'electrical' | 'general';
export interface FitmentRangeRow {
    yearStart: number;
    yearEnd: number;
    make: string;
    model: string;
    trim?: string;
    engine?: string;
    chassisCode?: string;
    bodyType?: string;
    notes?: string;
    source: string;
}
export interface ExpandedFitmentRow {
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
}
export interface DonorVehicle {
    year: string;
    make: string;
    model: string;
    trim?: string;
    engine?: string;
    bodyClass?: string;
}
export declare function resolveFitmentExpansionMode(raw?: string | null): FitmentExpansionMode;
export declare function resolveFitmentAiInterchange(raw?: string | null): FitmentAiInterchange;
export declare function getFitmentMinMvlRows(raw?: string | null): number;
export declare function getSiblingExpansionMode(raw?: string | null): SiblingExpansionMode;
export declare function normalizeFitmentBrand(brand: string): string;
export declare function classifyPartExpansion(partType?: string, placement?: string): PartExpansionTier;
export declare function fitmentRowKey(row: ExpandedFitmentRow): string;
export declare function addUniqueFitmentRow(fitments: ExpandedFitmentRow[], seen: Set<string>, entry: ExpandedFitmentRow): boolean;
export declare function collapseYearRanges(rows: ExpandedFitmentRow[]): FitmentRangeRow[];
export declare function evaluateNeedsAiInterchange(rowCount: number, minRows: number, tier: PartExpansionTier, aiInterchangeMode: FitmentAiInterchange): boolean;
export interface DeterministicExpandInput {
    donor: DonorVehicle;
    partType?: string;
    placement?: string;
    profile?: 'compact' | 'full';
    siblingMode?: SiblingExpansionMode;
    maxRows?: number;
    platformRanges?: PlatformRangesMap;
    sharedPlatforms?: Record<string, string[]>;
    resolveEbayModel?: (make: string, model: string, trim?: string) => {
        model: string;
        trim: string;
    };
}
export interface DeterministicExpandResult {
    ranges: FitmentRangeRow[];
    expandedRows: ExpandedFitmentRow[];
    tier: PartExpansionTier;
    platformKey: string;
    generation: PlatformGeneration | null;
    coverage: {
        platformYears: number;
        siblingModels: number;
        crossVin: number;
        sharedPlatform: number;
        mvlRejected: number;
    };
}
export declare function expandFitmentDeterministic(input: DeterministicExpandInput): DeterministicExpandResult;
