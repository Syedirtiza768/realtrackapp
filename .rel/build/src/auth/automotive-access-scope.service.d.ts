import { ConfigService } from '@nestjs/config';
import type { User } from './entities/user.entity.js';
import { UserOrganizationService } from './user-organization.service.js';
export type AutomotiveAccessFilter = {
    sql: string;
    params: Record<string, string | string[]>;
};
export declare class AutomotiveAccessScopeService {
    private readonly userOrganizations;
    private readonly config;
    constructor(userOrganizations: UserOrganizationService, config: ConfigService);
    buildFilter(user: User | undefined, alias: string): Promise<AutomotiveAccessFilter | null>;
    resolveWriteOrganizationId(user: User): Promise<string>;
    resolveSystemWriteOrganizationId(organizationId?: string | null): string;
}
