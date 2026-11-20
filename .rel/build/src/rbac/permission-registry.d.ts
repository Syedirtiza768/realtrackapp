export type PermissionDefinition = {
    key: string;
    label: string;
    module: string;
    description?: string;
    defaultRoles?: string[];
};
export declare const ROLE_SLUGS: {
    readonly SUPER_ADMIN: "super_admin";
    readonly ADMIN: "admin";
    readonly MANAGER: "manager";
    readonly STAFF: "staff";
    readonly VIEWER: "viewer";
    readonly CATALOG_MANAGER: "catalog_manager";
    readonly LISTING_MANAGER: "listing_manager";
    readonly OPS_USER: "ops_user";
    readonly LISTING_USER: "listing_user";
    readonly SUPERVISOR: "supervisor";
    readonly FASHION_ADMIN: "fashion_admin";
    readonly FASHION_MANAGER: "fashion_manager";
    readonly FASHION_OPERATOR: "fashion_operator";
    readonly BUSINESS_INDUSTRIAL_ADMIN: "business_industrial_admin";
    readonly BUSINESS_INDUSTRIAL_MANAGER: "business_industrial_manager";
    readonly BUSINESS_INDUSTRIAL_OPERATOR: "business_industrial_operator";
};
export type RoleSlug = (typeof ROLE_SLUGS)[keyof typeof ROLE_SLUGS];
export declare const ALL_USERS_PUBLISH_PERMISSION_KEYS: readonly ["listings.publish", "channels.publish", "ebay.publish"];
export declare const LEGACY_USER_ROLE_TO_SLUG: Record<string, RoleSlug>;
export declare const PERMISSION_REGISTRY: PermissionDefinition[];
export declare const ROLE_DEFINITIONS: {
    slug: RoleSlug;
    name: string;
    description: string;
    isSystem: boolean;
}[];
export declare function permissionsForRole(slug: RoleSlug): string[];
export declare const SIDEBAR_MODULE_PERMISSIONS: Record<string, string>;
