import type { ProductVertical } from '../../../verticals/vertical.types.js';
import { Repository } from 'typeorm';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../../../listings/listing-record.entity.js';
import { ImageAsset } from '../../../storage/entities/image-asset.entity.js';
import { StorageService } from '../../../storage/storage.service.js';
export interface CatalogPublishSnapshot {
    catalogProductId: string;
    listingRecordId: string | null;
    sku: string;
    title: string;
    description: string | null;
    brand: string | null;
    mpn: string | null;
    partType: string | null;
    price: number | null;
    quantity: number | null;
    categoryId: string | null;
    conditionId: string | null;
    conditionLabel: string | null;
    imageUrls: string[];
    vertical?: ProductVertical | null;
}
export interface ResolvedCatalogPublishSource {
    snapshot: CatalogPublishSnapshot;
    catalogProduct: CatalogProduct | null;
    listingRecord: ListingRecord | null;
    warnings: string[];
}
export declare class CatalogPublishResolverService {
    private readonly catalogRepo;
    private readonly listingRepo;
    private readonly assetRepo;
    private readonly storageService;
    constructor(catalogRepo: Repository<CatalogProduct>, listingRepo: Repository<ListingRecord>, assetRepo: Repository<ImageAsset>, storageService: StorageService);
    resolve(productRefId: string): Promise<ResolvedCatalogPublishSource | null>;
    private resolveImageUrls;
    private ensureCatalogProductFromListing;
    private backfillCatalogProductFromListing;
}
