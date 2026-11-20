export interface PlatformGeneration {
    start: number;
    end: number;
    code: string;
}
export type PlatformRangesMap = Record<string, PlatformGeneration[]>;
export declare function normalizePlatformMake(make: string | null | undefined): string;
export declare function normalizePlatformModel(make: string | null | undefined, model: string | null | undefined): string;
export declare function buildPlatformKey(make: string | null | undefined, model: string | null | undefined): string;
export declare function resolvePlatformModelFromTitle(make: string | null | undefined, title: string | null | undefined, ranges?: PlatformRangesMap): string | null;
export declare function resolvePlatformGeneration(make: string | null | undefined, model: string | null | undefined, year: number | string | null | undefined, ranges?: PlatformRangesMap): PlatformGeneration | null;
export declare function formatYearRange(start: number, end: number): string;
export declare function parseYearRange(yearRange: string | null | undefined): {
    min: number;
    max: number;
} | null;
export declare function validateGenerationYearAlignment(input: {
    generation?: string | null;
    yearRange?: string | null;
    make?: string | null;
    model?: string | null;
    anchorYear?: number | string | null;
    ranges?: PlatformRangesMap;
}): {
    valid: boolean;
    message?: string;
    expected?: PlatformGeneration;
};
export declare function alignGenerationAndYearRange(input: {
    generation?: string | null;
    yearRange?: string | null;
    make?: string | null;
    model?: string | null;
    anchorYear?: number | string | null;
    fitmentYears?: Array<number | string | null | undefined>;
    ranges?: PlatformRangesMap;
}): {
    generation: string;
    yearRange: string;
};
export declare function extractFitmentVariantTokens(rows: Array<{
    trim?: string | null;
    submodel?: string | null;
    model?: string | null;
}>, max?: number): string[];
export declare function detectTitleGenerationMismatch(title: string, make?: string | null, model?: string | null, anchorYear?: number | string | null, ranges?: PlatformRangesMap): string | null;
export interface PlatformSeoTitleInput {
    make?: string | null;
    model?: string | null;
    year?: string | number | null;
    partType?: string | null;
    partName?: string | null;
    mpn?: string | null;
    placement?: string | null;
    fitmentRows?: Array<{
        year?: string;
        trim?: string;
        submodel?: string;
        model?: string;
    }>;
}
export declare function buildPlatformSeoTitle(input: PlatformSeoTitleInput): string;
export declare function getPlatformRanges(): PlatformRangesMap;
