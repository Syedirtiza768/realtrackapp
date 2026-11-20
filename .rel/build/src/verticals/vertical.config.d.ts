import type { ProductVertical, VerticalAttributes, VerticalConfig, VerticalProfile } from './vertical.types.js';
export declare const DEFAULT_VERTICAL_CONFIG: VerticalConfig;
export declare const VERTICAL_PROFILES: Record<ProductVertical, VerticalProfile>;
export declare function normalizeVerticalConfig(value: unknown): VerticalConfig;
export declare function isDedicatedFashionStore(value: unknown): boolean;
export declare function validateVerticalAttributes(vertical: ProductVertical, value: unknown): {
    attributes: VerticalAttributes;
    errors: string[];
};
export declare function attributesFromImportRow(vertical: ProductVertical, data: Record<string, string>): VerticalAttributes;
