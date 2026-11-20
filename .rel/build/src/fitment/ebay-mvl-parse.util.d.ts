import type { MvlMarketplace } from './ebay-mvl-marketplace.util.js';
export interface ParsedMvlEntry {
    epid?: string;
    make: string;
    model: string;
    year: number;
    trim?: string;
    engine?: string;
    submodel?: string;
    variant?: string;
    platform?: string;
    body?: string;
    ktype?: string;
    displayName?: string;
    extras?: Record<string, unknown>;
}
export declare function detectMvlMarketplaceFromFileName(fileName: string): MvlMarketplace | null;
export declare function detectMvlDataSheetName(sheetNames: string[], fileName: string): {
    marketplace: MvlMarketplace;
    sheetName: string;
} | null;
export declare function extractVersionLabel(fileName: string, sheetName: string): string;
export declare function expandYearsFromValue(raw: unknown): number[];
export declare function expandYearsFromDePeriod(period: unknown): number[];
export declare function parseUsMvlRow(row: Record<string, string>): ParsedMvlEntry[];
export declare function parseAuMvlRow(row: Record<string, string>): ParsedMvlEntry[];
export declare function parseUkMvlRow(row: Record<string, string>): ParsedMvlEntry[];
export declare function parseDeMvlRow(row: Record<string, string>): ParsedMvlEntry[];
export declare function parseMvlSheetRows(marketplace: MvlMarketplace, headers: string[], rows: unknown[][]): ParsedMvlEntry[];
