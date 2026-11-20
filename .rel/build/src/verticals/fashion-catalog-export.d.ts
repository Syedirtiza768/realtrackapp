import type { ProductAttributes } from './vertical.types.js';
export type FashionExportSource = Record<string, string | undefined>;
export declare function fashionCatalogExportAttributes(data: FashionExportSource, base?: ProductAttributes): ProductAttributes;
export declare function customAspectPairs(attributes: ProductAttributes): Array<[string, string]>;
