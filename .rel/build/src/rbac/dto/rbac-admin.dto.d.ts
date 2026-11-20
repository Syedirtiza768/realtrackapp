export declare class CreateRbacUserDto {
    email: string;
    password: string;
    name?: string;
    roleSlug: string;
}
export declare class AssignRoleDto {
    roleSlug: string;
}
export declare class ResetPasswordDto {
    newPassword: string;
}
export declare class CreateRoleDto {
    slug: string;
    name: string;
    description?: string;
}
export declare class UpdateRoleDto {
    name?: string;
    description?: string;
}
export declare class SetRolePermissionsDto {
    permissionKeys: string[];
}
export declare class SidebarModuleConfigItemDto {
    roleSlug: string;
    moduleKey: string;
    visible: boolean;
}
export declare class SetSidebarConfigDto {
    configs: SidebarModuleConfigItemDto[];
}
