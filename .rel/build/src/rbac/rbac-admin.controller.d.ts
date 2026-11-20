import type { Request } from 'express';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service.js';
import { AuthAuditService } from '../auth/auth-audit.service.js';
import { User } from '../auth/entities/user.entity.js';
import { Role } from './entities/role.entity.js';
import { Permission } from './entities/permission.entity.js';
import { AssignRoleDto, CreateRbacUserDto, ResetPasswordDto } from './dto/rbac-admin.dto.js';
import { RbacService } from './rbac.service.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { OrganizationMember } from '../auth/entities/organization-member.entity.js';
export declare class RbacAdminController {
    private readonly userRepo;
    private readonly roleRepo;
    private readonly permissionRepo;
    private readonly memberRepo;
    private readonly rbac;
    private readonly auth;
    private readonly authAudit;
    private readonly userOrgs;
    constructor(userRepo: Repository<User>, roleRepo: Repository<Role>, permissionRepo: Repository<Permission>, memberRepo: Repository<OrganizationMember>, rbac: RbacService, auth: AuthService, authAudit: AuthAuditService, userOrgs: UserOrganizationService);
    listPermissions(): Promise<Permission[]>;
    listRoles(): Promise<{
        id: string;
        slug: string;
        name: string;
        description: string | null;
        isSystem: boolean;
        isCustomized: boolean;
        permissions: string[];
    }[]>;
    listUsers(): Promise<{
        id: string;
        email: string;
        name: string | null;
        role: import("../auth/entities/user.entity.js").UserRole;
        active: boolean;
        lastLoginAt: Date | null;
        createdAt: Date;
        profile: import("./rbac.service.js").AuthProfile;
    }[]>;
    createUser(body: CreateRbacUserDto, actor: User): Promise<import("./rbac.service.js").AuthProfile | {
        error: string;
    }>;
    assignRole(userId: string, body: AssignRoleDto, actor: User): Promise<import("./rbac.service.js").AuthProfile | {
        error: string;
    }>;
    deactivate(id: string): Promise<{
        error: string;
        ok?: undefined;
    } | {
        ok: boolean;
        error?: undefined;
    }>;
    resetPassword(id: string, body: ResetPasswordDto, actor: User, req: Request): Promise<{
        ok: boolean;
    }>;
    addOrgMember(body: {
        userId: string;
        organizationId?: string;
        role?: string;
    }, actor: User): Promise<{
        error: string;
        ok?: undefined;
        message?: undefined;
        memberId?: undefined;
        organizationId?: undefined;
        role?: undefined;
    } | {
        ok: boolean;
        message: string;
        memberId: string;
        error?: undefined;
        organizationId?: undefined;
        role?: undefined;
    } | {
        ok: boolean;
        memberId: string;
        organizationId: string;
        role: import("../auth/entities/organization-member.entity.js").OrgRole;
        error?: undefined;
        message?: undefined;
    }>;
}
