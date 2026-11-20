export interface PartNumberValidationResult {
    valid: boolean;
    brand: string;
    formatDescription: string;
    confidence: number;
    matchesAnyBrand: boolean;
    matchedBrands: string[];
}
export declare function validatePartNumber(partNumber: string, brand: string): PartNumberValidationResult;
export declare function detectHallucinatedPartNumbers(parts: Array<{
    part_name?: string;
    oem_part_number?: string;
}>, brand: string): string[];
