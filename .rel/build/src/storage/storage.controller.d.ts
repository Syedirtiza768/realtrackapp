import type { Request, Response } from 'express';
import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { ImageAsset } from './entities/image-asset.entity.js';
import { StorageService } from './storage.service.js';
import { ImageProcessorService } from './image-processor.service.js';
import { BulkRequestUploadDto, RequestUploadDto } from './dto/request-upload.dto.js';
import { UpdateAssetDto } from './dto/image-transform.dto.js';
import type { CatalogVariantJobData, ThumbnailJobData } from './processors/thumbnail.processor.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
export declare class StorageController {
    private readonly storageService;
    private readonly imageProcessor;
    private readonly assetRepo;
    private readonly listingRepo;
    private readonly catalogProductRepo;
    private readonly thumbnailQueue;
    private readonly logger;
    private static readonly VARIANT_RE;
    private static readonly ORIGINAL_EXTS;
    private static readonly WEBP_FALLBACK_EXTS;
    private static readonly MAX_VARIANT_GEN;
    private readonly variantGenInflight;
    private activeVariantGen;
    constructor(storageService: StorageService, imageProcessor: ImageProcessorService, assetRepo: Repository<ImageAsset>, listingRepo: Repository<ListingRecord>, catalogProductRepo: Repository<CatalogProduct>, thumbnailQueue: Queue<ThumbnailJobData | CatalogVariantJobData>);
    getUploadUrl(dto: RequestUploadDto): Promise<{
        uploadUrl: string;
        s3Key: string;
        assetId: string;
    }>;
    confirmUpload(body: {
        assetId: string;
        listingId?: string;
    }): Promise<{
        asset: ImageAsset;
    }>;
    getListingImages(listingId: string): Promise<{
        images: ImageAsset[];
    }>;
    updateAsset(assetId: string, dto: UpdateAssetDto): Promise<{
        asset: ImageAsset;
    }>;
    deleteAsset(assetId: string): Promise<{
        deleted: boolean;
    }>;
    getBulkUploadUrls(body: BulkRequestUploadDto): Promise<{
        uploads: import("./storage.service.js").PresignedUploadResult[];
    }>;
    backfillVariants(batchSizeParam?: string): Promise<{
        queued: number;
        remaining: number;
        message: string;
    }>;
    backfillCatalogVariants(batchSizeParam?: string): Promise<{
        productsQueued: number;
        imagesQueued: number;
        remaining: number;
        message: string;
    }>;
    serve(req: Request, res: Response): Promise<void>;
    serveNapaImage(imageId: string, requestedPreset: string | undefined, res: Response): Promise<Response<any, Record<string, any>>>;
    private preferredWebpKey;
    private webpFallbackKeys;
    private redirectToKey;
    private streamObject;
    private ensureVariant;
    private doEnsureVariant;
}
