import type { EbayAspect } from '../channels/ebay/ebay-api.types.js';
export declare const PRODUCT_VERTICALS: readonly ["automotive", "business_industrial", "fashion"];
export type ProductVertical = (typeof PRODUCT_VERTICALS)[number];
export declare const DEFAULT_PRODUCT_VERTICAL: ProductVertical;
export declare function isProductVertical(value: unknown): value is ProductVertical;
export declare function normalizeProductVertical(value: unknown, fallback?: ProductVertical): ProductVertical;
export type VerticalConfig = {
    enabledVerticals: ProductVertical[];
    defaultVertical: ProductVertical;
    workflows: Record<string, Record<string, unknown>>;
};
export type VerticalAttributeValue = string | number | boolean | string[];
export type VerticalAttributes = Record<string, VerticalAttributeValue>;
export type ProductAttributes = VerticalAttributes;
export type VerticalProfile = {
    id: ProductVertical;
    label: string;
    attributeFields: Array<{
        key: string;
        label: string;
        input: 'text' | 'number' | 'textarea' | 'json';
        description?: string;
    }>;
    supportsFitment: boolean;
    supportsVariations: boolean;
};
export type VerticalPublishProjection = {
    vertical: ProductVertical;
    title: string;
    description: string;
    categoryId: string;
    aspects: Record<string, string[]>;
    condition: string;
    conditionDescription?: string;
    warnings: string[];
    blockingErrors: string[];
    taxonomyAspects: EbayAspect[];
};
export type VerticalCategoryMetadata = {
    marketplaceId: string;
    categoryTreeId: string;
    categoryId: string;
    categoryName?: string | null;
    aspects: EbayAspect[];
    supportedConditions: string[];
    supportsVariations: boolean | null;
    fetchedAt: string;
};
