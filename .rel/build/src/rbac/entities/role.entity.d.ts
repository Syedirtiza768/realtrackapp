import { RolePermission } from './role-permission.entity.js';
import { UserRoleAssignment } from './user-role-assignment.entity.js';
export declare class Role {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    isCustomized: boolean;
    createdAt: Date;
    updatedAt: Date;
    rolePermissions: RolePermission[];
    userAssignments: UserRoleAssignment[];
}
