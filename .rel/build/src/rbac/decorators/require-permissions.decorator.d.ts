export declare const PERMISSIONS_KEY = "permissions";
export declare const PERMISSIONS_MODE_KEY = "permissions_mode";
export type PermissionsMode = 'all' | 'any';
export declare const RequirePermissions: (...permissions: string[]) => <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
export declare const RequireAnyPermission: (...permissions: string[]) => <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
