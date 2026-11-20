export declare class RequestUploadDto {
    filename: string;
    mimeType: string;
    listingId?: string;
    fileSize?: number;
}
export declare class BulkRequestUploadDto {
    listingId?: string;
    files: RequestUploadDto[];
}
