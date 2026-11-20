import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { FashionReview } from './entities/fashion-review.entity.js';
import { AnalyzeFashionImagesDto, CreateFashionDraftDto, FashionReviewDto, FashionRoleDto, FashionStoreConfigDto, FashionStoreAccessDto, FashionUserCreateDto, GenerateFashionListingDto, UpdateFashionDraftDto } from './fashion.dto.js';
import { VerticalsService } from './verticals.service.js';
import { FashionListingsService } from './fashion-listings.service.js';
import { FashionUsersService } from './fashion-users.service.js';
import { FashionImageAnalysisService } from './fashion-image-analysis.service.js';
export declare class FashionController {
    private readonly verticals;
    private readonly userOrganizations;
    private readonly storeAccess;
    private readonly productRepo;
    private readonly reviewRepo;
    private readonly fashionListings;
    private readonly fashionUsers;
    private readonly fashionImages;
    constructor(verticals: VerticalsService, userOrganizations: UserOrganizationService, storeAccess: StoreAccessService, productRepo: Repository<CatalogProduct>, reviewRepo: Repository<FashionReview>, fashionListings: FashionListingsService, fashionUsers: FashionUsersService, fashionImages: FashionImageAnalysisService);
    workspace(user: User, organizationId?: string): Promise<{
        organizationId: string;
        organizationRole: import("../auth/entities/organization-member.entity.js").OrgRole;
        stores: {
            id: string;
            storeName: string;
            channel: string;
            status: "active" | "suspended" | "paused" | "archived";
            marketplaceId: string | null;
            fashionEnabled: boolean;
            verticalConfig: import("./vertical.types.js").VerticalConfig;
        }[];
        metrics: {
            listingCount: number;
            pendingReviewCount: number;
        };
    }>;
    users(user: User, organizationId?: string): Promise<{
        userId: string;
        email: string;
        name: string | null;
        organizationRole: import("../auth/entities/organization-member.entity.js").OrgRole;
        roleSlug: string;
        roleName: string;
        active: boolean;
        storeAssignments: {
            storeId: string;
            accessLevel: import("../channels/entities/user-store-assignment.entity.js").StoreAccessLevel;
        }[];
    }[]>;
    createUser(user: User, dto: FashionUserCreateDto, organizationId?: string): Promise<{
        userId: string;
        email: string;
        name: string | null;
        organizationRole: import("../auth/entities/organization-member.entity.js").OrgRole;
        roleSlug: string;
        roleName: string;
        active: boolean;
        storeAssignments: {
            storeId: string;
            accessLevel: import("../channels/entities/user-store-assignment.entity.js").StoreAccessLevel;
        }[];
    }>;
    updateUserRole(user: User, id: string, dto: FashionRoleDto, organizationId?: string): Promise<{
        userId: string;
        email: string;
        name: string | null;
        organizationRole: import("../auth/entities/organization-member.entity.js").OrgRole;
        roleSlug: string;
        roleName: string;
        active: boolean;
        storeAssignments: {
            storeId: string;
            accessLevel: import("../channels/entities/user-store-assignment.entity.js").StoreAccessLevel;
        }[];
    }>;
    deactivateUser(user: User, id: string, organizationId?: string): Promise<{
        userId: string;
        email: string;
        name: string | null;
        organizationRole: import("../auth/entities/organization-member.entity.js").OrgRole;
        roleSlug: string;
        roleName: string;
        active: boolean;
        storeAssignments: {
            storeId: string;
            accessLevel: import("../channels/entities/user-store-assignment.entity.js").StoreAccessLevel;
        }[];
    }>;
    setUserStores(user: User, id: string, dto: FashionStoreAccessDto, organizationId?: string): Promise<{
        userId: string;
        email: string;
        name: string | null;
        organizationRole: import("../auth/entities/organization-member.entity.js").OrgRole;
        roleSlug: string;
        roleName: string;
        active: boolean;
        storeAssignments: {
            storeId: string;
            accessLevel: import("../channels/entities/user-store-assignment.entity.js").StoreAccessLevel;
        }[];
    }>;
    stores(user: User, organizationId?: string): Promise<{
        id: string;
        storeName: string;
        channel: string;
        status: "active" | "suspended" | "paused" | "archived";
        marketplaceId: string | null;
        fashionEnabled: boolean;
        verticalConfig: import("./vertical.types.js").VerticalConfig;
    }[]>;
    updateStore(user: User, id: string, dto: FashionStoreConfigDto, organizationId?: string): Promise<import("./vertical.types.js").VerticalConfig>;
    listings(user: User, organizationId?: string, limit?: string): Promise<{
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
    }[]>;
    listing(user: User, id: string, organizationId?: string): Promise<{
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
    uploadPhotos(user: User, files: Express.Multer.File[], organizationId?: string, sku?: string): Promise<{
        uploaded: {
            url: string;
            s3Key: string;
            filename: string;
        }[];
        errors: string[];
    }>;
    analyzeImages(user: User, dto: AnalyzeFashionImagesDto, organizationId?: string): Promise<{
        status: "suggested";
        attributes: import("./vertical.types.js").VerticalAttributes;
        suggestedKeys: string[];
        conflicts: import("./fashion.config.js").FashionSuggestionConflict[];
        warnings: string[];
        validationErrors: string[];
        multipleItems: boolean;
        reviewPhotoSet: boolean;
        category: {
            categoryId: string | null;
            categoryName: string | null;
            query: null;
        } | {
            categoryId: string;
            categoryName: string;
            query: string;
        } | {
            categoryId: null;
            categoryName: null;
            query: string;
        };
        brand: string | null;
        conditionLabel: string | null;
        title: string;
        description: string;
        suggestedSku: string;
        visibleText: string[];
    } | {
        status: "failed";
        attributes: import("./vertical.types.js").VerticalAttributes;
        suggestedKeys: never[];
        conflicts: never[];
        warnings: string[];
        validationErrors: never[];
        multipleItems: boolean;
        reviewPhotoSet: boolean;
        category: {
            categoryId: null;
            categoryName: null;
            query: null;
        };
        brand: string | null;
        conditionLabel: null;
        title: string;
        description: string;
        suggestedSku: string;
        visibleText: never[];
    }>;
    generateContent(dto: GenerateFashionListingDto): {
        title: string;
        description: string;
        attributes: import("./vertical.types.js").VerticalAttributes;
        errors: string[];
        warnings: string[];
    };
    createListing(user: User, dto: CreateFashionDraftDto, organizationId?: string): Promise<{
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
    updateListing(user: User, id: string, dto: UpdateFashionDraftDto, organizationId?: string): Promise<{
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
    reviewListing(user: User, id: string, dto: FashionReviewDto, organizationId?: string): Promise<{
        listing: {
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
        };
        review: {
            id: string;
            status: import("./entities/fashion-review.entity.js").FashionReviewStatus;
            authenticityConfirmed: boolean;
            reviewedByUserId: string | null;
            reviewedAt: Date | null;
            notes: string | null;
            evidenceCount: number;
        };
    }>;
    getReview(user: User, id: string, organizationId?: string): Promise<FashionReview | {
        catalogProductId: string;
        organizationId: string;
        status: "pending";
        authenticityConfirmed: false;
        evidenceKeys: never[];
        notes: null;
        reviewedByUserId: null;
        reviewedAt: null;
    }>;
    incidents(user: User, organizationId?: string): Promise<{
        targets: {
            id: string;
            ebayAccountId: string;
            marketplaceId: string;
            status: import("../integrations/ebay/entities/ebay-listing-channel.entity.js").EbayListingChannelStatus;
            lastErrorMessage: string | null;
            remoteRemovalVerified: boolean;
        }[];
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
    }[]>;
    quarantine(user: User, id: string, organizationId?: string): Promise<{
        id: string;
        status: string;
        remoteTakedown: string;
        targets: ({
            id: string;
            status: string;
            remoteRemovalVerified: boolean;
            message?: undefined;
        } | {
            id: string;
            status: string;
            remoteRemovalVerified: boolean;
            message: string;
        })[];
    }>;
    private authorizedFashionStores;
    private storeSummary;
}
