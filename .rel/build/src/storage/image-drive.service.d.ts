import { Repository } from 'typeorm';
import { ImageDriveAsset } from './entities/image-drive-asset.entity.js';
import { ImageDriveFolder } from './entities/image-drive-folder.entity.js';
import { StorageService } from './storage.service.js';
export interface DriveFileEntry {
    id: string;
    folderId: string;
    filename: string;
    cdnUrl: string;
    s3Key: string;
    s3KeyThumb: string | null;
    s3KeyMedium: string | null;
    mimeType: string | null;
    fileSizeBytes: number;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    createdAt: Date;
}
export interface DriveFolderEntry {
    id: string;
    name: string;
    s3Prefix: string;
    linkedPartNumber: string | null;
    fileCount: number;
    totalSizeBytes: number;
    createdAt: Date;
    updatedAt: Date;
    thumbnailUrls: string[];
}
export interface BatchLookupResult {
    [partNumber: string]: DriveFileEntry[];
}
export interface AddFileResult {
    entry: DriveFileEntry;
    created: boolean;
}
export declare class ImageDriveService {
    private readonly folderRepo;
    private readonly assetRepo;
    private readonly storageService;
    private readonly logger;
    constructor(folderRepo: Repository<ImageDriveFolder>, assetRepo: Repository<ImageDriveAsset>, storageService: StorageService);
    static normalizePartNumber(raw: string): string;
    static normalizeFolderName(raw: string): string;
    listFolders(): Promise<DriveFolderEntry[]>;
    createFolder(name: string, linkedPartNumber?: string): Promise<DriveFolderEntry>;
    updateFolder(folderId: string, updates: {
        name?: string;
        linkedPartNumber?: string | null;
    }): Promise<DriveFolderEntry>;
    deleteFolder(folderId: string): Promise<void>;
    getFolder(folderId: string): Promise<DriveFolderEntry | null>;
    findOrCreateFolder(name: string, linkedPartNumber?: string): Promise<DriveFolderEntry>;
    listFiles(folderId: string, page?: number, limit?: number): Promise<{
        items: DriveFileEntry[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    addFile(folderId: string, data: {
        filename: string;
        s3Key: string;
        cdnUrl: string;
        mimeType: string;
        fileSizeBytes: number;
    }): Promise<DriveFileEntry>;
    addFileIfMissing(folderId: string, data: {
        filename: string;
        s3Key: string;
        cdnUrl: string;
        mimeType: string;
        fileSizeBytes: number;
    }): Promise<AddFileResult>;
    updateFileVariants(assetId: string, variants: {
        s3KeyThumb?: string | null;
        s3KeyMedium?: string | null;
        width?: number | null;
        height?: number | null;
        blurhash?: string | null;
    }): Promise<void>;
    deleteFile(assetId: string): Promise<boolean>;
    getFile(assetId: string): Promise<DriveFileEntry | null>;
    deleteFiles(assetIds: string[]): Promise<{
        deleted: number;
        failed: string[];
    }>;
    findByPartNumber(partNumber: string): Promise<DriveFileEntry[]>;
    findByPartNumbers(partNumbers: string[]): Promise<BatchLookupResult>;
    search(query: string, page?: number, limit?: number): Promise<{
        items: Array<DriveFileEntry & {
            folderName: string;
        }>;
        total: number;
        page: number;
        totalPages: number;
    }>;
    getStats(): Promise<{
        totalFolders: number;
        totalFiles: number;
        totalSizeBytes: number;
    }>;
    private toFileEntry;
}
