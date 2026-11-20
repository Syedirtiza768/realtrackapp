import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { ImageAsset } from '../entities/image-asset.entity.js';
import { StorageService } from '../storage.service.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
export declare class CleanupProcessor extends WorkerHost {
    private readonly assetRepo;
    private readonly listingRepo;
    private readonly catalogRepo;
    private readonly storageService;
    private readonly logger;
    constructor(assetRepo: Repository<ImageAsset>, listingRepo: Repository<ListingRecord>, catalogRepo: Repository<CatalogProduct>, storageService: StorageService);
    process(_job: Job): Promise<{
        cleaned: number;
        healed: number;
    }>;
    private healIfReferenced;
}
