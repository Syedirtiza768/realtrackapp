import { User } from '../auth/entities/user.entity.js';
import { CreateFashionIntakeDto, FashionImageBannerDto, FashionSizeChartDto, FashionWarehouseDto, NextFashionSkuDto, UpdateFashionWarehouseDto } from './fashion.dto.js';
import { FashionIntakeService } from './fashion-intake.service.js';
import { FashionIntakeImagesService } from './fashion-intake-images.service.js';
export declare class FashionIntakeController {
    private readonly intake;
    private readonly generated;
    constructor(intake: FashionIntakeService, generated: FashionIntakeImagesService);
    measurementTemplates(): {
        id: string;
        label: string;
        chartTitle: string;
        family: "accessories" | "clothing" | "footwear";
        keywords: string[];
        points: {
            letter: string;
            key: string;
            label: string;
        }[];
        diagramSvg: string;
    }[];
    warehouses(user: User, organizationId?: string, includeInactive?: string): Promise<import("./entities/fashion-warehouse.entity.js").FashionWarehouse[]>;
    createWarehouse(user: User, dto: FashionWarehouseDto, organizationId?: string): Promise<import("./entities/fashion-warehouse.entity.js").FashionWarehouse>;
    updateWarehouse(user: User, id: string, dto: UpdateFashionWarehouseDto, organizationId?: string): Promise<import("./entities/fashion-warehouse.entity.js").FashionWarehouse>;
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
    history(user: User, organizationId?: string, batch?: string, status?: string, q?: string, source?: string, page?: string, pageSize?: string): Promise<{
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
    activityReport(user: User, params: Record<string, string | undefined>): Promise<{
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
    exportActivityReport(user: User, params: Record<string, string | undefined>): Promise<string>;
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
    identify(user: User, id: string, organizationId?: string): Promise<{
        id: string;
        analysisStatus: "queued";
    }>;
    sizeChart(user: User, dto: FashionSizeChartDto, organizationId?: string): Promise<{
        url: string;
        s3Key: string;
    }>;
    banner(user: User, dto: FashionImageBannerDto, organizationId?: string): Promise<{
        url: string;
        s3Key: string;
    }>;
}
