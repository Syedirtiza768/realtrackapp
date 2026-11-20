export declare class EbayCategoryMapping {
    id: string;
    ebayCategoryId: string;
    ebayCategoryName: string;
    parentCategoryId: string | null;
    parentCategoryName: string | null;
    productType: string | null;
    isMotorsCategory: boolean;
    supportsCompatibility: boolean;
    compatibilityProperties: string[] | null;
    listingPolicies: Record<string, any> | null;
    maxFitmentRows: number | null;
    keywords: string[] | null;
    active: boolean;
    createdAt: Date;
    lastSyncedAt: Date | null;
}
