export declare class BusinessIndustrialUnitDto {
    serialNumberPrivate: string;
    serialNumberPublic?: string;
}
export declare class CreateBusinessIndustrialDraftDto {
    sku: string;
    title: string;
    description?: string;
    brand?: string;
    manufacturer?: string;
    model?: string;
    mpn?: string;
    conditionId?: string;
    conditionLabel?: string;
    price?: number;
    quantity?: number;
    imageUrls?: string[];
    categoryId?: string;
    categoryName?: string;
    optimizedTitle?: string;
    optimizedDescription?: string;
    optimizationPayload?: Record<string, unknown>;
    seoScore?: number;
    readinessScore?: number;
    verticalAttributes: Record<string, unknown>;
    units?: BusinessIndustrialUnitDto[];
}
export declare class UpdateBusinessIndustrialDraftDto {
    title?: string;
    description?: string;
    brand?: string;
    manufacturer?: string;
    model?: string;
    mpn?: string;
    conditionId?: string;
    conditionLabel?: string;
    price?: number;
    quantity?: number;
    imageUrls?: string[];
    categoryId?: string;
    categoryName?: string;
    verticalAttributes?: Record<string, unknown>;
    units?: BusinessIndustrialUnitDto[];
}
export declare class BusinessIndustrialReviewDto {
    decision: 'approved' | 'rejected';
    provenanceConfirmed: boolean;
    specificationsVerified: boolean;
    testingReviewed: boolean;
    restrictedCategoryCleared?: boolean;
    evidenceKeys?: string[];
    riskFlags?: string[];
    notes?: string;
}
export declare class BusinessIndustrialRoleDto {
    role: 'business_industrial_admin' | 'business_industrial_manager' | 'business_industrial_operator';
}
export declare class BusinessIndustrialQuarantineDto {
    notes?: string;
}
export declare class BusinessIndustrialInviteDto extends BusinessIndustrialRoleDto {
    email: string;
    name?: string;
    storeIds?: string[];
}
export declare class BusinessIndustrialUserCreateDto extends BusinessIndustrialRoleDto {
    email: string;
    name?: string;
    password: string;
    storeIds?: string[];
}
export declare class BusinessIndustrialStoreAssignmentsDto {
    storeIds: string[];
    accessLevel?: 'view' | 'operate' | 'admin';
}
export declare class BusinessIndustrialStoreAccessDto {
    storeId: string;
    accessLevel: 'view' | 'operate' | 'admin';
}
export declare class BusinessIndustrialIncidentDto {
    externalEventId: string;
    catalogProductId: string;
    incidentType: 'counterfeit' | 'intellectual_property' | 'product_safety' | 'recalled_product' | 'other';
    verified: boolean;
    eventOccurredAt?: string;
    eventPayload?: Record<string, unknown>;
    notes?: string;
}
