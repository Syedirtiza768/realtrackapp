import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { OrganizationMember } from '../auth/entities/organization-member.entity.js';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { VerticalsService } from './verticals.service.js';
import { BusinessIndustrialIncident } from './entities/business-industrial-incident.entity.js';
import { BusinessIndustrialReview } from './entities/business-industrial-review.entity.js';
import { BusinessIndustrialUnit } from './entities/business-industrial-unit.entity.js';
import type { BusinessIndustrialIncidentDto, BusinessIndustrialReviewDto, BusinessIndustrialStoreAccessDto, CreateBusinessIndustrialDraftDto, UpdateBusinessIndustrialDraftDto } from './business-industrial.dto.js';
import type { BusinessIndustrialUnitAllocationDto, BusinessIndustrialUnitSoldDto } from './business-industrial-units.dto.js';
export declare class BusinessIndustrialService {
    private readonly verticals;
    private readonly userOrgs;
    private readonly storeAccess;
    private readonly rbac;
    private readonly events;
    private readonly inventory;
    private readonly productRepo;
    private readonly reviewRepo;
    private readonly unitRepo;
    private readonly incidentRepo;
    private readonly storeRepo;
    private readonly channelRepo;
    private readonly accountRepo;
    private readonly memberRepo;
    private readonly userRepo;
    constructor(verticals: VerticalsService, userOrgs: UserOrganizationService, storeAccess: StoreAccessService, rbac: RbacService, events: EventEmitter2, inventory: EbayInventoryApiService, productRepo: Repository<CatalogProduct>, reviewRepo: Repository<BusinessIndustrialReview>, unitRepo: Repository<BusinessIndustrialUnit>, incidentRepo: Repository<BusinessIndustrialIncident>, storeRepo: Repository<Store>, channelRepo: Repository<EbayListingChannel>, accountRepo: Repository<ConnectedEbayAccount>, memberRepo: Repository<OrganizationMember>, userRepo: Repository<User>);
    assertEnabled(): Promise<void>;
    categoryFamilies(): readonly [{
        readonly id: "industrial_automation";
        readonly label: "Industrial automation & controls";
        readonly restricted: false;
    }, {
        readonly id: "electrical_equipment";
        readonly label: "Electrical equipment & protection";
        readonly restricted: false;
    }, {
        readonly id: "machinery_tooling";
        readonly label: "Manufacturing machinery, tooling & spare parts";
        readonly restricted: false;
    }, {
        readonly id: "hydraulics_pneumatics";
        readonly label: "Hydraulics, pneumatics, pumps & valves";
        readonly restricted: false;
    }, {
        readonly id: "test_measurement";
        readonly label: "Test, measurement & inspection equipment";
        readonly restricted: false;
    }, {
        readonly id: "material_handling";
        readonly label: "Material handling & industrial storage";
        readonly restricted: false;
    }, {
        readonly id: "commercial_equipment";
        readonly label: "Commercial kitchen, office & retail equipment";
        readonly restricted: false;
    }, {
        readonly id: "construction_safety";
        readonly label: "Construction, industrial supplies & safety";
        readonly restricted: false;
    }, {
        readonly id: "medical_laboratory";
        readonly label: "Medical and laboratory equipment";
        readonly restricted: true;
    }, {
        readonly id: "hazmat_chemical";
        readonly label: "Hazardous materials and chemicals";
        readonly restricted: true;
    }];
    resolveOrganization(user: User, organizationId?: string): Promise<{
        organizationId: string;
        member: OrganizationMember;
    }>;
    workspace(user: User, organizationId?: string): Promise<{
        organizationId: string;
        organizationRole: import("../auth/entities/organization-member.entity.js").OrgRole;
        categoryFamilies: readonly [{
            readonly id: "industrial_automation";
            readonly label: "Industrial automation & controls";
            readonly restricted: false;
        }, {
            readonly id: "electrical_equipment";
            readonly label: "Electrical equipment & protection";
            readonly restricted: false;
        }, {
            readonly id: "machinery_tooling";
            readonly label: "Manufacturing machinery, tooling & spare parts";
            readonly restricted: false;
        }, {
            readonly id: "hydraulics_pneumatics";
            readonly label: "Hydraulics, pneumatics, pumps & valves";
            readonly restricted: false;
        }, {
            readonly id: "test_measurement";
            readonly label: "Test, measurement & inspection equipment";
            readonly restricted: false;
        }, {
            readonly id: "material_handling";
            readonly label: "Material handling & industrial storage";
            readonly restricted: false;
        }, {
            readonly id: "commercial_equipment";
            readonly label: "Commercial kitchen, office & retail equipment";
            readonly restricted: false;
        }, {
            readonly id: "construction_safety";
            readonly label: "Construction, industrial supplies & safety";
            readonly restricted: false;
        }, {
            readonly id: "medical_laboratory";
            readonly label: "Medical and laboratory equipment";
            readonly restricted: true;
        }, {
            readonly id: "hazmat_chemical";
            readonly label: "Hazardous materials and chemicals";
            readonly restricted: true;
        }];
        stores: {
            id: string;
            storeName: string;
            status: "active" | "suspended" | "paused" | "archived";
            marketplaceId: string | null;
            vertical: "business_industrial";
        }[];
        metrics: {
            listingCount: number;
            draftCount: number;
            pendingReviewCount: number;
            openIncidentCount: number;
        };
    }>;
    listListings(user: User, organizationId?: string, limit?: number): Promise<{
        id: string;
        sku: string | null;
        title: string;
        description: string | null;
        brand: string | null;
        mpn: string | null;
        conditionId: string | null;
        conditionLabel: string | null;
        price: number | null;
        quantity: number | null;
        imageUrls: string[];
        optimizedTitle: string | null;
        optimizedDescription: string | null;
        optimizationPayload: Record<string, unknown> | null;
        seoScore: number | null;
        readinessScore: number | null;
        categoryId: string | null;
        categoryName: string | null;
        vertical: "fashion" | "business_industrial" | "automotive" | null;
        verticalAttributes: import("./vertical.types.js").VerticalAttributes;
        verticalValidationStatus: string;
        manualReview: boolean;
        serializedUnitCount: number;
        publicSerialNumbers: string[];
        updatedAt: Date;
    }[]>;
    createListing(user: User, dto: CreateBusinessIndustrialDraftDto, organizationId?: string): Promise<{
        id: string;
        sku: string | null;
        title: string;
        description: string | null;
        brand: string | null;
        mpn: string | null;
        conditionId: string | null;
        conditionLabel: string | null;
        price: number | null;
        quantity: number | null;
        imageUrls: string[];
        optimizedTitle: string | null;
        optimizedDescription: string | null;
        optimizationPayload: Record<string, unknown> | null;
        seoScore: number | null;
        readinessScore: number | null;
        categoryId: string | null;
        categoryName: string | null;
        vertical: "fashion" | "business_industrial" | "automotive" | null;
        verticalAttributes: import("./vertical.types.js").VerticalAttributes;
        verticalValidationStatus: string;
        manualReview: boolean;
        serializedUnitCount: number;
        publicSerialNumbers: string[];
        updatedAt: Date;
    }>;
    updateListing(user: User, id: string, dto: UpdateBusinessIndustrialDraftDto, organizationId?: string): Promise<{
        id: string;
        sku: string | null;
        title: string;
        description: string | null;
        brand: string | null;
        mpn: string | null;
        conditionId: string | null;
        conditionLabel: string | null;
        price: number | null;
        quantity: number | null;
        imageUrls: string[];
        optimizedTitle: string | null;
        optimizedDescription: string | null;
        optimizationPayload: Record<string, unknown> | null;
        seoScore: number | null;
        readinessScore: number | null;
        categoryId: string | null;
        categoryName: string | null;
        vertical: "fashion" | "business_industrial" | "automotive" | null;
        verticalAttributes: import("./vertical.types.js").VerticalAttributes;
        verticalValidationStatus: string;
        manualReview: boolean;
        serializedUnitCount: number;
        publicSerialNumbers: string[];
        updatedAt: Date;
    }>;
    reviewListing(user: User, id: string, dto: BusinessIndustrialReviewDto, organizationId?: string): Promise<{
        listing: {
            id: string;
            sku: string | null;
            title: string;
            description: string | null;
            brand: string | null;
            mpn: string | null;
            conditionId: string | null;
            conditionLabel: string | null;
            price: number | null;
            quantity: number | null;
            imageUrls: string[];
            optimizedTitle: string | null;
            optimizedDescription: string | null;
            optimizationPayload: Record<string, unknown> | null;
            seoScore: number | null;
            readinessScore: number | null;
            categoryId: string | null;
            categoryName: string | null;
            vertical: "fashion" | "business_industrial" | "automotive" | null;
            verticalAttributes: import("./vertical.types.js").VerticalAttributes;
            verticalValidationStatus: string;
            manualReview: boolean;
            serializedUnitCount: number;
            publicSerialNumbers: string[];
            updatedAt: Date;
        };
        review: {
            id: string;
            status: import("./entities/business-industrial-review.entity.js").BusinessIndustrialReviewStatus;
            provenanceConfirmed: boolean;
            specificationsVerified: boolean;
            testingReviewed: boolean;
            restrictedCategoryCleared: boolean;
            reviewedByUserId: string | null;
            reviewedAt: Date | null;
            notes: string | null;
            evidenceCount: number;
            riskFlags: string[];
        };
    }>;
    listReviews(user: User, organizationId?: string): Promise<{
        listing: {
            id: string;
            sku: string | null;
            title: string;
            description: string | null;
            brand: string | null;
            mpn: string | null;
            conditionId: string | null;
            conditionLabel: string | null;
            price: number | null;
            quantity: number | null;
            imageUrls: string[];
            optimizedTitle: string | null;
            optimizedDescription: string | null;
            optimizationPayload: Record<string, unknown> | null;
            seoScore: number | null;
            readinessScore: number | null;
            categoryId: string | null;
            categoryName: string | null;
            vertical: "fashion" | "business_industrial" | "automotive" | null;
            verticalAttributes: import("./vertical.types.js").VerticalAttributes;
            verticalValidationStatus: string;
            manualReview: boolean;
            serializedUnitCount: number;
            publicSerialNumbers: string[];
            updatedAt: Date;
        } | null;
        id: string;
        status: import("./entities/business-industrial-review.entity.js").BusinessIndustrialReviewStatus;
        provenanceConfirmed: boolean;
        specificationsVerified: boolean;
        testingReviewed: boolean;
        restrictedCategoryCleared: boolean;
        reviewedByUserId: string | null;
        reviewedAt: Date | null;
        notes: string | null;
        evidenceCount: number;
        riskFlags: string[];
    }[]>;
    getPrivateReview(user: User, id: string, organizationId?: string): Promise<{
        review: BusinessIndustrialReview;
        units: BusinessIndustrialUnit[];
    }>;
    allocateUnit(user: User, unitId: string, dto: BusinessIndustrialUnitAllocationDto, organizationId?: string): Promise<{
        id: string;
        catalogProductId: string;
        serialNumberPublic: string | null;
        status: import("./entities/business-industrial-unit.entity.js").BusinessIndustrialUnitStatus;
        allocatedStoreId: string | null;
        allocatedOfferId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    markUnitSold(user: User, unitId: string, dto: BusinessIndustrialUnitSoldDto, organizationId?: string): Promise<{
        id: string;
        catalogProductId: string;
        serialNumberPublic: string | null;
        status: import("./entities/business-industrial-unit.entity.js").BusinessIndustrialUnitStatus;
        allocatedStoreId: string | null;
        allocatedOfferId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    quarantine(user: User, id: string, organizationId?: string, note?: string): Promise<{
        remoteTakedown: string;
        targets: ({
            id: string;
            status: string;
            remoteRemovalVerified: boolean;
            message: string;
        } | {
            id: string;
            status: string;
            remoteRemovalVerified: boolean;
            message: undefined;
        })[];
        id: string;
        status: string;
        localBlock: boolean;
    }>;
    createIncident(user: User, dto: BusinessIndustrialIncidentDto, organizationId?: string): Promise<{
        id: string;
        catalogProductId: string | null;
        externalEventId: string;
        incidentType: import("./entities/business-industrial-incident.entity.js").BusinessIndustrialIncidentType;
        status: import("./entities/business-industrial-incident.entity.js").BusinessIndustrialIncidentStatus;
        verified: boolean;
        detectedAt: Date;
        firstTakedownAttemptAt: Date | null;
        takedownCompletedAt: Date | null;
        takedownAttempts: Record<string, unknown>[];
        remoteActionRequired: boolean;
        notes: string | null;
    }>;
    processEnforcementWebhook(rawBody: Buffer, signature?: string): Promise<{
        status: string;
        reason: string;
        incident?: undefined;
        remoteActionRequired?: undefined;
    } | {
        status: string;
        incident: {
            id: string;
            catalogProductId: string | null;
            externalEventId: string;
            incidentType: import("./entities/business-industrial-incident.entity.js").BusinessIndustrialIncidentType;
            status: import("./entities/business-industrial-incident.entity.js").BusinessIndustrialIncidentStatus;
            verified: boolean;
            detectedAt: Date;
            firstTakedownAttemptAt: Date | null;
            takedownCompletedAt: Date | null;
            takedownAttempts: Record<string, unknown>[];
            remoteActionRequired: boolean;
            notes: string | null;
        };
        reason?: undefined;
        remoteActionRequired?: undefined;
    } | {
        status: string;
        incident: {
            id: string;
            catalogProductId: string | null;
            externalEventId: string;
            incidentType: import("./entities/business-industrial-incident.entity.js").BusinessIndustrialIncidentType;
            status: import("./entities/business-industrial-incident.entity.js").BusinessIndustrialIncidentStatus;
            verified: boolean;
            detectedAt: Date;
            firstTakedownAttemptAt: Date | null;
            takedownCompletedAt: Date | null;
            takedownAttempts: Record<string, unknown>[];
            remoteActionRequired: boolean;
            notes: string | null;
        };
        remoteActionRequired: boolean;
        reason?: undefined;
    }>;
    listIncidents(user: User, organizationId?: string): Promise<{
        id: string;
        catalogProductId: string | null;
        externalEventId: string;
        incidentType: import("./entities/business-industrial-incident.entity.js").BusinessIndustrialIncidentType;
        status: import("./entities/business-industrial-incident.entity.js").BusinessIndustrialIncidentStatus;
        verified: boolean;
        detectedAt: Date;
        firstTakedownAttemptAt: Date | null;
        takedownCompletedAt: Date | null;
        takedownAttempts: Record<string, unknown>[];
        remoteActionRequired: boolean;
        notes: string | null;
    }[]>;
    retryIncidentTakedown(user: User, id: string, organizationId?: string): Promise<{
        id: string;
        catalogProductId: string | null;
        externalEventId: string;
        incidentType: import("./entities/business-industrial-incident.entity.js").BusinessIndustrialIncidentType;
        status: import("./entities/business-industrial-incident.entity.js").BusinessIndustrialIncidentStatus;
        verified: boolean;
        detectedAt: Date;
        firstTakedownAttemptAt: Date | null;
        takedownCompletedAt: Date | null;
        takedownAttempts: Record<string, unknown>[];
        remoteActionRequired: boolean;
        notes: string | null;
    }>;
    endListingChannel(user: User, channelId: string, organizationId?: string): Promise<{
        id: string;
        status: string;
        remoteRemovalVerified: boolean;
        message: string;
    } | {
        id: string;
        status: string;
        remoteRemovalVerified: boolean;
        message: undefined;
    }>;
    releaseIncident(user: User, id: string, notes: string, organizationId?: string): Promise<BusinessIndustrialIncident>;
    authorizedStores(user: User, organizationId: string): Promise<Store[]>;
    assertBusinessIndustrialStore(user: User, storeId: string, organizationId: string, minLevel?: 'view' | 'operate' | 'admin'): Promise<Store>;
    listUsers(user: User, organizationId?: string): Promise<Record<string, unknown>[]>;
    updateUserRole(actor: User, userId: string, role: string, organizationId?: string): Promise<{
        userId: string;
        roleSlug: string;
    }>;
    deactivateUser(actor: User, userId: string, organizationId?: string): Promise<{
        userId: string;
        active: boolean;
    }>;
    setUserStoreAccess(actor: User, userId: string, dto: BusinessIndustrialStoreAccessDto, organizationId?: string): Promise<{
        userId: string;
        storeId: string;
        accessLevel: "admin" | "view" | "operate";
    }>;
    private findProduct;
    private assertMutable;
    private normalizeAttributes;
    private assertUnitPayload;
    private quantityFromAttributes;
    private saveUnits;
    private ensurePendingReview;
    private applyLocalQuarantine;
    private finishIncidentTakedown;
    private withdrawChannel;
    private isDedicatedBusinessIndustrialStore;
    private storeSummary;
    private publicProduct;
    private unitPublic;
    private reviewSummary;
    private incidentSummary;
}
