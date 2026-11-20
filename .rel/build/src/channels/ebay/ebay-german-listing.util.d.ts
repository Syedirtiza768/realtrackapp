export interface GermanListingInput {
    brand?: string | null;
    model?: string | null;
    generation?: string | null;
    yearRange?: string | null;
    partType?: string | null;
    placement?: string | null;
    mpn?: string | null;
    oemPartNumber?: string | null;
    condition?: string | null;
    material?: string | null;
    color?: string | null;
    donorVehicle?: string | null;
    wearNotes?: string | null;
    fitmentRows?: Array<{
        year?: string;
        make?: string;
        model?: string;
        trim?: string;
    }>;
    fitmentConfirmed?: boolean;
    sellerCountry?: string | null;
    categoryId?: string | null;
    categoryName?: string | null;
}
export interface GermanListingValidationIssue {
    code: string;
    severity: 'error' | 'warning' | 'info';
    field?: string;
    message: string;
}
export interface GermanListingValidationResult {
    valid: boolean;
    issues: GermanListingValidationIssue[];
}
export declare const CATEGORY_KEYWORD_ROWS: Array<{
    kw: string[];
    id: string;
    name: string;
}>;
export declare function translatePartNameToGerman(partType: string | null | undefined): string;
export declare function formatGermanPlacement(placement: string | null | undefined): string;
export declare function formatGermanCondition(condition: string | null | undefined): string;
export declare function isLikelyGermanText(text: string): boolean;
export declare function hasAwkwardGermanPhrasing(text: string): boolean;
export declare function resolveMotorsCategoryFromPart(partType?: string | null, note?: string | null): {
    categoryId: string;
    categoryName: string;
} | null;
export declare function buildGermanListingTitle(input: GermanListingInput): string;
export declare function buildGermanListingSubtitle(input: GermanListingInput): string | null;
export declare function buildGermanListingDescription(input: GermanListingInput): string;
export declare function buildGermanItemSpecifics(input: GermanListingInput): Record<string, string>;
export declare function validateGermanListing(params: {
    title: string;
    description: string;
    itemSpecifics: Record<string, string>;
    categoryId?: string | null;
    categoryName?: string | null;
    partType?: string | null;
    placement?: string | null;
    mpn?: string | null;
    oemPartNumber?: string | null;
}): GermanListingValidationResult;
