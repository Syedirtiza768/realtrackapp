export type UserRole = 'super_admin' | 'admin' | 'manager' | 'user' | 'viewer';
export declare class User {
    id: string;
    email: string;
    passwordHash: string;
    name: string | null;
    role: UserRole;
    active: boolean;
    passwordChangeRequired: boolean;
    storeAccessAll: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
}
