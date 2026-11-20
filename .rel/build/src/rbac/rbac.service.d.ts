import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { Permission } from './entities/permission.entity.js';
import { RolePermission } from './entities/role-permission.entity.js';
import { Role } from './entities/role.entity.js';
import { SidebarModuleConfig } from './entities/sidebar-module-config.entity.js';
import { UserRoleAssignment } from './entities/user-role-assignment.entity.js';
export type AuthProfile = {
    id: string;
    email: string;
    name: string | null;
    active: boolean;
    role: string;
    roleSlug: string;
    roleName: string;
    permissions: string[];
    lastLoginAt: Date | null;
    createdAt: Date;
};
export declare class RbacService implements OnModuleInit {
    private readonly roleRepo;
    private readonly permissionRepo;
    private readonly rolePermissionRepo;
    private readonly userRoleRepo;
    private readonly sidebarConfigRepo;
    private readonly userRepo;
    private readonly config;
    private readonly logger;
    private syncInFlight;
    constructor(roleRepo: Repository<Role>, permissionRepo: Repository<Permission>, rolePermissionRepo: Repository<RolePermission>, userRoleRepo: Repository<UserRoleAssignment>, sidebarConfigRepo: Repository<SidebarModuleConfig>, userRepo: Repository<User>, config: ConfigService);
    onModuleInit(): Promise<void>;
    syncFromRegistry(): Promise<void>;
    private doSyncFromRegistry;
    private ensureAllRolesCanPublish;
    syncLegacyUserRoles(): Promise<void>;
    getRoleBySlug(slug: string): Promise<Role | null>;
    assignPrimaryRole(userId: string, roleSlug: string): Promise<void>;
    getPermissionKeysForUser(userId: string): Promise<Set<string>>;
    userHasPermission(userId: string, permissionKey: string): Promise<boolean>;
    getAuthProfile(user: User): Promise<AuthProfile>;
    createRole(dto: {
        slug: string;
        name: string;
        description?: string;
    }): Promise<Role>;
    private ensureRoleCanPublish;
    updateRole(id: string, dto: {
        name?: string;
        description?: string;
    }): Promise<Role>;
    deleteRole(id: string): Promise<void>;
    setRolePermissions(roleId: string, permissionKeys: string[]): Promise<Role>;
    removeRolePermission(roleId: string, permissionId: string): Promise<void>;
    resetRoleToDefaults(roleId: string): Promise<Role>;
    getSidebarConfigs(): Promise<SidebarModuleConfig[]>;
    setSidebarConfigs(configs: Array<{
        roleSlug: string;
        moduleKey: string;
        visible: boolean;
    }>): Promise<void>;
    getVisibleModulesForUser(userId: string): Promise<string[]>;
}
