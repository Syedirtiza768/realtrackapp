export declare class ImportEbayMvlDirectoryDto {
    directory?: string;
    force?: boolean;
}
export declare class ImportEbayMvlFileDto {
    filePath: string;
    marketplace?: string;
    force?: boolean;
}
export declare class ValidateEbayMvlBatchDto {
    marketplace: string;
    rows?: Array<Record<string, unknown>>;
}
