import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationMember } from '../../../auth/entities/organization-member.entity.js';
import { UserOrganizationService } from '../../../auth/user-organization.service.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';

export type EbayIntegrationAction =
  | 'connect_ebay'
  | 'disconnect_ebay'
  | 'publish_listing'
  | 'revise_listing'
  | 'end_listing'
  | 'sync_policies'
  | 'manage_store_policies';

@Injectable()
export class EbayIntegrationPermissionsService {
  constructor(
    @InjectRepository(OrganizationMember)
    private readonly members: Repository<OrganizationMember>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accounts: Repository<ConnectedEbayAccount>,
    private readonly userOrgs: UserOrganizationService,
  ) {}

  async resolveOrganization(
    userId: string,
    organizationId?: string | null,
  ): Promise<{ organizationId: string; member: OrganizationMember }> {
    return this.userOrgs.resolveOrganizationId(userId, organizationId);
  }

  async assertOrgMember(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMember> {
    const m = await this.members.findOne({
      where: { userId, organizationId },
    });
    if (!m) {
      throw new ForbiddenException('Not a member of this organization');
    }
    return m;
  }

  canConnectEbay(role: string): boolean {
    return role === 'owner' || role === 'admin' || role === 'editor';
  }

  canPublishListing(role: string): boolean {
    return role === 'owner' || role === 'admin' || role === 'editor';
  }

  assertCanConnect(role: string): void {
    if (!this.canConnectEbay(role)) {
      throw new ForbiddenException('Insufficient permissions to connect eBay');
    }
  }

  assertCanPublish(role: string): void {
    if (!this.canPublishListing(role)) {
      throw new ForbiddenException('Insufficient permissions to publish');
    }
  }

  /** Policy sync + default policy mapping — same gate as connect for now. */
  canManageStorePolicies(role: string): boolean {
    return this.canConnectEbay(role);
  }

  assertCanManageStorePolicies(role: string): void {
    if (!this.canManageStorePolicies(role)) {
      throw new ForbiddenException(
        'Insufficient permissions to manage eBay store policies',
      );
    }
  }

  /** Resolve tenant from account row; organizationId query is optional. */
  async assertAccountAccess(
    userId: string,
    accountId: string,
    organizationId?: string | null,
  ): Promise<{
    organizationId: string;
    member: OrganizationMember;
    account: ConnectedEbayAccount;
  }> {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException('eBay account not found');
    }
    const orgHint = organizationId ?? account.organizationId;
    const { organizationId: resolvedOrgId, member } =
      await this.resolveOrganization(userId, orgHint);
    if (resolvedOrgId !== account.organizationId) {
      throw new ForbiddenException('Account does not belong to this workspace');
    }
    return { organizationId: resolvedOrgId, member, account };
  }
}
