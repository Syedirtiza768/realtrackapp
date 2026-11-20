export declare class UploadCsvDto {
    columnMapping?: Record<string, string>;
}
export declare class StartImportDto {
    importId: string;
    columnMapping?: Record<string, string>;
}
export declare class ImportQueryDto {
    status?: string;
    limit?: number;
    offset?: number;
}
export declare class ImportRowQueryDto {
    status?: string;
    limit?: number;
    offset?: number;
}
export declare class BackfillListingsDto {
    importId?: string;
}
export declare class ClearCatalogDto {
    confirm: 'DELETE_ALL_CATALOG';
}
