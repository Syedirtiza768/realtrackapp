export declare const SAFE_PUBLISH_FALLBACK_CATEGORY_ID = "9886";
export declare const SAFE_PUBLISH_FALLBACK_CATEGORY_NAME = "Other Car & Truck Parts & Accessories";
export interface SafePublishCategoryInput {
    categoryId?: string | null;
    categoryName?: string | null;
    listingText?: string | null;
}
export interface SafePublishCategoryResult {
    categoryId: string;
    changed: boolean;
}
export declare function resolveSafePublishCategory(input: SafePublishCategoryInput): SafePublishCategoryResult;
