import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { ImageAsset } from '../entities/image-asset.entity.js';
import { ImageDriveAsset } from '../entities/image-drive-asset.entity.js';
import { ImageProcessorService } from '../image-processor.service.js';
import { StorageService } from '../storage.service.js';
export interface ThumbnailJobData {
    assetId: string;
    s3Key: string;
}
export interface CatalogVariantJobData {
    s3Key: string;
}
export interface DriveVariantJobData {
    assetId: string;
    s3Key: string;
}
export declare class ThumbnailProcessor extends WorkerHost {
    private readonly imageProcessor;
    private readonly storageService;
    private readonly assetRepo;
    private readonly driveAssetRepo;
    private readonly logger;
    constructor(imageProcessor: ImageProcessorService, storageService: StorageService, assetRepo: Repository<ImageAsset>, driveAssetRepo: Repository<ImageDriveAsset>);
    process(job: Job<ThumbnailJobData | CatalogVariantJobData | DriveVariantJobData>): Promise<void>;
}
