import type { GuardResult } from './ai-routing-policy.types.js';
export declare function sanitizeTitle(title: string): string;
export declare function trimTitle(title: string, mpn?: string): string;
export declare function normalizeBrand(brand: string): string;
export declare function dedupeFitment(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>>;
export declare function applyListingGuards(item: Record<string, unknown>, srcPart: {
    partNumber?: string;
    condition?: string | null;
}): GuardResult;
export declare function detectHallucinatedPartNumbers(parts: Array<{
    part_name?: string;
    partName?: string;
    oem_part_number?: string;
    oemPartNumber?: string;
}>, brand: string): string[];
