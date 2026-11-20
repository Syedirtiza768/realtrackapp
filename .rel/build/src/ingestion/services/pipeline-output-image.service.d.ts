import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../storage/storage.service.js';
export declare class PipelineOutputImageService {
    private readonly storageService;
    private readonly config;
    private readonly logger;
    constructor(storageService: StorageService, config: ConfigService);
    shouldMirror(): boolean;
    mirrorImagesInOutputDir(jobId: string, outputDir: string): Promise<void>;
    mirrorApprovedImageUrls(jobId: string, sku: string, urls: string[]): Promise<{
        urls: string[];
        s3Keys: string[];
    }>;
    private preferFullResolutionFebestUrl;
    applyResolvedImagesToOutputDir(jobId: string, outputDir: string, imagesBySku: ReadonlyMap<string, readonly string[]>): Promise<{
        filesUpdated: number;
        rowsUpdated: number;
    }>;
    private mirrorImagesInWorkbook;
    private writeRowsToFile;
    private findHeaderRow;
    private colIdx;
    private isImageColumn;
    private writeImageColumns;
}
