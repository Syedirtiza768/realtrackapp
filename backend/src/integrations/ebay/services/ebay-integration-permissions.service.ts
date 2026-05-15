import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationMember } from '../../../auth/entities/organization-member.entity.js';

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
  ) {}

  async assertOrgMember(userId: string, organizationId: string): Promise<OrganizationMember> {
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
      throw new ForbiddenException('Insufficient permissions to manage eBay store policies');
    }
  }
}
