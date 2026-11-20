import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { CatalogVariantJobData, DriveVariantJobData } from './processors/thumbnail.processor.js';
export interface PresignedUploadResult {
    uploadUrl: string;
    s3Key: string;
    assetId: string;
}
export interface MirroredRemoteImage {
    url: string;
    s3Key: string | null;
}
export declare class StorageService {
    private readonly config;
    private readonly thumbnailQueue;
    private readonly logger;
    private readonly s3;
    private readonly bucket;
    private readonly keyPrefix;
    private readonly cdnDomain;
    private readonly signedUrlExpiry;
    constructor(config: ConfigService, thumbnailQueue: Queue<CatalogVariantJobData | DriveVariantJobData>);
    getBucket(): string;
    isTempKey(s3Key: string): boolean;
    generateUploadUrl(filename: string, mimeType: string, listingId?: string): Promise<PresignedUploadResult>;
    generateDownloadUrl(s3Key: string): Promise<string>;
    generateBulkUploadUrls(files: Array<{
        filename: string;
        mimeType: string;
    }>, listingId?: string): Promise<PresignedUploadResult[]>;
    getObjectBuffer(key: string): Promise<Buffer>;
    getObjectStream(key: string): Promise<{
        stream: NodeJS.ReadableStream;
        contentType: string;
        contentLength: number | undefined;
        etag: string | undefined;
    }>;
    putObject(key: string, body: Buffer, contentType: string): Promise<void>;
    objectExists(key: string): Promise<boolean>;
    copyObject(sourceKey: string, destKey: string): Promise<void>;
    moveObject(sourceKey: string, destKey: string): Promise<void>;
    deleteObject(key: string): Promise<void>;
    getCdnUrl(s3Key: string): string;
    getPreferredImageUrl(url: string): Promise<string>;
    mirrorRemoteImageUrls(urls: string[], namespace: string, parallel?: number): Promise<string[]>;
    mirrorRemoteImages(urls: string[], namespace: string, parallel?: number): Promise<MirroredRemoteImage[]>;
    queueVariantGeneration(s3Key: string): Promise<void>;
    queueDriveVariantGeneration(assetId: string, s3Key: string): Promise<void>;
    keyFromUrl(url: string): string | null;
    private tryKeyFromOurUrl;
    private urlLooksLikeOurBucket;
    private extFromUrlOrMime;
    confirmUpload(tempKey: string, listingId: string, assetId: string): Promise<string>;
    private normalizeKeyPrefix;
    buildDurableKey(relativeKey: string): string;
    private withKeyPrefix;
    buildDrivePrefix(folderName: string): string;
    mirroredObjectKey(namespace: string, sourceIdentity: string, ext: string): string;
    private relativeKey;
    sanitizeExtension(filename: string): string;
    private mimeFromExt;
}
