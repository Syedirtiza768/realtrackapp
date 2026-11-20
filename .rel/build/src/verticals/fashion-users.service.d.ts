import { DataSource } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { VerticalsService } from './verticals.service.js';
import { FashionRoleDto, FashionStoreAccessDto, FashionUserCreateDto } from './fashion.dto.js';
export declare const FASHION_ROLES: string[];
export declare class FashionUsersService {
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
    create(actor: User, dto: FashionUserCreateDto, organizationId?: string): Promise<{
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
    updateRole(actor: User, id: string, dto: FashionRoleDto, organizationId?: string): Promise<{
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
    setStores(actor: User, id: string, dto: FashionStoreAccessDto, organizationId?: string): Promise<{
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
    private isDedicatedFashion;
    private validateStores;
    private summary;
}
