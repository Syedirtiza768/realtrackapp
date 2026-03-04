import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationMember } from '../../auth/entities/organization-member.entity.js';
import { FeatureFlag } from '../feature-flags/feature-flag.entity.js';

export const ORG_ROLES_KEY = 'org_roles';

/**
 * Guard that enforces organization-level access control.
 *
 * When the `multi_tenant` feature flag is enabled:
 * 1. Extracts `x-organization-id` header from the request.
 * 2. Verifies the requesting user is a member of that organization.
 * 3. Optionally checks that the user has a required org role.
 * 4. Attaches `req.organizationId` so downstream code can scope queries.
 *
 * When the feature flag is off, this guard is a no-op (always passes).
 */
@Injectable()
export class OrgGuard implements CanActivate {
  private readonly logger = new Logger(OrgGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(OrganizationMember)
    private readonly memberRepo: Repository<OrganizationMember>,
    @InjectRepository(FeatureFlag)
    private readonly flagRepo: Repository<FeatureFlag>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check feature flag — if multi_tenant is off, pass through
    const flag = await this.flagRepo.findOne({ where: { key: 'multi_tenant' } });
    if (!flag?.enabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) {
      // No authenticated user — let the auth guard handle denial
      return true;
    }

    const orgId = request.headers['x-organization-id'] as string;
    if (!orgId) {
      throw new ForbiddenException('x-organization-id header is required when multi-tenant mode is enabled');
    }

    const membership = await this.memberRepo.findOne({
      where: { organizationId: orgId, userId: user.id },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    // Check required org-level roles if specified via decorator
    const requiredRoles = this.reflector.get<string[]>(ORG_ROLES_KEY, context.getHandler());
    if (requiredRoles?.length) {
      if (!requiredRoles.includes(membership.role)) {
        throw new ForbiddenException(
          `Requires one of [${requiredRoles.join(', ')}] but you have '${membership.role}'`,
        );
      }
    }

    // Attach org context for downstream use
    request.organizationId = orgId;
    request.orgRole = membership.role;

    return true;
  }
}
