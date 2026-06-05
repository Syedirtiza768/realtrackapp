import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Organization } from './entities/organization.entity.js';
import {
  OrganizationMember,
  type OrgRole,
} from './entities/organization-member.entity.js';
import { User } from './entities/user.entity.js';

export type UserOrganizationSummary = {
  organizationId: string;
  name: string;
  slug: string;
  role: OrgRole;
};

@Injectable()
export class UserOrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepo: Repository<OrganizationMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async listForUser(userId: string): Promise<UserOrganizationSummary[]> {
    const rows = await this.memberRepo.find({
      where: { userId },
      relations: ['organization'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((m) => ({
      organizationId: m.organizationId,
      name: m.organization?.name ?? 'Workspace',
      slug: m.organization?.slug ?? '',
      role: m.role,
    }));
  }

  /**
   * Ensures the user belongs to at least one RealTrack workspace (internal tenant).
   * This is not an eBay identifier — sellers only use Sign in with eBay for store identity.
   */
  async ensureDefaultForUser(userId: string): Promise<UserOrganizationSummary> {
    const existing = await this.listForUser(userId);
    if (existing.length > 0) return existing[0]!;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const label =
      user?.name?.trim() ||
      user?.email?.split('@')[0]?.trim() ||
      'My workspace';
    const slug = `ws-${crypto.randomBytes(8).toString('hex')}`;

    const org = await this.orgRepo.save(
      this.orgRepo.create({
        name: label,
        slug,
        plan: 'free',
        status: 'active',
      }),
    );
    await this.memberRepo.save(
      this.memberRepo.create({
        organizationId: org.id,
        userId,
        role: 'owner',
      }),
    );

    return {
      organizationId: org.id,
      name: org.name,
      slug: org.slug,
      role: 'owner',
    };
  }

  async resolveOrganizationId(
    userId: string,
    organizationId?: string | null,
  ): Promise<{ organizationId: string; member: OrganizationMember }> {
    if (organizationId) {
      const member = await this.memberRepo.findOne({
        where: { userId, organizationId },
      });
      if (!member) {
        throw new ForbiddenException('Not a member of this workspace');
      }
      return { organizationId, member };
    }

    const orgs = await this.listForUser(userId);
    if (orgs.length === 1) {
      const member = await this.memberRepo.findOneOrFail({
        where: { userId, organizationId: orgs[0]!.organizationId },
      });
      return { organizationId: orgs[0]!.organizationId, member };
    }
    if (orgs.length === 0) {
      const created = await this.ensureDefaultForUser(userId);
      const member = await this.memberRepo.findOneOrFail({
        where: { userId, organizationId: created.organizationId },
      });
      return { organizationId: created.organizationId, member };
    }

    throw new BadRequestException({
      message:
        'You belong to multiple workspaces. Pass organizationId or select a workspace in the UI.',
      organizations: orgs,
    });
  }

  async getWorkspaceContext(userId: string): Promise<{
    organizationId: string;
    organizationName: string;
    organizations: UserOrganizationSummary[];
  }> {
    let organizations = await this.listForUser(userId);
    if (organizations.length === 0) {
      const created = await this.ensureDefaultForUser(userId);
      organizations = [created];
    }
    const active = organizations[0]!;
    return {
      organizationId: active.organizationId,
      organizationName: active.name,
      organizations,
    };
  }
}
