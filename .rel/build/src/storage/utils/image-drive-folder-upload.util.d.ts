export interface FolderUploadPath {
    relativePath: string;
    topLevelFolderName: string;
    partNumber: string | null;
    assetPath: string;
}
export declare function normalizeFolderUploadPath(raw: string): string | null;
export declare function isLikelyPartNumberFolderName(raw: string): boolean;
export declare function resolveFolderUploadPath(rawPath: string, fallbackTopLevelFolderName?: string): FolderUploadPath | null;
export declare function isSupportedImageUpload(filename: string, mimeType?: string | null): boolean;
