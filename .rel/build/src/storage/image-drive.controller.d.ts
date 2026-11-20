import { ImageDriveService, type DriveFolderEntry } from './image-drive.service.js';
import { StorageService } from './storage.service.js';
import { BulkDeleteFilesDto, CreateFolderDto, ImageDriveBatchLookupDto, ListFilesDto, SearchDriveDto, UpdateFolderDto } from './dto/image-drive.dto.js';
export declare class ImageDriveController {
    private readonly imageDriveService;
    private readonly storageService;
    constructor(imageDriveService: ImageDriveService, storageService: StorageService);
    listFolders(): Promise<DriveFolderEntry[]>;
    createFolder(dto: CreateFolderDto): Promise<DriveFolderEntry>;
    updateFolder(folderId: string, dto: UpdateFolderDto): Promise<DriveFolderEntry>;
    deleteFolder(folderId: string): Promise<{
        deleted: boolean;
    }>;
    listFiles(folderId: string, query: ListFilesDto): Promise<{
        items: import("./image-drive.service.js").DriveFileEntry[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    uploadToFolder(folderId: string, files: Express.Multer.File[]): Promise<{
        uploaded: number;
        files: {
            filename: string;
            cdnUrl: string;
            s3Key: string;
            fileSizeBytes: number;
        }[];
    }>;
    uploadAutoCreate(files: Express.Multer.File[], folderId: string, folderName: string, partNumber: string): Promise<{
        folderId: string;
        folderName: string;
        uploaded: number;
        files: {
            filename: string;
            cdnUrl: string;
            s3Key: string;
        }[];
    }>;
    uploadFolderTree(files: Express.Multer.File[], rawFilePaths: string, topLevelFolderName: string): Promise<{
        uploaded: number;
        skipped: number;
        unassigned: number;
        folders: {
            folderName: string;
            partNumber: string | null;
            uploaded: number;
        }[];
    }>;
    deleteFile(fileId: string): Promise<{
        deleted: boolean;
    }>;
    getFile(fileId: string): Promise<import("./image-drive.service.js").DriveFileEntry>;
    bulkDeleteFiles(dto: BulkDeleteFilesDto): Promise<{
        deleted: number;
        failed: string[];
    }>;
    findByPartNumber(partNumber: string): Promise<{
        partNumber: string;
        images: import("./image-drive.service.js").DriveFileEntry[];
        count: number;
    }>;
    batchLookup(dto: ImageDriveBatchLookupDto): Promise<{
        results: import("./image-drive.service.js").BatchLookupResult;
        summary: {
            partNumber: string;
            count: number;
        }[];
    }>;
    search(query: SearchDriveDto): Promise<{
        items: Array<import("./image-drive.service.js").DriveFileEntry & {
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
}
