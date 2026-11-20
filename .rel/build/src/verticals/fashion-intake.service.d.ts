import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { FashionWarehouse } from './entities/fashion-warehouse.entity.js';
import { FashionListingsService } from './fashion-listings.service.js';
import { FashionImageAnalysisService } from './fashion-image-analysis.service.js';
import type { CreateFashionIntakeDto, FashionWarehouseDto, NextFashionSkuDto, UpdateFashionWarehouseDto } from './fashion.dto.js';
export declare const FASHION_INTAKE_QUEUE = "fashion-intake-analysis";
export type FashionIntakeJob = {
    productId: string;
    organizationId: string;
};
export type FashionAnalysisStatus = 'queued' | 'processing' | 'suggested' | 'failed' | 'skipped';
declare const PHOTO_ROLE_ORDER: readonly ["front", "back", "tag", "additional", "sizeChart"];
export type FashionPhotoRole = (typeof PHOTO_ROLE_ORDER)[number];
export declare function pendingFashionTitle(sku: string): string;
export declare class FashionIntakeService {
    private readonly db;
    private readonly organizations;
    private readonly listings;
    private readonly images;
    private readonly queue;
    private readonly events?;
    private readonly logger;
    constructor(db: DataSource, organizations: UserOrganizationService, listings: FashionListingsService, images: FashionImageAnalysisService, queue: Queue, events?: EventEmitter2 | undefined);
    private emitWarehouse;
    listWarehouses(user: User, organizationId?: string, includeInactive?: boolean): Promise<FashionWarehouse[]>;
    createWarehouse(user: User, dto: FashionWarehouseDto, organizationId?: string): Promise<FashionWarehouse>;
    updateWarehouse(user: User, id: string, dto: UpdateFashionWarehouseDto, organizationId?: string): Promise<FashionWarehouse>;
    batches(user: User, organizationId?: string): Promise<{
        batch: string;
        lastNumber: number;
        itemCount: number;
        lastUsedAt: Date | null;
    }[]>;
    nextSku(user: User, dto: NextFashionSkuDto, organizationId?: string): Promise<{
        batch: string;
        number: number;
        sku: string;
    }>;
    private reserveNumber;
    create(user: User, dto: CreateFashionIntakeDto, organizationId?: string): Promise<{
        id: string;
        sku: string | null;
        title: string;
        description: string | null;
        brand: string | null;
        conditionId: string | null;
        price: number | null;
        quantity: number | null;
        imageUrls: string[];
        categoryId: string | null;
        categoryName: string | null;
        vertical: "fashion" | "business_industrial" | "automotive" | null;
        verticalAttributes: import("./vertical.types.js").VerticalAttributes;
        verticalValidationStatus: string;
        manualReview: boolean;
        updatedAt: Date;
    }>;
    addToCatalog(user: User, id: string, organizationId?: string): Promise<{
        id: string;
        addedToCatalog: boolean;
        alreadyAdded: boolean;
        addedAt?: undefined;
        addedByUserId?: undefined;
    } | {
        id: string;
        addedToCatalog: boolean;
        addedAt: string;
        addedByUserId: string;
        alreadyAdded?: undefined;
    }>;
    requestIdentification(user: User, id: string, organizationId?: string): Promise<{
        id: string;
        analysisStatus: "queued";
    }>;
    private enqueue;
    private assertIdentifiable;
    processIdentification(job: FashionIntakeJob): Promise<{
        skipped: string;
        status?: undefined;
    } | {
        status: string;
        skipped?: undefined;
    }>;
    private setStatus;
    private audit;
    history(user: User, params: {
        organizationId?: string;
        batch?: string;
        status?: string;
        q?: string;
        source?: string;
        page?: string;
        pageSize?: string;
    }): Promise<{
        page: number;
        pageSize: number;
        total: number;
        items: {
            id: string;
            sku: string | null;
            title: string;
            batch: string | null;
            warehouseCode: string | null;
            warehouseName: string | null;
            imageCount: number;
            primaryImageUrl: string;
            analysisStatus: string | null;
            validationStatus: string;
            manualReview: boolean;
            reviewStatus: import("./entities/fashion-review.entity.js").FashionReviewStatus;
            addedToCatalog: boolean;
            catalogAddedAt: string | null;
            hasSizeChart: boolean;
            createdAt: Date;
            updatedAt: Date;
        }[];
    }>;
    activityReport(user: User, params: {
        organizationId?: string;
        from?: string;
        to?: string;
        uploadedBy?: string;
        addedBy?: string;
        analysisStatus?: string;
        catalogStatus?: string;
        reviewStatus?: string;
        publicationStatus?: string;
        storeId?: string;
        batch?: string;
        q?: string;
        attributeKey?: string;
        attributeValue?: string;
        page?: string;
        pageSize?: string;
    }): Promise<{
        page: number;
        pageSize: number;
        total: number;
        summary: {
            [k: string]: number;
        };
        uploadedBy: {
            user: {
                id: string;
                name: string;
                email: string;
            };
            itemCount: number;
        }[];
        addedBy: {
            user: {
                id: string;
                name: string;
                email: string;
            };
            itemCount: number;
        }[];
        users: {
            id: string;
            name: string;
            email: string;
        }[];
        items: {
            id: string;
            sku: string | null;
            title: string;
            description: string | null;
            brand: string | null;
            conditionId: string | null;
            conditionLabel: string | null;
            price: number | null;
            quantity: number | null;
            imageUrls: string[];
            categoryId: string | null;
            categoryName: string | null;
            attributes: {
                [k: string]: import("./vertical.types.js").VerticalAttributeValue;
            };
            uploadedByUserId: string | null;
            uploadedBy: {
                id: string;
                name: string;
                email: string;
            } | null;
            createdAt: Date;
            analysisStatus: string;
            addedToCatalog: boolean;
            addedByUserId: string | null;
            addedBy: {
                id: string;
                name: string;
                email: string;
            } | null;
            catalogAddedAt: string | null;
            validationStatus: string;
            reviewStatus: import("./entities/fashion-review.entity.js").FashionReviewStatus;
            batch: string | null;
            publicationTargets: {
                storeId: string | null;
                storeName: string;
                marketplaceId: string;
                status: import("../integrations/ebay/entities/ebay-listing-job-target.entity.js").EbayListingJobTargetStatus;
                policies: {};
                requestedByUserId: string | null;
                requestedBy: {
                    id: string;
                    name: string;
                    email: string;
                } | null;
                createdAt: Date;
            }[];
        }[];
    }>;
    exportActivity(user: User, params: Parameters<FashionIntakeService['activityReport']>[1]): Promise<string>;
    private activityQuery;
    private activitySummary;
    private activityItems;
}
export {};
