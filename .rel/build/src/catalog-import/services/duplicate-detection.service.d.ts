import type { ProductVertical } from '../../verticals/vertical.types.js';
import { Repository } from 'typeorm';
import { CatalogProduct } from '../entities/catalog-product.entity.js';
export declare const UPC_OUTSIDE_SCOPE_STRATEGY = "upc_outside_scope";
export interface DuplicateCheckResult {
    isDuplicate: boolean;
    isPartialMatch: boolean;
    matchStrategy: string | null;
    matchedProductId: string | null;
    confidence: number;
}
export declare class DuplicateDetectionService {
    private readonly productRepo;
    private readonly logger;
    constructor(productRepo: Repository<CatalogProduct>);
    checkDuplicate(product: {
        sku?: string | null;
        mpn?: string | null;
        upc?: string | null;
        ean?: string | null;
        ebayItemId?: string | null;
        title?: string | null;
        brand?: string | null;
    }): Promise<DuplicateCheckResult>;
    checkDuplicateBatch(products: Array<{
        index: number;
        sku?: string | null;
        mpn?: string | null;
        upc?: string | null;
        title?: string | null;
        brand?: string | null;
    }>, scope?: {
        organizationId?: string | null;
        vertical?: ProductVertical;
    }): Promise<Map<number, DuplicateCheckResult>>;
    private isInScope;
    normalizeMpn(mpn: string): string;
    normalizeBrand(brand: string): string;
    normalizeTitle(title: string): string;
}
