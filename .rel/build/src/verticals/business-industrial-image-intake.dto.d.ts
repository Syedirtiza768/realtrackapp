export declare class CreateBusinessIndustrialImageIntakeJobDto {
    sourceRootName: string;
    sourceReferenceUrl?: string;
}
export declare class CreateBusinessIndustrialDriveIntakeJobDto {
    folderUrl: string;
    maxItems?: number;
    skipFolderNames?: string[];
    autoCreateDrafts?: boolean;
}
export declare class ApplyBusinessIndustrialImageIntakeGroupDto {
    sku?: string;
    title?: string;
    description?: string;
    brand?: string;
    model?: string;
    conditionId?: string;
    mpn?: string;
    conditionLabel?: string;
    price?: number;
    quantity?: number;
    categoryFamily?: string;
    categoryId?: string;
    categoryName?: string;
    verticalAttributes?: Record<string, unknown>;
}
