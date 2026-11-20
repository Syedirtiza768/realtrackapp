import { DataSource } from 'typeorm';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { User } from '../auth/entities/user.entity.js';
export interface StockScope {
    organizationId: string;
    userId: string | null;
    warehouseIds: string[] | null;
}
export declare class StockAccessService {
    private readonly db;
    private readonly userOrgs;
    constructor(db: DataSource, userOrgs: UserOrganizationService);
    scope(user: User, organizationId?: string | null): Promise<StockScope>;
    assertWarehouse(scope: StockScope, ...warehouseIds: Array<string | null | undefined>): void;
    warehouseFilter(scope: StockScope, column: string, params: unknown[]): string;
}
