import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { Store } from './entities/store.entity.js';
import { UserStoreAssignment, type StoreAccessLevel } from './entities/user-store-assignment.entity.js';

@Injectable()
export class StoreAccessService {
  constructor(
    @InjectRepository(UserStoreAssignment)
    private readonly assignmentRepo: Repository<UserStoreAssignment>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  /**
   * Get the set of store IDs a user has access to.
   * If storeAccessAll is true, returns all stores (no filter).
   */
  async getAccessibleStoreIds(user: User): Promise<Set<string>> {
    if (user.storeAccessAll) {
      const all = await this.storeRepo.find({ select: ['id'] });
      return new Set(all.map((s) => s.id));
    }

    const assignments = await this.assignmentRepo.find({
      where: { userId: user.id },
      select: ['storeId'],
    });
    return new Set(assignments.map((a) => a.storeId));
  }

  /**
   * Get store IDs the user can access at the given minimum level.
   */
  async getStoreIdsAtLevel(user: User, minLevel: StoreAccessLevel): Promise<Set<string>> {
    if (user.storeAccessAll) {
      const all = await this.storeRepo.find({ select: ['id'] });
      return new Set(all.map((s) => s.id));
    }

    const levelRank: Record<StoreAccessLevel, number> = { view: 0, operate: 1, admin: 2 };
    const minRank = levelRank[minLevel];

    const assignments = await this.assignmentRepo.find({
      where: { userId: user.id },
    });
    return new Set(
      assignments.filter((a) => levelRank[a.accessLevel] >= minRank).map((a) => a.storeId),
    );
  }

  /**
   * Check if a user has access to a specific store at the given minimum level.
   * Throws ForbiddenException if not.
   */
  async assertStoreAccess(user: User, storeId: string, minLevel: StoreAccessLevel = 'view'): Promise<void> {
    if (user.storeAccessAll) return;

    const assignment = await this.assignmentRepo.findOne({
      where: { userId: user.id, storeId },
    });
    if (!assignment) {
      throw new ForbiddenException(`You do not have access to store ${storeId}`);
    }

    const levelRank: Record<StoreAccessLevel, number> = { view: 0, operate: 1, admin: 2 };
    if (levelRank[assignment.accessLevel] < levelRank[minLevel]) {
      throw new ForbiddenException(
        `Insufficient access level for store ${storeId}. Required: ${minLevel}, have: ${assignment.accessLevel}`,
      );
    }
  }

  /**
   * Get all assignments for a user (admin use).
   */
  async getUserAssignments(userId: string): Promise<UserStoreAssignment[]> {
    return this.assignmentRepo.find({
      where: { userId },
      relations: ['store'],
    });
  }

  /**
   * Assign or update a user's access to a store.
   */
  async setAssignment(userId: string, storeId: string, accessLevel: StoreAccessLevel): Promise<UserStoreAssignment> {
    const existing = await this.assignmentRepo.findOne({
      where: { userId, storeId },
    });
    if (existing) {
      existing.accessLevel = accessLevel;
      return this.assignmentRepo.save(existing);
    }
    return this.assignmentRepo.save(
      this.assignmentRepo.create({ userId, storeId, accessLevel }),
    );
  }

  /**
   * Remove a user's assignment to a store.
   */
  async removeAssignment(userId: string, storeId: string): Promise<void> {
    await this.assignmentRepo.delete({ userId, storeId });
  }

  /**
   * Build a WHERE clause fragment for store-filtered listing queries.
   * Returns an array of store IDs to filter by, or undefined (meaning "all").
   * An empty array means the user has scoped access but no store assignments —
   * they may still view catalog listings not tied to any store.
   */
  async resolveStoreFilter(user: User | undefined): Promise<string[] | undefined> {
    if (!user || user.storeAccessAll) return undefined;
    const storeIds = await this.getAccessibleStoreIds(user);
    if (storeIds.size === 0) return [];
    return [...storeIds];
  }

  /** Listings with no channel instance (catalog imports, etc.). */
  static readonly UNSCOPED_LISTINGS_SQL =
    `r.id NOT IN (SELECT lci.listing_id FROM listing_channel_instances lci)`;

  /** Listings in the user's stores plus unscoped catalog listings. */
  static readonly SCOPED_LISTINGS_SQL =
    `(r.id IN (SELECT lci.listing_id FROM listing_channel_instances lci WHERE lci.store_id IN (:...storeIds))
      OR r.id NOT IN (SELECT lci.listing_id FROM listing_channel_instances lci))`;

  /**
   * Set the storeAccessAll flag for a user.
   */
  async setAccessAll(userId: string, value: boolean): Promise<void> {
    await this.storeRepo.manager
      .createQueryBuilder()
      .update(User)
      .set({ storeAccessAll: value } as any)
      .where('id = :id', { id: userId })
      .execute();
  }
}
