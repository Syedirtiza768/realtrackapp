import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PropertyValueOption } from './ebay-mvl.service.js';
import type { ParsedFitmentRow } from './fitment-mvl.util.js';
import { EbayMvlEntry } from './entities/ebay-mvl-entry.entity.js';
import {
  EbayMvlRelease,
  type EbayMvlReleaseStatus,
} from './entities/ebay-mvl-release.entity.js';
import type { MvlMarketplace } from './ebay-mvl-marketplace.util.js';

@Injectable()
export class EbayMvlStoreService {
  private readonly logger = new Logger(EbayMvlStoreService.name);
  private readonly activeReleaseCache = new Map<MvlMarketplace, string | null>();

  constructor(
    @InjectRepository(EbayMvlRelease)
    private readonly releaseRepo: Repository<EbayMvlRelease>,
    @InjectRepository(EbayMvlEntry)
    private readonly entryRepo: Repository<EbayMvlEntry>,
  ) {}

  clearCache(marketplace?: MvlMarketplace): void {
    if (marketplace) {
      this.activeReleaseCache.delete(marketplace);
      return;
    }
    this.activeReleaseCache.clear();
  }

  async hasActiveRelease(marketplace: MvlMarketplace): Promise<boolean> {
    return Boolean(await this.getActiveReleaseId(marketplace));
  }

  async hasAnyActiveRelease(): Promise<boolean> {
    const count = await this.releaseRepo.count({
      where: { status: 'active' },
    });
    return count > 0;
  }

  async getActiveReleaseId(marketplace: MvlMarketplace): Promise<string | null> {
    if (this.activeReleaseCache.has(marketplace)) {
      return this.activeReleaseCache.get(marketplace) ?? null;
    }

    const release = await this.releaseRepo.findOne({
      where: { marketplace, status: 'active' },
      order: { importedAt: 'DESC' },
      select: ['id'],
    });
    const id = release?.id ?? null;
    this.activeReleaseCache.set(marketplace, id);
    return id;
  }

  async listReleases(marketplace?: MvlMarketplace): Promise<EbayMvlRelease[]> {
    return this.releaseRepo.find({
      where: marketplace ? { marketplace } : {},
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getStatusSummary(): Promise<
    Array<{
      marketplace: string;
      activeRelease: EbayMvlRelease | null;
      entryCount: number;
    }>
  > {
    const marketplaces: MvlMarketplace[] = ['US', 'AU', 'DE', 'GB'];
    const summary: Array<{
      marketplace: string;
      activeRelease: EbayMvlRelease | null;
      entryCount: number;
    }> = [];
    for (const marketplace of marketplaces) {
      const activeRelease = await this.releaseRepo.findOne({
        where: { marketplace, status: 'active' },
        order: { importedAt: 'DESC' },
      });
      summary.push({
        marketplace,
        activeRelease,
        entryCount: activeRelease?.entryCount ?? 0,
      });
    }
    return summary;
  }

  async getMakes(
    marketplace: MvlMarketplace,
    query?: string,
    limit = 100,
    offset = 0,
  ): Promise<{ options: PropertyValueOption[]; hasMore: boolean }> {
    const releaseId = await this.getActiveReleaseId(marketplace);
    if (!releaseId) return { options: [], hasMore: false };

    const qb = this.entryRepo
      .createQueryBuilder('e')
      .select('DISTINCT e.make', 'make')
      .where('e.release_id = :releaseId', { releaseId })
      .andWhere('e.marketplace = :marketplace', { marketplace });

    if (query?.trim()) {
      qb.andWhere('LOWER(e.make) LIKE :q', {
        q: `%${query.trim().toLowerCase()}%`,
      });
    }

    qb.orderBy('e.make', 'ASC');

    const rows = await qb.getRawMany<{ make: string }>();
    const options = rows.map((row) => ({
      label: row.make,
      value: row.make,
    }));
    const paginated = options.slice(offset, offset + limit);
    return {
      options: paginated,
      hasMore: offset + limit < options.length,
    };
  }

  async getModels(
    marketplace: MvlMarketplace,
    make: string,
    query?: string,
    limit = 100,
    offset = 0,
  ): Promise<{ options: PropertyValueOption[]; hasMore: boolean }> {
    const releaseId = await this.getActiveReleaseId(marketplace);
    if (!releaseId) return { options: [], hasMore: false };

    const qb = this.entryRepo
      .createQueryBuilder('e')
      .select('DISTINCT e.model', 'model')
      .where('e.release_id = :releaseId', { releaseId })
      .andWhere('e.marketplace = :marketplace', { marketplace })
      .andWhere('LOWER(e.make) = LOWER(:make)', { make });

    if (query?.trim()) {
      qb.andWhere('LOWER(e.model) LIKE :q', {
        q: `%${query.trim().toLowerCase()}%`,
      });
    }

    qb.orderBy('e.model', 'ASC');
    const rows = await qb.getRawMany<{ model: string }>();
    const options = rows.map((row) => ({
      label: row.model,
      value: row.model,
    }));
    const paginated = options.slice(offset, offset + limit);
    return {
      options: paginated,
      hasMore: offset + limit < options.length,
    };
  }

  async getYears(
    marketplace: MvlMarketplace,
    make: string,
    model: string,
  ): Promise<{ options: PropertyValueOption[]; hasMore: boolean }> {
    const releaseId = await this.getActiveReleaseId(marketplace);
    if (!releaseId) return { options: [], hasMore: false };

    const rows = await this.entryRepo
      .createQueryBuilder('e')
      .select('DISTINCT e.year', 'year')
      .where('e.release_id = :releaseId', { releaseId })
      .andWhere('e.marketplace = :marketplace', { marketplace })
      .andWhere('LOWER(e.make) = LOWER(:make)', { make })
      .andWhere('LOWER(e.model) = LOWER(:model)', { model })
      .orderBy('e.year', 'DESC')
      .getRawMany<{ year: number }>();

    const options = rows.map((row) => ({
      label: String(row.year),
      value: String(row.year),
    }));
    return { options, hasMore: false };
  }

  async getPropertyValues(
    marketplace: MvlMarketplace,
    propertyName: string,
    filters: Record<string, string> = {},
    query?: string,
    limit = 100,
    offset = 0,
  ): Promise<{ options: PropertyValueOption[]; hasMore: boolean }> {
    const prop = propertyName.toLowerCase();
    if (prop === 'make') {
      return this.getMakes(marketplace, query, limit, offset);
    }
    if (prop === 'model') {
      const make = filters.Make ?? filters.make;
      if (!make) return { options: [], hasMore: false };
      return this.getModels(marketplace, make, query, limit, offset);
    }
    if (prop === 'year') {
      const make = filters.Make ?? filters.make;
      const model = filters.Model ?? filters.model;
      if (!make || !model) return { options: [], hasMore: false };
      return this.getYears(marketplace, make, model);
    }
    return { options: [], hasMore: false };
  }

  async hasMake(marketplace: MvlMarketplace, make: string): Promise<boolean> {
    const releaseId = await this.getActiveReleaseId(marketplace);
    if (!releaseId) return false;
    const count = await this.entryRepo
      .createQueryBuilder('e')
      .where('e.release_id = :releaseId', { releaseId })
      .andWhere('e.marketplace = :marketplace', { marketplace })
      .andWhere('LOWER(e.make) = LOWER(:make)', { make })
      .limit(1)
      .getCount();
    return count > 0;
  }

  async hasModel(
    marketplace: MvlMarketplace,
    make: string,
    model: string,
  ): Promise<boolean> {
    const releaseId = await this.getActiveReleaseId(marketplace);
    if (!releaseId) return false;
    const count = await this.entryRepo
      .createQueryBuilder('e')
      .where('e.release_id = :releaseId', { releaseId })
      .andWhere('e.marketplace = :marketplace', { marketplace })
      .andWhere('LOWER(e.make) = LOWER(:make)', { make })
      .andWhere('LOWER(e.model) = LOWER(:model)', { model })
      .limit(1)
      .getCount();
    return count > 0;
  }

  async hasYear(
    marketplace: MvlMarketplace,
    make: string,
    model: string,
    year: string,
  ): Promise<boolean> {
    const releaseId = await this.getActiveReleaseId(marketplace);
    if (!releaseId) return false;
    const yearNum = parseInt(year, 10);
    if (!Number.isFinite(yearNum)) return false;
    const count = await this.entryRepo
      .createQueryBuilder('e')
      .where('e.release_id = :releaseId', { releaseId })
      .andWhere('e.marketplace = :marketplace', { marketplace })
      .andWhere('LOWER(e.make) = LOWER(:make)', { make })
      .andWhere('LOWER(e.model) = LOWER(:model)', { model })
      .andWhere('e.year = :year', { year: yearNum })
      .limit(1)
      .getCount();
    return count > 0;
  }

  async resolveCanonicalMakeModel(
    marketplace: MvlMarketplace,
    make: string,
    model?: string,
  ): Promise<{ make?: string; model?: string; mvlMatched: boolean }> {
    const makeQuery = make.trim();
    if (!makeQuery) return { mvlMatched: false };

    const makes = await this.getMakes(marketplace, makeQuery, 100, 0);
    const canonicalMake = this.pickCanonical(makes.options, makeQuery);
    if (!canonicalMake) return { mvlMatched: false };

    if (!model?.trim()) {
      return { make: canonicalMake, mvlMatched: true };
    }

    const models = await this.getModels(
      marketplace,
      canonicalMake,
      model.trim(),
      100,
      0,
    );
    const canonicalModel = this.pickCanonical(models.options, model.trim());
    return {
      make: canonicalMake,
      model: canonicalModel ?? model.trim(),
      mvlMatched: Boolean(canonicalModel),
    };
  }

  private pickCanonical(
    options: PropertyValueOption[],
    query: string,
  ): string | undefined {
    const q = query.toLowerCase();
    const exact = options.find((o) => o.value.toLowerCase() === q);
    if (exact) return exact.value;
    const prefix = options.find((o) => o.value.toLowerCase().startsWith(q));
    if (prefix) return prefix.value;
    const contains = options.find((o) => o.value.toLowerCase().includes(q));
    return contains?.value;
  }

  async markReleaseStatus(
    releaseId: string,
    status: EbayMvlReleaseStatus,
    patch?: Partial<Pick<EbayMvlRelease, 'entryCount' | 'errorMessage' | 'importedAt'>>,
  ): Promise<void> {
    await this.releaseRepo.update(releaseId, {
      status,
      ...patch,
    });
  }

  async supersedeActiveRelease(
    marketplace: MvlMarketplace,
    exceptReleaseId?: string,
  ): Promise<void> {
    const qb = this.releaseRepo
      .createQueryBuilder()
      .update(EbayMvlRelease)
      .set({ status: 'superseded' })
      .where('marketplace = :marketplace', { marketplace })
      .andWhere('status = :status', { status: 'active' });

    if (exceptReleaseId) {
      qb.andWhere('id != :exceptReleaseId', { exceptReleaseId });
    }

    const superseded = await qb.execute();
    if (superseded.affected) {
      this.logger.log(
        `Superseded ${superseded.affected} active MVL release(s) for ${marketplace}`,
      );
    }

  }

  async deleteEntriesForRelease(releaseId: string): Promise<void> {
    await this.entryRepo.delete({ releaseId });
  }
}
