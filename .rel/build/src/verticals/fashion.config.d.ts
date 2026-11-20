import type { ProductAttributes } from './vertical.types.js';
export declare const FASHION_VERTICAL: "fashion";
export declare const FASHION_CATEGORY_FAMILIES: readonly [{
    readonly id: "clothing";
    readonly label: "Clothing";
}, {
    readonly id: "footwear";
    readonly label: "Footwear";
}, {
    readonly id: "accessories";
    readonly label: "Accessories";
}];
export type FashionCategoryFamily = (typeof FASHION_CATEGORY_FAMILIES)[number]['id'];
export declare const FASHION_META_KEYS: readonly ["_suggestedKeys", "_confirmedKeys", "_conflictKeys", "_conflictNotes", "_warnings", "_multipleItems", "_lastAnalyzedAt", "_analysisStatus", "_titleConfirmed", "_descriptionConfirmed", "_intakeSource", "_intakeBatch", "_warehouseCode", "_warehouseName", "_intakeAccountId", "_intakeMarketplaceId", "_intakeCreatedBy", "_captureId", "_photoRoles", "_sizeChartImageUrl", "_analysisQueuedAt"];
export type FashionFieldDef = {
    key: string;
    label: string;
    input: 'text' | 'textarea';
    families: FashionCategoryFamily[];
    help?: string;
};
export declare const FASHION_FIELD_GROUPS: Array<{
    id: string;
    label: string;
    fields: FashionFieldDef[];
}>;
export declare const FASHION_ATTRIBUTE_FIELDS: FashionFieldDef[];
export declare function isFashionCategoryFamily(value: unknown): value is FashionCategoryFamily;
export declare function normalizeFashionCategoryFamily(value: unknown): FashionCategoryFamily;
export declare function normalizeFashionDepartment(value: unknown): string | null;
export declare function fashionFieldsForFamily(family: FashionCategoryFamily): FashionFieldDef[];
export declare function isFashionMetaKey(key: string): boolean;
export declare function compatibleFashionAttributes(family: FashionCategoryFamily, attributes: ProductAttributes): ProductAttributes;
export declare function validateFashionAttributes(value: unknown): {
    attributes: ProductAttributes;
    errors: string[];
    warnings: string[];
};
export declare function fashionImportAttributeKeys(): string[];
export type FashionSuggestionConflict = {
    key: string;
    current: string;
    suggested: string;
};
export declare function mergeFashionSuggestions(params: {
    current: ProductAttributes;
    suggested: ProductAttributes;
    confirmedKeys?: string[];
}): {
    attributes: ProductAttributes;
    suggestedKeys: string[];
    conflicts: FashionSuggestionConflict[];
};
export declare function buildFashionListingContent(params: {
    brand?: string | null;
    title?: string | null;
    attributes: ProductAttributes;
    conditionLabel?: string | null;
}): {
    title: string;
    description: string;
};
export declare function suggestFashionSku(itemType?: string | null): string;
export declare function fashionAttributeKeyForAspect(name: string): string | null;
export declare function fashionAspectsFromAttributes(attributes: ProductAttributes, brand?: string | null): Record<string, string[]>;
export declare function applyFashionAnalysisMeta(attributes: ProductAttributes, meta: {
    suggestedKeys: string[];
    confirmedKeys?: string[];
    conflicts: FashionSuggestionConflict[];
    warnings: string[];
    multipleItems: boolean;
    analysisStatus: 'suggested' | 'failed' | 'skipped';
}): ProductAttributes;
