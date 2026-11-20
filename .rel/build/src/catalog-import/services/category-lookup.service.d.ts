import { Repository } from 'typeorm';
import { EbayTaxonomyApiService } from '../../channels/ebay/ebay-taxonomy-api.service.js';
import { CatalogProduct } from '../entities/catalog-product.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
export interface CategoryLookupResult {
    categoryId: string | null;
    categoryName: string | null;
    confidence: 'high' | 'medium' | 'low' | 'none';
}
export declare class CategoryLookupService {
    private readonly taxonomy;
    private readonly productRepo;
    private readonly listingRepo;
    private readonly logger;
    private readonly treeIdCache;
    private static readonly KNOWN_TREE_IDS;
    constructor(taxonomy: EbayTaxonomyApiService, productRepo: Repository<CatalogProduct>, listingRepo: Repository<ListingRecord>);
    lookupCategory(title?: string | null, brand?: string | null, partType?: string | null, mpn?: string | null, marketplace?: string | null): Promise<CategoryLookupResult>;
    lookupAndUpdateProduct(product: CatalogProduct): Promise<boolean>;
    backfillMissingCategories(batchSize?: number, concurrency?: number): Promise<{
        scanned: number;
        updated: number;
        failed: number;
    }>;
    backfillListingRecords(batchSize?: number, concurrency?: number): Promise<{
        scanned: number;
        updated: number;
        failed: number;
    }>;
    private lookupAndUpdateListingRecord;
    private lookupByCategoryName;
    private buildQuery;
    private resolveTreeId;
}
