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

  /**
   * Batch existence check for makes. Returns the set of lowercased makes that
   * exist in the active MVL release. Semantically equivalent to calling
   * hasMake() for each input but in a single query per chunk.
   */
  async batchExistingMakes(
    marketplace: MvlMarketplace,
    makes: string[],
  ): Promise<Set<string>> {
    const releaseId = await this.getActiveReleaseId(marketplace);
    if (!releaseId) return new Set();

    const normalized = [
      ...new Set(
        makes
          .map((m) => m.trim().toLowerCase())
          .filter((m) => m.length > 0),
      ),
    ];
    if (normalized.length === 0) return new Set();

    const existing = new Set<string>();
    const CHUNK = 1000;
    for (let i = 0; i < normalized.length; i += CHUNK) {
      const batch = normalized.slice(i, i + CHUNK);
      const rows = await this.entryRepo
        .createQueryBuilder('e')
        .select('DISTINCT LOWER(e.make)', 'make')
        .where('e.release_id = :releaseId', { releaseId })
        .andWhere('e.marketplace = :marketplace', { marketplace })
        .andWhere('LOWER(e.make) IN (:...makes)', { makes: batch })
        .getRawMany<{ make: string }>();
      for (const row of rows) existing.add(row.make);
    }
    return existing;
  }

  /**
   * Batch existence check for (make, model) pairs. Returns the set of
   * "lower(make)|lower(model)" keys that exist in the active MVL release.
   * Uses double-IN filtering then in-memory exact-pair matching to stay
   * correct (avoids cross-product false positives).
   */
  async batchExistingModels(
    marketplace: MvlMarketplace,
    pairs: Array<{ make: string; model: string }>,
  ): Promise<Set<string>> {
    const releaseId = await this.getActiveReleaseId(marketplace);
    if (!releaseId || pairs.length === 0) return new Set();

    const deduped = new Map<string, { make: string; model: string }>();
    for (const p of pairs) {
      const make = p.make.trim();
      const model = p.model.trim();
      if (!make || !model) continue;
      const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
      if (!deduped.has(key)) deduped.set(key, { make, model });
    }
    if (deduped.size === 0) return new Set();

    const existing = new Set<string>();
    const unique = [...deduped.values()];
    const CHUNK = 500;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const batch = unique.slice(i, i + CHUNK);
      const makes = [...new Set(batch.map((b) => b.make.toLowerCase()))];
      const models = [...new Set(batch.map((b) => b.model.toLowerCase()))];
      const rows = await this.entryRepo
        .createQueryBuilder('e')
        .select(['DISTINCT LOWER(e.make)', 'LOWER(e.model)'])
        .where('e.release_id = :releaseId', { releaseId })
        .andWhere('e.marketplace = :marketplace', { marketplace })
        .andWhere('LOWER(e.make) IN (:...makes)', { makes })
        .andWhere('LOWER(e.model) IN (:...models)', { models })
        .getRawMany<{ make: string; model: string }>();
      for (const row of rows) {
        existing.add(`${row.make}|${row.model}`);
      }
    }
    return existing;
  }

  /**
   * Batch existence check for (make, model, year) triples. Returns the set of
   * "lower(make)|lower(model)|yearNum" keys that exist in the active MVL release.
   */
  async batchExistingYears(
    marketplace: MvlMarketplace,
    triples: Array<{ make: string; model: string; year: string }>,
  ): Promise<Set<string>> {
    const releaseId = await this.getActiveReleaseId(marketplace);
    if (!releaseId || triples.length === 0) return new Set();

    const deduped = new Map<string, { make: string; model: string; year: number }>();
    for (const t of triples) {
      const make = t.make.trim();
      const model = t.model.trim();
      const yearNum = parseInt(t.year, 10);
      if (!make || !model || !Number.isFinite(yearNum)) continue;
      const key = `${make.toLowerCase()}|${model.toLowerCase()}|${yearNum}`;
      if (!deduped.has(key)) deduped.set(key, { make, model, year: yearNum });
    }
    if (deduped.size === 0) return new Set();

    const existing = new Set<string>();
    const unique = [...deduped.values()];
    const CHUNK = 300;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const batch = unique.slice(i, i + CHUNK);
      const makes = [...new Set(batch.map((b) => b.make.toLowerCase()))];
      const models = [...new Set(batch.map((b) => b.model.toLowerCase()))];
      const years = [...new Set(batch.map((b) => b.year))];
      const rows = await this.entryRepo
        .createQueryBuilder('e')
        .select(['DISTINCT LOWER(e.make)', 'LOWER(e.model)', 'e.year'])
        .where('e.release_id = :releaseId', { releaseId })
        .andWhere('e.marketplace = :marketplace', { marketplace })
        .andWhere('LOWER(e.make) IN (:...makes)', { makes })
        .andWhere('LOWER(e.model) IN (:...models)', { models })
        .andWhere('e.year IN (:...years)', { years })
        .getRawMany<{ make: string; model: string; year: number }>();
      for (const row of rows) {
        existing.add(`${row.make}|${row.model}|${row.year}`);
      }
    }
    return existing;
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

  async queryYearsInRange(
    marketplace: MvlMarketplace,
    make: string,
    model: string,
    yearStart: number,
    yearEnd: number,
  ): Promise<number[]> {
    const releaseId = await this.getActiveReleaseId(marketplace);
    if (!releaseId) return [];

    const rows = await this.entryRepo
      .createQueryBuilder('e')
      .select('DISTINCT e.year', 'year')
      .where('e.release_id = :releaseId', { releaseId })
      .andWhere('e.marketplace = :marketplace', { marketplace })
      .andWhere('LOWER(e.make) = LOWER(:make)', { make })
      .andWhere('LOWER(e.model) = LOWER(:model)', { model })
      .andWhere('e.year BETWEEN :yearStart AND :yearEnd', { yearStart, yearEnd })
      .orderBy('e.year', 'ASC')
      .getRawMany<{ year: number }>();

    return rows.map((r) => Number(r.year)).filter((y) => Number.isFinite(y));
  }

  async queryModelsInYearRange(
    marketplace: MvlMarketplace,
    make: string,
    yearStart: number,
    yearEnd: number,
  ): Promise<Array<{ model: string; minYear: number; maxYear: number }>> {
    const releaseId = await this.getActiveReleaseId(marketplace);
    if (!releaseId) return [];

    const rows = await this.entryRepo
      .createQueryBuilder('e')
      .select('e.model', 'model')
      .addSelect('MIN(e.year)', 'minYear')
      .addSelect('MAX(e.year)', 'maxYear')
      .where('e.release_id = :releaseId', { releaseId })
      .andWhere('e.marketplace = :marketplace', { marketplace })
      .andWhere('LOWER(e.make) = LOWER(:make)', { make })
      .andWhere('e.year BETWEEN :yearStart AND :yearEnd', { yearStart, yearEnd })
      .groupBy('e.model')
      .orderBy('e.model', 'ASC')
      .getRawMany<{ model: string; minYear: string; maxYear: string }>();

    return rows.map((r) => ({
      model: r.model,
      minYear: Number(r.minYear),
      maxYear: Number(r.maxYear),
    }));
  }

  async queryModelsByPlatform(
    marketplace: MvlMarketplace,
    make: string,
    platform: string,
  ): Promise<Array<{ model: string; minYear: number; maxYear: number }>> {
    const releaseId = await this.getActiveReleaseId(marketplace);
    if (!releaseId || !platform.trim()) return [];

    const rows = await this.entryRepo
      .createQueryBuilder('e')
      .select('e.model', 'model')
      .addSelect('MIN(e.year)', 'minYear')
      .addSelect('MAX(e.year)', 'maxYear')
      .where('e.release_id = :releaseId', { releaseId })
      .andWhere('e.marketplace = :marketplace', { marketplace })
      .andWhere('LOWER(e.make) = LOWER(:make)', { make })
      .andWhere('LOWER(e.platform) = LOWER(:platform)', { platform })
      .groupBy('e.model')
      .orderBy('e.model', 'ASC')
      .getRawMany<{ model: string; minYear: string; maxYear: string }>();

    return rows.map((r) => ({
      model: r.model,
      minYear: Number(r.minYear),
      maxYear: Number(r.maxYear),
    }));
  }

  async filterRowsAgainstMvl(
    marketplace: MvlMarketplace,
    rows: Array<{
      year: string;
      make: string;
      model: string;
      trim?: string;
      engine?: string;
      submodel?: string;
      bodyType?: string;
      notes?: string;
      source: string;
      mvlSource?: string;
    }>,
  ): Promise<{
    accepted: typeof rows;
    rejectedCount: number;
    usedDb: boolean;
  }> {
    const releaseId = await this.getActiveReleaseId(marketplace);
    if (!releaseId || rows.length === 0) {
      return { accepted: rows, rejectedCount: 0, usedDb: false };
    }

    const accepted: typeof rows = [];
    let rejectedCount = 0;

    for (const row of rows) {
      const year = parseInt(row.year, 10);
      if (!row.make || !row.model || !Number.isFinite(year)) {
        rejectedCount++;
        continue;
      }
      const ok = await this.hasYear(marketplace, row.make, row.model, row.year);
      if (ok) {
        accepted.push({ ...row, mvlSource: 'database' });
      } else {
        rejectedCount++;
      }
    }

    return { accepted, rejectedCount, usedDb: true };
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
