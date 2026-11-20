import * as express from 'express';
import { CatalogProductService } from './catalog-product.service.js';
import { TemplateGeneratorService } from './template-generator.service.js';
import { CategoryLookupService } from './services/category-lookup.service.js';
import { ListingsService } from '../listings/listings.service.js';
import { User } from '../auth/entities/user.entity.js';
export declare class CatalogProductController {
    private readonly productService;
    private readonly templateService;
    private readonly categoryLookup;
    private readonly listingsService;
    constructor(productService: CatalogProductService, templateService: TemplateGeneratorService, categoryLookup: CategoryLookupService, listingsService: ListingsService);
    list(query: Record<string, string | undefined>, user: User): Promise<{
        products: Array<import("./entities/catalog-product.entity.js").CatalogProduct & {
            derived?: import("./utils/catalog-product-derivatives.js").CatalogProductDerived;
        }>;
        total: number;
    }>;
    updateBySku(sku: string, dto: Record<string, unknown>, user: User): Promise<import("./entities/catalog-product.entity.js").CatalogProduct>;
    getOne(id: string, user: User): Promise<import("./entities/catalog-product.entity.js").CatalogProduct>;
    update(id: string, dto: Record<string, unknown>, user: User): Promise<import("./entities/catalog-product.entity.js").CatalogProduct>;
    fixConditionTitles(body: {
        pipelineJobId: string;
    }): Promise<{
        catalogUpdated: number;
        listingsUpdated: number;
    }>;
    sanitizeTitles(body: {
        pipelineJobId: string;
    }): Promise<{
        catalogUpdated: number;
        listingsUpdated: number;
    }>;
    backfillCategories(body: {
        batchSize?: number;
        concurrency?: number;
        includeListings?: boolean;
    }): Promise<{
        catalog: {
            scanned: number;
            updated: number;
            failed: number;
        };
        listings: {
            scanned: number;
            updated: number;
            failed: number;
        };
        total: {
            scanned: number;
            updated: number;
            failed: number;
        };
    }>;
    exportTemplates(body: {
        ids?: string[];
        listingIds?: string[];
        formats?: ('us' | 'au' | 'de')[];
        shippingProfile?: string;
        returnProfile?: string;
        paymentProfile?: string;
        persistProfiles?: boolean;
        teamIds?: string[];
    }, user: User, res: express.Response): Promise<void>;
}
