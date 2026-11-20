import { DataSource } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { VerticalsService } from './verticals.service.js';
import { BusinessIndustrialRoleDto, BusinessIndustrialStoreAssignmentsDto, BusinessIndustrialUserCreateDto } from './business-industrial.dto.js';
export declare const BUSINESS_INDUSTRIAL_ROLES: string[];
export declare class BusinessIndustrialUsersService {
    private readonly dataSource;
    private readonly organizations;
    private readonly stores;
    private readonly verticals;
    private readonly rbac;
    constructor(dataSource: DataSource, organizations: UserOrganizationService, stores: StoreAccessService, verticals: VerticalsService, rbac: RbacService);
    list(user: User, organizationId?: string): Promise<{
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
    create(actor: User, dto: BusinessIndustrialUserCreateDto, organizationId?: string): Promise<{
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
    updateRole(actor: User, id: string, dto: BusinessIndustrialRoleDto, organizationId?: string): Promise<{
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
    deactivate(actor: User, id: string, organizationId?: string): Promise<{
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
    setStores(actor: User, id: string, dto: BusinessIndustrialStoreAssignmentsDto, organizationId?: string): Promise<{
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
    private safeRole;
    private mutate;
    private isDedicatedBusinessIndustrial;
    private validateStores;
    private summary;
}
