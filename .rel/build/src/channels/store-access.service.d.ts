import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { Store } from './entities/store.entity.js';
import { UserStoreAssignment, type StoreAccessLevel } from './entities/user-store-assignment.entity.js';
export declare class StoreAccessService {
    private readonly assignmentRepo;
    private readonly storeRepo;
    constructor(assignmentRepo: Repository<UserStoreAssignment>, storeRepo: Repository<Store>);
    getAccessibleStoreIds(user: User): Promise<Set<string>>;
    getStoreIdsAtLevel(user: User, minLevel: StoreAccessLevel): Promise<Set<string>>;
    assertStoreAccess(user: User, storeId: string, minLevel?: StoreAccessLevel): Promise<void>;
    getUserAssignments(userId: string): Promise<UserStoreAssignment[]>;
    setAssignment(userId: string, storeId: string, accessLevel: StoreAccessLevel): Promise<UserStoreAssignment>;
    removeAssignment(userId: string, storeId: string): Promise<void>;
    resolveStoreFilter(user: User | undefined): Promise<string[] | undefined>;
    static readonly UNSCOPED_LISTINGS_SQL = "r.id NOT IN (SELECT lci.listing_id FROM listing_channel_instances lci)";
    static readonly SCOPED_LISTINGS_SQL = "(r.id IN (SELECT lci.listing_id FROM listing_channel_instances lci WHERE lci.store_id IN (:...storeIds))\n      OR r.id NOT IN (SELECT lci.listing_id FROM listing_channel_instances lci))";
    setAccessAll(userId: string, value: boolean): Promise<void>;
}
