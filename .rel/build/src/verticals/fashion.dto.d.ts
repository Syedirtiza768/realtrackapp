export declare class CreateFashionDraftDto {
    captureId?: string;
    sku: string;
    title: string;
    description?: string;
    brand?: string;
    conditionId?: string;
    price?: number;
    quantity?: number;
    imageUrls?: string[];
    categoryId?: string;
    categoryName?: string;
    verticalAttributes: Record<string, unknown>;
}
declare const UpdateFashionDraftDto_base: import("@nestjs/common").Type<Partial<CreateFashionDraftDto>>;
export declare class UpdateFashionDraftDto extends UpdateFashionDraftDto_base {
    verticalValidationStatus?: 'draft' | 'needs_review';
}
export declare class FashionReviewDto {
    decision: 'approved' | 'rejected';
    authenticityConfirmed: boolean;
    evidenceKeys?: string[];
    notes?: string;
}
export declare class FashionRoleDto {
    role: 'fashion_admin' | 'fashion_manager' | 'fashion_operator';
}
export declare class FashionStoreConfigDto {
    enabled: boolean;
}
export declare class FashionUserCreateDto extends FashionRoleDto {
    email: string;
    name?: string;
    password: string;
    storeIds?: string[];
}
export declare class FashionStoreAccessDto {
    storeIds: string[];
    accessLevel?: 'view' | 'operate' | 'admin';
}
export declare class AnalyzeFashionImagesDto {
    imageUrls: string[];
    currentAttributes?: Record<string, unknown>;
    confirmedKeys?: string[];
    sku?: string;
    currentTitle?: string;
    currentDescription?: string;
    currentBrand?: string;
    titleConfirmed?: boolean;
    descriptionConfirmed?: boolean;
    marketplaceId?: string;
}
export declare class GenerateFashionListingDto {
    verticalAttributes: Record<string, unknown>;
    brand?: string;
    title?: string;
    description?: string;
    conditionLabel?: string;
    titleConfirmed?: boolean;
    descriptionConfirmed?: boolean;
}
export declare class FashionWarehouseDto {
    code: string;
    name: string;
    countryCode?: string;
    active?: boolean;
}
export declare class UpdateFashionWarehouseDto {
    name?: string;
    countryCode?: string;
    active?: boolean;
}
export declare class NextFashionSkuDto {
    batch: string;
    sizeSuffix?: string;
}
export declare class FashionSizeChartDto {
    template: string;
    unit: 'cm' | 'in';
    values: Record<string, string>;
    brandName?: string;
    sku?: string;
}
export declare class FashionImageBannerDto {
    imageUrl: string;
    text: string;
    position: 'top' | 'bottom';
    theme: 'dark' | 'brand' | 'light';
}
export declare class CreateFashionIntakeDto {
    captureId?: string;
    sku: string;
    batch?: string;
    warehouseCode?: string;
    conditionId?: string;
    department?: string;
    categoryFamily?: 'clothing' | 'footwear' | 'accessories';
    labelSize?: string;
    frontImageUrl: string;
    backImageUrl: string;
    tagImageUrls: string[];
    additionalImageUrls?: string[];
    sizeChartImageUrl?: string;
    sizeChartTemplate?: string;
    measurementsUnit?: 'cm' | 'in';
    measurementValues?: Record<string, string>;
    price?: number;
    quantity?: number;
    identify?: boolean;
}
export {};
