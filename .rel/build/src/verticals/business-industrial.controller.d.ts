import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { User } from '../auth/entities/user.entity.js';
import { BusinessIndustrialIncidentDto, BusinessIndustrialQuarantineDto, BusinessIndustrialReviewDto, BusinessIndustrialRoleDto, BusinessIndustrialStoreAssignmentsDto, BusinessIndustrialUserCreateDto, CreateBusinessIndustrialDraftDto, UpdateBusinessIndustrialDraftDto } from './business-industrial.dto.js';
import { BusinessIndustrialReleaseIncidentDto } from './business-industrial-release.dto.js';
import { BusinessIndustrialService } from './business-industrial.service.js';
import { BusinessIndustrialUsersService } from './business-industrial-users.service.js';
import { BusinessIndustrialUnitAllocationDto, BusinessIndustrialUnitSoldDto } from './business-industrial-units.dto.js';
export declare class BusinessIndustrialController {
    private readonly businessIndustrial;
    private readonly businessIndustrialUsers;
    constructor(businessIndustrial: BusinessIndustrialService, businessIndustrialUsers: BusinessIndustrialUsersService);
    webhook(request: RawBodyRequest<Request>, signature?: string): Promise<{
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
    categories(): readonly [{
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
    listings(user: User, organizationId?: string, limit?: string): Promise<{
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
    reviewQueue(user: User, organizationId?: string): Promise<{
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
    privateReview(user: User, id: string, organizationId?: string): Promise<{
        review: import("./entities/business-industrial-review.entity.js").BusinessIndustrialReview;
        units: import("./entities/business-industrial-unit.entity.js").BusinessIndustrialUnit[];
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
    quarantine(user: User, id: string, body: BusinessIndustrialQuarantineDto, organizationId?: string): Promise<{
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
    incidents(user: User, organizationId?: string): Promise<{
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
    releaseIncident(user: User, id: string, dto: BusinessIndustrialReleaseIncidentDto, organizationId?: string): Promise<import("./entities/business-industrial-incident.entity.js").BusinessIndustrialIncident>;
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
    stores(user: User, organizationId?: string): Promise<{
        id: string;
        storeName: string;
        status: "active" | "suspended" | "paused" | "archived";
        marketplaceId: string | null;
        vertical: string;
    }[]>;
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
    createUser(user: User, dto: BusinessIndustrialUserCreateDto, organizationId?: string): Promise<{
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
    updateUserRole(user: User, userId: string, dto: BusinessIndustrialRoleDto, organizationId?: string): Promise<{
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
    deactivateUser(user: User, userId: string, organizationId?: string): Promise<{
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
    setStoreAccess(user: User, userId: string, dto: BusinessIndustrialStoreAssignmentsDto, organizationId?: string): Promise<{
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
}
