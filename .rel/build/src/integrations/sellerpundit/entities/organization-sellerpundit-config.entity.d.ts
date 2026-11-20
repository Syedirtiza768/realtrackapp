import { Organization } from '../../../auth/entities/organization.entity.js';
export declare class OrganizationSellerpunditConfig {
    id: string;
    organizationId: string;
    organization: Organization;
    enabled: boolean;
    credentialsEncrypted: string | null;
    lastJwtRefreshAt: Date | null;
    lastSyncAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
}
