import { resolveMotorsCategoryFromPart } from './ebay-german-listing.util.js';
export type EnglishMarketplace = 'US' | 'AU';
export interface EnglishListingInput {
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
export interface EnglishListingValidationIssue {
    code: string;
    severity: 'error' | 'warning' | 'info';
    field?: string;
    message: string;
}
export interface EnglishListingValidationResult {
    valid: boolean;
    issues: EnglishListingValidationIssue[];
}
export declare function buildEnglishListingTitle(input: EnglishListingInput): string;
export declare function buildEnglishListingDescription(input: EnglishListingInput, marketplace?: EnglishMarketplace): string;
export declare function buildEnglishItemSpecifics(input: EnglishListingInput): Record<string, string>;
export declare function applyAustralianSpelling(text: string): string;
export declare function shouldRebuildEnglishTitle(title: string, input: Pick<EnglishListingInput, 'brand' | 'model' | 'donorVehicle' | 'fitmentRows'>): boolean;
export declare function validateEnglishListing(params: {
    title: string;
    description: string;
    itemSpecifics: Record<string, string>;
    categoryId?: string | null;
    categoryName?: string | null;
    partType?: string | null;
    placement?: string | null;
    mpn?: string | null;
    oemPartNumber?: string | null;
}): EnglishListingValidationResult;
export { resolveMotorsCategoryFromPart };
