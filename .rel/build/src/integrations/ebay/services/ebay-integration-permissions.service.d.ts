import { Repository } from 'typeorm';
import { OrganizationMember } from '../../../auth/entities/organization-member.entity.js';
import { UserOrganizationService } from '../../../auth/user-organization.service.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
export type EbayIntegrationAction = 'connect_ebay' | 'disconnect_ebay' | 'publish_listing' | 'revise_listing' | 'end_listing' | 'sync_policies' | 'manage_store_policies';
export declare class EbayIntegrationPermissionsService {
    private readonly members;
    private readonly accounts;
    private readonly userOrgs;
    constructor(members: Repository<OrganizationMember>, accounts: Repository<ConnectedEbayAccount>, userOrgs: UserOrganizationService);
    resolveOrganization(userId: string, organizationId?: string | null): Promise<{
        organizationId: string;
        member: OrganizationMember;
    }>;
    assertOrgMember(userId: string, organizationId: string): Promise<OrganizationMember>;
    canConnectEbay(role: string): boolean;
    canPublishListing(_role: string): boolean;
    assertCanConnect(role: string): void;
    assertCanPublish(role: string): void;
    canManageStorePolicies(role: string): boolean;
    assertCanManageStorePolicies(role: string): void;
    assertAccountAccess(userId: string, accountId: string, organizationId?: string | null): Promise<{
        organizationId: string;
        member: OrganizationMember;
        account: ConnectedEbayAccount;
    }>;
}
