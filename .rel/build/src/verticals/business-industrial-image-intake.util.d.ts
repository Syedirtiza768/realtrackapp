export interface ParsedInstanceFolderName {
    rawFolderName: string;
    baseFolderName: string;
    instanceSuffix: string | null;
}
export declare function parseInstanceFolderName(rawFolderName: string): ParsedInstanceFolderName;
export declare function normalizeImageIntakePartName(name: string): string;
export declare function partFolderFromRelativePath(relativePath: string, rootFolderName?: string): string;
export declare function isSupportedBusinessIndustrialImage(filename: string, mimeType?: string): boolean;
export declare function safeIntakePath(value: string): string;
export declare function normalizeDetectedBusinessIndustrialAttributes(value: unknown): Record<string, unknown>;
export interface BusinessIndustrialFulfillmentDefaults {
    dispatchLocation?: string;
    shippingCoverage?: string;
    packedLength?: number;
    packedWidth?: number;
    packedHeight?: number;
    packedDimensionsUnit?: 'mm' | 'cm' | 'm' | 'in' | 'ft';
    packedWeight?: number;
    packedWeightUnit?: 'kg' | 'lb' | 'oz' | 't';
}
export declare function applyBusinessIndustrialFulfillmentDefaults(value: Record<string, unknown>, defaults?: BusinessIndustrialFulfillmentDefaults): Record<string, unknown>;
export declare function mapWithConcurrency<T, R>(items: readonly T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]>;
