import type { Request } from 'express';
import { RbacService } from '../rbac/rbac.service.js';
import { AuthAuditService } from './auth-audit.service.js';
import { AuthService } from './auth.service';
import { UserOrganizationService } from './user-organization.service.js';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto.js';
import { User } from './entities/user.entity.js';
import { AuthSessionService } from './auth-session.service.js';
export declare class AuthController {
    private readonly auth;
    private readonly userOrgs;
    private readonly rbac;
    private readonly authAudit;
    private readonly sessions;
    constructor(auth: AuthService, userOrgs: UserOrganizationService, rbac: RbacService, authAudit: AuthAuditService, sessions: AuthSessionService);
    login(body: LoginDto, req: Request): Promise<{
        accessToken: string;
        user: Partial<User>;
    }>;
    getPublicConfig(): {
        registrationEnabled: boolean;
    };
    register(body: RegisterDto, req: Request): Promise<{
        accessToken: string;
        user: Partial<User>;
    }>;
    me(user: User, req: Request): Promise<{
        user: {
            passwordChangeRequired: boolean;
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
        organizations: import("./user-organization.service.js").UserOrganizationSummary[];
    }>;
    logout(user: User, req: Request): Promise<{
        ok: boolean;
    }>;
    changePassword(user: User, body: ChangePasswordDto, req: Request): Promise<{
        ok: boolean;
    }>;
    listOrganizations(user: User): Promise<{
        organizations: import("./user-organization.service.js").UserOrganizationSummary[];
    }>;
}
