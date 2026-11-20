import { DataSource, Repository } from 'typeorm';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { EbayCompatibilityReconciliationService } from '../channels/ebay/ebay-compatibility-reconciliation.service.js';
import { EbayPublishService } from '../channels/ebay/ebay-publish.service.js';
export interface EbayFitmentPublishResult {
    productId: string;
    status: 'published' | 'skipped' | 'failed';
    rows: number;
    channels: number;
    message?: string;
}
export declare class EbayFitmentPublishService {
    private readonly dataSource;
    private readonly catalogRepo;
    private readonly publishService;
    private readonly reconciler;
    private readonly logger;
    constructor(dataSource: DataSource, catalogRepo: Repository<CatalogProduct>, publishService: EbayPublishService, reconciler: EbayCompatibilityReconciliationService);
    publishValidatedFitment(productId: string, marketplace?: 'US' | 'DE' | 'AU'): Promise<EbayFitmentPublishResult>;
    private syncTarget;
    private marketplaceIdFor;
}
