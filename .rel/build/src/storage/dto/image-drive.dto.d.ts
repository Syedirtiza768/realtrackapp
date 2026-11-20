export declare class CreateFolderDto {
    name: string;
    linkedPartNumber?: string;
}
export declare class UpdateFolderDto {
    name?: string;
    linkedPartNumber?: string | null;
}
export declare class UploadToFolderDto {
    partNumber?: string;
}
export declare class ImageDriveBatchLookupDto {
    partNumbers: string[];
}
export declare class ListFilesDto {
    page?: number;
    limit?: number;
}
export declare class SearchDriveDto {
    q: string;
    page?: number;
    limit?: number;
}
export declare class AutoCreateUploadDto {
    folderName: string;
    partNumber?: string;
}
export declare class BulkDeleteFilesDto {
    fileIds: string[];
}
