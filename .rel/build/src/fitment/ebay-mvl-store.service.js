"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EbayMvlStoreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayMvlStoreService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fitment_mvl_util_js_1 = require("./fitment-mvl.util.js");
const ebay_mvl_entry_entity_js_1 = require("./entities/ebay-mvl-entry.entity.js");
const ebay_mvl_release_entity_js_1 = require("./entities/ebay-mvl-release.entity.js");
let EbayMvlStoreService = EbayMvlStoreService_1 = class EbayMvlStoreService {
    releaseRepo;
    entryRepo;
    logger = new common_1.Logger(EbayMvlStoreService_1.name);
    activeReleaseCache = new Map();
    constructor(releaseRepo, entryRepo) {
        this.releaseRepo = releaseRepo;
        this.entryRepo = entryRepo;
    }
    clearCache(marketplace) {
        if (marketplace) {
            this.activeReleaseCache.delete(marketplace);
            return;
        }
        this.activeReleaseCache.clear();
    }
    async hasActiveRelease(marketplace) {
        return Boolean(await this.getActiveReleaseId(marketplace));
    }
    async hasAnyActiveRelease() {
        const count = await this.releaseRepo.count({
            where: { status: 'active' },
        });
        return count > 0;
    }
    async getActiveReleaseId(marketplace) {
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
    async listReleases(marketplace) {
        return this.releaseRepo.find({
            where: marketplace ? { marketplace } : {},
            order: { createdAt: 'DESC' },
            take: 50,
        });
    }
    async getStatusSummary() {
        const marketplaces = ['US', 'AU', 'DE', 'GB'];
        const summary = [];
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
    async getMakes(marketplace, query, limit = 100, offset = 0) {
        const releaseId = await this.getActiveReleaseId(marketplace);
        if (!releaseId)
            return { options: [], hasMore: false };
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
        const rows = await qb.getRawMany();
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
    async getModels(marketplace, make, query, limit = 100, offset = 0) {
        const releaseId = await this.getActiveReleaseId(marketplace);
        if (!releaseId)
            return { options: [], hasMore: false };
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
        const rows = await qb.getRawMany();
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
    async getYears(marketplace, make, model) {
        const releaseId = await this.getActiveReleaseId(marketplace);
        if (!releaseId)
            return { options: [], hasMore: false };
        const rows = await this.entryRepo
            .createQueryBuilder('e')
            .select('DISTINCT e.year', 'year')
            .where('e.release_id = :releaseId', { releaseId })
            .andWhere('e.marketplace = :marketplace', { marketplace })
            .andWhere('LOWER(e.make) = LOWER(:make)', { make })
            .andWhere('LOWER(e.model) = LOWER(:model)', { model })
            .orderBy('e.year', 'DESC')
            .getRawMany();
        const options = rows.map((row) => ({
            label: String(row.year),
            value: String(row.year),
        }));
        return { options, hasMore: false };
    }
    async getPropertyValues(marketplace, propertyName, filters = {}, query, limit = 100, offset = 0) {
        const prop = propertyName.toLowerCase();
        if (prop === 'make') {
            return this.getMakes(marketplace, query, limit, offset);
        }
        if (prop === 'model') {
            const make = filters.Make ?? filters.make;
            if (!make)
                return { options: [], hasMore: false };
            return this.getModels(marketplace, make, query, limit, offset);
        }
        if (prop === 'year') {
            const make = filters.Make ?? filters.make;
            const model = filters.Model ?? filters.model;
            if (!make || !model)
                return { options: [], hasMore: false };
            return this.getYears(marketplace, make, model);
        }
        return { options: [], hasMore: false };
    }
    async hasMake(marketplace, make) {
        const releaseId = await this.getActiveReleaseId(marketplace);
        if (!releaseId)
            return false;
        const count = await this.entryRepo
            .createQueryBuilder('e')
            .where('e.release_id = :releaseId', { releaseId })
            .andWhere('e.marketplace = :marketplace', { marketplace })
            .andWhere('LOWER(e.make) = LOWER(:make)', { make })
            .limit(1)
            .getCount();
        return count > 0;
    }
    async hasModel(marketplace, make, model) {
        const releaseId = await this.getActiveReleaseId(marketplace);
        if (!releaseId)
            return false;
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
    async hasYear(marketplace, make, model, year) {
        const releaseId = await this.getActiveReleaseId(marketplace);
        if (!releaseId)
            return false;
        const yearNum = parseInt(year, 10);
        if (!Number.isFinite(yearNum))
            return false;
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
    async batchExistingMakes(marketplace, makes) {
        const releaseId = await this.getActiveReleaseId(marketplace);
        if (!releaseId)
            return new Set();
        const normalized = [
            ...new Set(makes.map((m) => m.trim().toLowerCase()).filter((m) => m.length > 0)),
        ];
        if (normalized.length === 0)
            return new Set();
        const existing = new Set();
        const CHUNK = 1000;
        for (let i = 0; i < normalized.length; i += CHUNK) {
            const batch = normalized.slice(i, i + CHUNK);
            const rows = await this.entryRepo
                .createQueryBuilder('e')
                .select('DISTINCT LOWER(e.make)', 'make')
                .where('e.release_id = :releaseId', { releaseId })
                .andWhere('e.marketplace = :marketplace', { marketplace })
                .andWhere('LOWER(e.make) IN (:...makes)', { makes: batch })
                .getRawMany();
            for (const row of rows)
                existing.add(row.make);
        }
        return existing;
    }
    async batchExistingModels(marketplace, pairs) {
        const releaseId = await this.getActiveReleaseId(marketplace);
        if (!releaseId || pairs.length === 0)
            return new Set();
        const deduped = new Map();
        for (const p of pairs) {
            const make = p.make.trim();
            const model = p.model.trim();
            if (!make || !model)
                continue;
            const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
            if (!deduped.has(key))
                deduped.set(key, { make, model });
        }
        if (deduped.size === 0)
            return new Set();
        const existing = new Set();
        const unique = [...deduped.values()];
        const CHUNK = 500;
        for (let i = 0; i < unique.length; i += CHUNK) {
            const batch = unique.slice(i, i + CHUNK);
            const makes = [...new Set(batch.map((b) => b.make.toLowerCase()))];
            const models = [...new Set(batch.map((b) => b.model.toLowerCase()))];
            const rows = await this.entryRepo
                .createQueryBuilder('e')
                .distinct(true)
                .select('LOWER(e.make)', 'make')
                .addSelect('LOWER(e.model)', 'model')
                .where('e.release_id = :releaseId', { releaseId })
                .andWhere('e.marketplace = :marketplace', { marketplace })
                .andWhere('LOWER(e.make) IN (:...makes)', { makes })
                .andWhere('LOWER(e.model) IN (:...models)', { models })
                .getRawMany();
            for (const row of rows) {
                existing.add(`${row.make}|${row.model}`);
            }
        }
        return existing;
    }
    async batchExistingYears(marketplace, triples) {
        const releaseId = await this.getActiveReleaseId(marketplace);
        if (!releaseId || triples.length === 0)
            return new Set();
        const deduped = new Map();
        for (const t of triples) {
            const make = t.make.trim();
            const model = t.model.trim();
            const yearNum = parseInt(t.year, 10);
            if (!make || !model || !Number.isFinite(yearNum))
                continue;
            const key = `${make.toLowerCase()}|${model.toLowerCase()}|${yearNum}`;
            if (!deduped.has(key))
                deduped.set(key, { make, model, year: yearNum });
        }
        if (deduped.size === 0)
            return new Set();
        const existing = new Set();
        const unique = [...deduped.values()];
        const CHUNK = 300;
        for (let i = 0; i < unique.length; i += CHUNK) {
            const batch = unique.slice(i, i + CHUNK);
            const makes = [...new Set(batch.map((b) => b.make.toLowerCase()))];
            const models = [...new Set(batch.map((b) => b.model.toLowerCase()))];
            const years = [...new Set(batch.map((b) => b.year))];
            const rows = await this.entryRepo
                .createQueryBuilder('e')
                .distinct(true)
                .select('LOWER(e.make)', 'make')
                .addSelect('LOWER(e.model)', 'model')
                .addSelect('e.year', 'year')
                .where('e.release_id = :releaseId', { releaseId })
                .andWhere('e.marketplace = :marketplace', { marketplace })
                .andWhere('LOWER(e.make) IN (:...makes)', { makes })
                .andWhere('LOWER(e.model) IN (:...models)', { models })
                .andWhere('e.year IN (:...years)', { years })
                .getRawMany();
            for (const row of rows) {
                existing.add(`${row.make}|${row.model}|${row.year}`);
            }
        }
        return existing;
    }
    async resolveCanonicalMakeModel(marketplace, make, model) {
        const makeQuery = make.trim();
        if (!makeQuery)
            return { mvlMatched: false };
        const makes = await this.getMakes(marketplace, makeQuery, 100, 0);
        const canonicalMake = this.pickCanonical(makes.options, makeQuery);
        if (!canonicalMake)
            return { mvlMatched: false };
        if (!model?.trim()) {
            return { make: canonicalMake, mvlMatched: true };
        }
        const models = await this.getModels(marketplace, canonicalMake, model.trim(), 100, 0);
        const canonicalModel = this.pickCanonical(models.options, model.trim());
        return {
            make: canonicalMake,
            model: canonicalModel ?? model.trim(),
            mvlMatched: Boolean(canonicalModel),
        };
    }
    async queryYearsInRange(marketplace, make, model, yearStart, yearEnd) {
        const releaseId = await this.getActiveReleaseId(marketplace);
        if (!releaseId)
            return [];
        const rows = await this.entryRepo
            .createQueryBuilder('e')
            .select('DISTINCT e.year', 'year')
            .where('e.release_id = :releaseId', { releaseId })
            .andWhere('e.marketplace = :marketplace', { marketplace })
            .andWhere('LOWER(e.make) = LOWER(:make)', { make })
            .andWhere('LOWER(e.model) = LOWER(:model)', { model })
            .andWhere('e.year BETWEEN :yearStart AND :yearEnd', {
            yearStart,
            yearEnd,
        })
            .orderBy('e.year', 'ASC')
            .getRawMany();
        return rows.map((r) => Number(r.year)).filter((y) => Number.isFinite(y));
    }
    async queryModelsInYearRange(marketplace, make, yearStart, yearEnd) {
        const releaseId = await this.getActiveReleaseId(marketplace);
        if (!releaseId)
            return [];
        const rows = await this.entryRepo
            .createQueryBuilder('e')
            .select('e.model', 'model')
            .addSelect('MIN(e.year)', 'minYear')
            .addSelect('MAX(e.year)', 'maxYear')
            .where('e.release_id = :releaseId', { releaseId })
            .andWhere('e.marketplace = :marketplace', { marketplace })
            .andWhere('LOWER(e.make) = LOWER(:make)', { make })
            .andWhere('e.year BETWEEN :yearStart AND :yearEnd', {
            yearStart,
            yearEnd,
        })
            .groupBy('e.model')
            .orderBy('e.model', 'ASC')
            .getRawMany();
        return rows.map((r) => ({
            model: r.model,
            minYear: Number(r.minYear),
            maxYear: Number(r.maxYear),
        }));
    }
    async queryModelsByPlatform(marketplace, make, platform) {
        const releaseId = await this.getActiveReleaseId(marketplace);
        if (!releaseId || !platform.trim())
            return [];
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
            .getRawMany();
        return rows.map((r) => ({
            model: r.model,
            minYear: Number(r.minYear),
            maxYear: Number(r.maxYear),
        }));
    }
    async filterRowsAgainstMvl(marketplace, rows) {
        const releaseId = await this.getActiveReleaseId(marketplace);
        if (!releaseId || rows.length === 0) {
            return { accepted: rows, rejectedCount: 0, usedDb: false };
        }
        const accepted = [];
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
            }
            else {
                rejectedCount++;
            }
        }
        return { accepted, rejectedCount, usedDb: true };
    }
    pickCanonical(options, query) {
        return (0, fitment_mvl_util_js_1.pickCanonicalPropertyValue)(options, query);
    }
    async markReleaseStatus(releaseId, status, patch) {
        await this.releaseRepo.update(releaseId, {
            status,
            ...patch,
        });
    }
    async supersedeActiveRelease(marketplace, exceptReleaseId) {
        const qb = this.releaseRepo
            .createQueryBuilder()
            .update(ebay_mvl_release_entity_js_1.EbayMvlRelease)
            .set({ status: 'superseded' })
            .where('marketplace = :marketplace', { marketplace })
            .andWhere('status = :status', { status: 'active' });
        if (exceptReleaseId) {
            qb.andWhere('id != :exceptReleaseId', { exceptReleaseId });
        }
        const superseded = await qb.execute();
        if (superseded.affected) {
            this.logger.log(`Superseded ${superseded.affected} active MVL release(s) for ${marketplace}`);
        }
    }
    async deleteEntriesForRelease(releaseId) {
        await this.entryRepo.delete({ releaseId });
    }
};
exports.EbayMvlStoreService = EbayMvlStoreService;
exports.EbayMvlStoreService = EbayMvlStoreService = EbayMvlStoreService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_mvl_release_entity_js_1.EbayMvlRelease)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_mvl_entry_entity_js_1.EbayMvlEntry)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], EbayMvlStoreService);
//# sourceMappingURL=ebay-mvl-store.service.js.map