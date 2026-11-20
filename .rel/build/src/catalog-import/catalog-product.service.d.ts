import { Repository } from 'typeorm';
import { CatalogProduct } from './entities/catalog-product.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { type CatalogProductDerived } from './utils/catalog-product-derivatives.js';
import { type CatalogProductListParams } from './utils/catalog-product-list-query.js';
import { StorageService } from '../storage/storage.service.js';
import { User } from '../auth/entities/user.entity.js';
import { AutomotiveAccessScopeService } from '../auth/automotive-access-scope.service.js';
export interface UpdateProductDto {
    title?: string;
    description?: string;
    brand?: string;
    mpn?: string;
    oemPartNumber?: string;
    partType?: string;
    placement?: string;
    material?: string;
    features?: string;
    countryOfOrigin?: string;
    price?: number;
    quantity?: number;
    conditionId?: string;
    conditionLabel?: string;
    categoryId?: string;
    categoryName?: string;
    imageUrls?: string[];
    location?: string;
    format?: string;
    duration?: string;
    shippingProfile?: string;
    returnProfile?: string;
    paymentProfile?: string;
    fitmentData?: Record<string, unknown>[];
}
export declare class CatalogProductService {
    private readonly productRepo;
    private readonly listingRepo;
    private readonly storageService;
    private readonly automotiveScope;
    private readonly logger;
    constructor(productRepo: Repository<CatalogProduct>, listingRepo: Repository<ListingRecord>, storageService: StorageService, automotiveScope: AutomotiveAccessScopeService);
    findAll(params: CatalogProductListParams, user?: User): Promise<{
        products: Array<CatalogProduct & {
            derived?: CatalogProductDerived;
        }>;
        total: number;
    }>;
    findOne(id: string, user?: User): Promise<CatalogProduct>;
    findBySku(sku: string, user?: User): Promise<CatalogProduct | null>;
    findByIds(ids: string[], user?: User): Promise<CatalogProduct[]>;
    findByListingIds(listingIds: string[], user?: User): Promise<CatalogProduct[]>;
    applyProfileOverrides(products: CatalogProduct[], overrides: {
        shippingProfile?: string;
        returnProfile?: string;
        paymentProfile?: string;
    }): CatalogProduct[];
    persistProfileOverridesForListings(listingIds: string[], overrides: {
        shippingProfile?: string;
        returnProfile?: string;
        paymentProfile?: string;
    }, user?: User): Promise<void>;
    update(id: string, dto: UpdateProductDto, user?: User): Promise<CatalogProduct>;
    updateBySku(sku: string, dto: UpdateProductDto, user?: User): Promise<CatalogProduct>;
    private syncToListingRecord;
    private findBySkuList;
    bulkFixConditionMismatchTitles(pipelineJobId: string): Promise<{
        catalogUpdated: number;
        listingsUpdated: number;
    }>;
    bulkSanitizeTitles(pipelineJobId: string): Promise<{
        catalogUpdated: number;
        listingsUpdated: number;
    }>;
}
