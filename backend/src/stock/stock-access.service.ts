import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { User } from '../auth/entities/user.entity.js';
import { UserWarehouseAssignment } from './entities/index.js';

/** Resolved caller scope for stock operations. */
export interface StockScope {
  organizationId: string;
  /** null for system-originated operations (vertical intake hooks, order events). */
  userId: string | null;
  /** null = every warehouse in the organization. */
  warehouseIds: string[] | null;
}

/**
 * Organization + warehouse scoping.
 *
 * A user with no user_warehouse_assignments rows in the org can access every warehouse.
 * Once any assignment exists, the user is restricted to exactly those warehouses.
 * (Deliberately not "no rows = no access": see the 2026-09-15 B&I `AND 1 = 0` incident.)
 */
@Injectable()
export class StockAccessService {
  constructor(
    private readonly db: DataSource,
    private readonly userOrgs: UserOrganizationService,
  ) {}

  async scope(user: User, organizationId?: string | null): Promise<StockScope> {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const rows = await this.db.getRepository(UserWarehouseAssignment).find({
      where: { userId: user.id, organizationId: org.organizationId },
    });
    return {
      organizationId: org.organizationId,
      userId: user.id,
      warehouseIds: rows.length ? rows.map((r) => r.warehouseId) : null,
    };
  }

  assertWarehouse(scope: StockScope, ...warehouseIds: Array<string | null | undefined>) {
    if (!scope.warehouseIds) return;
    for (const id of warehouseIds) {
      if (id && !scope.warehouseIds.includes(id))
        throw new ForbiddenException('You do not have access to this warehouse');
    }
  }

  /** SQL fragment restricting `column` to the caller's warehouses. Appends to params. */
  warehouseFilter(scope: StockScope, column: string, params: unknown[]): string {
    if (!scope.warehouseIds) return 'TRUE';
    params.push(scope.warehouseIds);
    return `${column} = ANY($${params.length}::uuid[])`;
  }
}
