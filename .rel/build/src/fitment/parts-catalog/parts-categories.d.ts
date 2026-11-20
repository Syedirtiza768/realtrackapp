export interface PartsSubcategory {
    id: string;
    label: string;
    requiresExactFitment: boolean;
    platformShareable: boolean;
    highDemand: boolean;
}
export interface PartsCategory {
    id: string;
    label: string;
    subcategories: PartsSubcategory[];
}
export declare const PARTS_CATEGORIES: PartsCategory[];
export declare function getPlatformShareableCategories(): string[];
export declare function getExactFitmentRequiredCategories(): string[];
export declare function getHighDemandCategories(): string[];
