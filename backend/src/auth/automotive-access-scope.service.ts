import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from './entities/user.entity.js';
import { UserOrganizationService } from './user-organization.service.js';

export type AutomotiveAccessFilter = {
  sql: string;
  params: Record<string, string | string[]>;
};

/**
 * Organization + vertical boundary for the legacy automotive tables.
 *
 * Historical automotive rows pre-date tenancy and have NULL organization and
 * vertical values. They remain visible only to members of the explicitly
 * configured legacy automotive organization. All newly-created rows are tagged.
 */
@Injectable()
export class AutomotiveAccessScopeService {
  constructor(
    private readonly userOrganizations: UserOrganizationService,
    private readonly config: ConfigService,
  ) {}

  async buildFilter(
    user: User | undefined,
    alias: string,
  ): Promise<AutomotiveAccessFilter | null> {
    if (!user) return null;

    let organizations = await this.userOrganizations.listForUser(user.id);
    if (organizations.length === 0) {
      organizations = [
        await this.userOrganizations.ensureDefaultForUser(user.id),
      ];
    }

    const organizationIds = organizations.map((org) => org.organizationId);
    const legacyOrganizationId = this.config.get<string>(
      'LEGACY_AUTOMOTIVE_ORGANIZATION_ID',
    );
    const mayReadLegacy = Boolean(
      legacyOrganizationId && organizationIds.includes(legacyOrganizationId),
    );

    const organizationSql = mayReadLegacy
      ? `(${alias}.organizationId IN (:...automotiveOrganizationIds) OR ${alias}.organizationId IS NULL)`
      : `${alias}.organizationId IN (:...automotiveOrganizationIds)`;

    return {
      sql: `(${alias}.vertical = :automotiveVertical OR ${alias}.vertical IS NULL) AND ${organizationSql}`,
      params: {
        automotiveVertical: 'automotive',
        automotiveOrganizationIds: organizationIds,
      },
    };
  }

  async resolveWriteOrganizationId(user: User): Promise<string> {
    const organizations = await this.userOrganizations.listForUser(user.id);
    const legacyOrganizationId = this.config.get<string>(
      'LEGACY_AUTOMOTIVE_ORGANIZATION_ID',
    );
    if (
      legacyOrganizationId &&
      organizations.some((org) => org.organizationId === legacyOrganizationId)
    ) {
      return legacyOrganizationId;
    }
    return (await this.userOrganizations.resolveOrganizationId(user.id))
      .organizationId;
  }

  resolveSystemWriteOrganizationId(organizationId?: string | null): string {
    if (organizationId) return organizationId;
    const legacyOrganizationId = this.config.get<string>(
      'LEGACY_AUTOMOTIVE_ORGANIZATION_ID',
    );
    if (!legacyOrganizationId) {
      throw new ServiceUnavailableException(
        'Legacy automotive organization is not configured',
      );
    }
    return legacyOrganizationId;
  }
}
