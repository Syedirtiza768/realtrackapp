export interface BrandKnowledge {
    brand: string;
    vinPatterns: string;
    engineCodes: string;
    plantCodes: string;
    partNumberFormat: string;
    partNumberExamples: string[];
    commonAftermarketBrands: string[];
    modelsByYear: Record<string, string[]>;
}
export declare const BRAND_KNOWLEDGE: Record<string, BrandKnowledge>;
export declare function getBrandContext(brand: string): string;
