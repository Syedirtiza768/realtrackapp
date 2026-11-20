export interface ExactOemYearRangeEvidenceRow {
    make?: string;
    model?: string;
    trim?: string;
    notes?: string;
    source?: string;
    evidenceSource?: string;
    mvlStatus?: string;
}
export interface ExactOemYearRangeTarget {
    make: string;
    model: string;
    trim?: string;
}
export interface ExactOemYearRange {
    startYear: number;
    endYear: number;
    make: string;
}
export declare function findCitedExactOemYearRange(rows: ExactOemYearRangeEvidenceRow[], expectedMpn: string | null | undefined, target: ExactOemYearRangeTarget, maxSpan: number, maxYear: number): ExactOemYearRange | null;
