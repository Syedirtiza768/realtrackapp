import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserOrganizationService } from './user-organization.service.js';
import { RbacService } from '../rbac/rbac.service.js';
export declare class AuthService {
    private readonly userRepo;
    private readonly jwt;
    private readonly userOrgs;
    private readonly rbac;
    private readonly config;
    constructor(userRepo: Repository<User>, jwt: JwtService, userOrgs: UserOrganizationService, rbac: RbacService, config: ConfigService);
    isPublicRegistrationEnabled(): boolean;
    assertPublicRegistrationAllowed(): void;
    validateAndSign(email: string, password: string, requestedVertical?: 'automotive' | 'fashion' | 'business_industrial'): Promise<{
        accessToken: string;
        user: Partial<User>;
    } | null>;
    register(email: string, password: string, name?: string): Promise<{
        accessToken: string;
        user: Partial<User>;
    }>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
    adminResetPassword(userId: string, newPassword: string): Promise<void>;
}
