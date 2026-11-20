export declare const MAX_FITMENT_YEAR_SPAN = 12;
export declare const MAX_UNSCOPED_MVL_ROWS = 80;
export interface MvlYearRow {
    year: number | string;
    [key: string]: unknown;
}
export declare function scopeMvlRowsByDonorYear<T extends MvlYearRow>(rows: T[], donorYear: number | string | null | undefined, opts?: {
    nearYears?: number;
    wideYears?: number;
    minScoped?: number;
}): {
    rows: T[];
    scoped: boolean;
    reason: string;
};
export declare function isOverExpandedFitment(rows: Array<Record<string, unknown>>, opts?: {
    maxSpan?: number;
    maxRows?: number;
}): boolean;
export declare function yearRangeFromRows(rows: Array<{
    year?: number | string;
}>, fallbackYear?: number | string | null): string;
export declare function pickDonorYear(candidates: Array<number | string | null | undefined>): number | null;
