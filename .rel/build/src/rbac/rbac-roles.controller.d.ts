import { User } from '../auth/entities/user.entity.js';
import { CreateRoleDto, SetRolePermissionsDto, SetSidebarConfigDto, UpdateRoleDto } from './dto/rbac-admin.dto.js';
import { RbacService } from './rbac.service.js';
export declare class RbacRolesController {
    private readonly rbac;
    constructor(rbac: RbacService);
    createRole(body: CreateRoleDto): Promise<{
        id: string;
        slug: string;
        name: string;
        description: string | null;
        isSystem: boolean;
        isCustomized: boolean;
        permissions: never[];
    }>;
    getSidebarConfigs(): Promise<import("./entities/sidebar-module-config.entity.js").SidebarModuleConfig[]>;
    setSidebarConfigs(body: SetSidebarConfigDto): Promise<{
        ok: boolean;
    }>;
    getMySidebarConfig(user: User): Promise<{
        visibleModules: string[];
    }>;
    updateRole(id: string, body: UpdateRoleDto): Promise<{
        id: string;
        slug: string;
        name: string;
        description: string | null;
    }>;
    deleteRole(id: string): Promise<{
        ok: boolean;
    }>;
    setRolePermissions(id: string, body: SetRolePermissionsDto): Promise<{
        ok: boolean;
        isCustomized: boolean;
    }>;
    removeRolePermission(id: string, permId: string): Promise<{
        ok: boolean;
    }>;
    resetToDefaults(id: string): Promise<{
        ok: boolean;
        isCustomized: boolean;
    }>;
}
