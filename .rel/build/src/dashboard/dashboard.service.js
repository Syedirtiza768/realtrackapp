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
var DashboardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_log_entity_js_1 = require("./entities/audit-log.entity.js");
const dashboard_cache_entity_js_1 = require("./entities/dashboard-cache.entity.js");
const sales_record_entity_js_1 = require("./entities/sales-record.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
let DashboardService = DashboardService_1 = class DashboardService {
    auditRepo;
    cacheRepo;
    salesRepo;
    listingRepo;
    logger = new common_1.Logger(DashboardService_1.name);
    constructor(auditRepo, cacheRepo, salesRepo, listingRepo) {
        this.auditRepo = auditRepo;
        this.cacheRepo = cacheRepo;
        this.salesRepo = salesRepo;
        this.listingRepo = listingRepo;
    }
    async getCache(key, maxAgeMs = 60_000) {
        const row = await this.cacheRepo.findOne({ where: { metricKey: key } });
        if (!row)
            return null;
        const age = Date.now() - new Date(row.computedAt).getTime();
        if (age > maxAgeMs)
            return null;
        return row.metricValue;
    }
    async setCache(key, value) {
        const existing = await this.cacheRepo.findOne({
            where: { metricKey: key },
        });
        if (existing) {
            existing.metricValue = value;
            await this.cacheRepo.save(existing);
        }
        else {
            const row = this.cacheRepo.create({ metricKey: key, metricValue: value });
            await this.cacheRepo.save(row);
        }
    }
    async getSummary(storeId) {
        const cacheKey = storeId
            ? `dashboard:summary:${storeId}`
            : 'dashboard:summary';
        const cached = await this.getCache(cacheKey);
        if (cached)
            return cached;
        const salesQb = this.salesRepo
            .createQueryBuilder('s')
            .select('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(s.salePrice), 0)', 'revenue')
            .addSelect('COALESCE(AVG(s.salePrice), 0)', 'avgPrice')
            .where('s.soldAt >= :since', {
            since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        });
        if (storeId)
            salesQb.andWhere('s.store_id = :storeId', { storeId });
        const channelQb = this.salesRepo
            .createQueryBuilder('s')
            .select('s.channel', 'channel')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(s.salePrice), 0)', 'revenue')
            .groupBy('s.channel');
        if (storeId)
            channelQb.andWhere('s.store_id = :storeId', { storeId });
        const [totalListings, activeListings, salesData, channelData] = await Promise.all([
            this.listingRepo.count({ where: { deletedAt: (0, typeorm_2.IsNull)() } }),
            this.listingRepo.count({
                where: { status: 'published', deletedAt: (0, typeorm_2.IsNull)() },
            }),
            salesQb.getRawOne(),
            channelQb.getRawMany(),
        ]);
        const result = {
            totalListings,
            activeListings,
            totalSales: Number(salesData?.count ?? 0),
            revenue: Number(salesData?.revenue ?? 0),
            avgPrice: Number(salesData?.avgPrice ?? 0),
            channelBreakdown: channelData,
            computedAt: new Date().toISOString(),
        };
        await this.setCache(cacheKey, result);
        return result;
    }
    async getSales(dto) {
        const since = dto.since
            ? new Date(dto.since)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const until = dto.until ? new Date(dto.until) : new Date();
        const storeId = dto.storeId;
        const dayQb = this.salesRepo
            .createQueryBuilder('s')
            .select("DATE_TRUNC('day', s.soldAt)", 'day')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(s.salePrice), 0)', 'revenue')
            .where('s.soldAt >= :since AND s.soldAt <= :until', { since, until })
            .groupBy("DATE_TRUNC('day', s.soldAt)")
            .orderBy("DATE_TRUNC('day', s.soldAt)", 'ASC');
        if (storeId)
            dayQb.andWhere('s.store_id = :storeId', { storeId });
        const channelQb = this.salesRepo
            .createQueryBuilder('s')
            .select('s.channel', 'channel')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(s.salePrice), 0)', 'revenue')
            .where('s.soldAt >= :since AND s.soldAt <= :until', { since, until })
            .groupBy('s.channel');
        if (storeId)
            channelQb.andWhere('s.store_id = :storeId', { storeId });
        const topQb = this.salesRepo
            .createQueryBuilder('s')
            .select('s.listingId', 'listingId')
            .addSelect('COUNT(*)', 'salesCount')
            .addSelect('COALESCE(SUM(s.salePrice), 0)', 'totalRevenue')
            .where('s.soldAt >= :since AND s.soldAt <= :until', { since, until })
            .groupBy('s.listingId')
            .orderBy('COALESCE(SUM(s.salePrice), 0)', 'DESC')
            .limit(dto.topN ?? 10);
        if (storeId)
            topQb.andWhere('s.store_id = :storeId', { storeId });
        const [salesByDay, salesByChannel, topItems] = await Promise.all([
            dayQb.getRawMany(),
            channelQb.getRawMany(),
            topQb.getRawMany(),
        ]);
        return { salesByDay, salesByChannel, topItems };
    }
    async getActivity(dto) {
        const qb = this.auditRepo.createQueryBuilder('a');
        if (dto.entityType)
            qb.andWhere('a.entityType = :et', { et: dto.entityType });
        if (dto.entityId)
            qb.andWhere('a.entityId = :eid', { eid: dto.entityId });
        if (dto.action)
            qb.andWhere('a.action = :act', { act: dto.action });
        if (dto.actorId)
            qb.andWhere('a.actorId = :aid', { aid: dto.actorId });
        if (dto.since)
            qb.andWhere('a.createdAt >= :since', { since: new Date(dto.since) });
        const limit = dto.limit ?? 50;
        const offset = dto.offset ?? 0;
        const [items, total] = await qb
            .orderBy('a.createdAt', 'DESC')
            .skip(offset)
            .take(limit)
            .getManyAndCount();
        return { items, total, limit, offset };
    }
    async getChannelHealth() {
        try {
            const [hasConnections, hasChannelListings] = await Promise.all([
                this.tableExists('channel_connections'),
                this.tableExists('channel_listings'),
            ]);
            if (!hasConnections) {
                this.logger.warn('channel_connections table not found; returning empty channel health payload');
                return { channels: [] };
            }
            if (hasChannelListings) {
                const rows = await this.listingRepo.manager.query(`
          SELECT
            cc.channel,
            cc.status,
            cc.last_sync_at AS "lastSync",
            cc.last_error AS "lastError",
            COALESCE(cl.cnt, 0) AS "listingCount",
            COALESCE(cl.err_cnt, 0) AS "errorCount"
          FROM channel_connections cc
          LEFT JOIN LATERAL (
            SELECT
              COUNT(*) AS cnt,
              COUNT(*) FILTER (WHERE cl2.sync_status = 'error') AS err_cnt
            FROM channel_listings cl2
            WHERE cl2.connection_id = cc.id
          ) cl ON true
          WHERE cc.status != 'revoked'
          ORDER BY cc.channel
        `);
                return { channels: rows };
            }
            const rows = await this.listingRepo.manager.query(`
        SELECT
          cc.channel,
          cc.status,
          cc.last_sync_at AS "lastSync",
          cc.last_error AS "lastError",
          0::bigint AS "listingCount",
          0::bigint AS "errorCount"
        FROM channel_connections cc
        WHERE cc.status != 'revoked'
        ORDER BY cc.channel
      `);
            return { channels: rows };
        }
        catch (error) {
            this.logger.error(`Failed to compute channel health: ${error instanceof Error ? error.message : String(error)}`);
            return { channels: [] };
        }
    }
    async tableExists(tableName) {
        const result = await this.listingRepo.manager.query(`SELECT to_regclass($1) AS exists`, [tableName]);
        return Boolean(result?.[0]?.exists);
    }
    async getKpis() {
        const cached = await this.getCache('dashboard:kpis', 300_000);
        if (cached)
            return cached;
        const [catalogSize, publishedCount, soldCount, avgDaysToSell] = await Promise.all([
            this.listingRepo.count({ where: { deletedAt: (0, typeorm_2.IsNull)() } }),
            this.listingRepo.count({
                where: { status: 'published', deletedAt: (0, typeorm_2.IsNull)() },
            }),
            this.salesRepo.count(),
            this.salesRepo.manager
                .query(`
          SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (sr."soldAt" - lr."updatedAt")) / 86400), 0) AS "avgDays"
          FROM sales_records sr
          JOIN listing_records lr ON lr.id = sr."listingId"
          WHERE sr."soldAt" >= NOW() - INTERVAL '90 days'
        `)
                .then((r) => Number(r[0]?.avgDays ?? 0)),
        ]);
        const result = {
            catalogSize,
            publishedCount,
            soldCount,
            avgDaysToSell: Math.round(avgDaysToSell * 10) / 10,
            computedAt: new Date().toISOString(),
        };
        await this.setCache('dashboard:kpis', result);
        return result;
    }
    async getInventoryAlerts() {
        const rows = await this.listingRepo.manager.query(`
      SELECT
        il.listing_id AS "listingId",
        lr.title,
        lr."customLabelSku" AS "sku",
        il.quantity_total AS "total",
        il.quantity_reserved AS "reserved",
        (il.quantity_total - il.quantity_reserved) AS "available",
        il.low_stock_threshold AS "threshold"
      FROM inventory_ledger il
      JOIN listing_records lr ON lr.id = il.listing_id AND lr."deletedAt" IS NULL
      ORDER BY (il.quantity_total - il.quantity_reserved) ASC
      LIMIT 100
    `);
        const lowStock = rows.filter((r) => Number(r.available) > 0 && Number(r.available) <= Number(r.threshold));
        const outOfStock = rows.filter((r) => Number(r.available) <= 0);
        return { lowStock, outOfStock };
    }
    async writeAuditLog(data) {
        const log = this.auditRepo.create({
            entityType: data.entityType,
            entityId: data.entityId,
            action: data.action,
            actorId: data.actorId ?? null,
            actorType: data.actorType ?? 'system',
            changes: data.changes ?? null,
            metadata: data.metadata ?? {},
            ipAddress: data.ipAddress ?? null,
        });
        return this.auditRepo.save(log);
    }
    async getMultiStoreMetrics() {
        const cached = await this.getCache('dashboard:multi-store', 120_000);
        if (cached)
            return cached;
        const [storeData, instanceData, aiData, demoData] = await Promise.all([
            this.listingRepo.manager
                .query(`
        SELECT
          s.channel,
          COUNT(DISTINCT s.id) AS "storeCount",
          SUM(s.listing_count) AS "totalListings",
          COUNT(DISTINCT s.connection_id) AS "connectionCount"
        FROM stores s
        WHERE s.status = 'active'
        GROUP BY s.channel
        ORDER BY s.channel
      `)
                .catch(() => []),
            this.listingRepo.manager
                .query(`
        SELECT
          lci.channel,
          lci.sync_status AS "syncStatus",
          COUNT(*) AS "count",
          COUNT(DISTINCT lci.listing_id) AS "uniqueListings",
          COUNT(DISTINCT lci.store_id) AS "uniqueStores"
        FROM listing_channel_instances lci
        GROUP BY lci.channel, lci.sync_status
        ORDER BY lci.channel, lci.sync_status
      `)
                .catch(() => []),
            this.listingRepo.manager
                .query(`
        SELECT
          ae.enhancement_type AS "type",
          ae.status,
          COUNT(*) AS "count",
          AVG(ae.confidence_score) AS "avgConfidence",
          SUM(ae.tokens_used) AS "totalTokens"
        FROM ai_enhancements ae
        GROUP BY ae.enhancement_type, ae.status
        ORDER BY ae.enhancement_type, ae.status
      `)
                .catch(() => []),
            this.listingRepo.manager
                .query(`
        SELECT
          d.operation_type AS "operationType",
          d.channel,
          COUNT(*) AS "count",
          AVG(d.simulated_latency_ms) AS "avgLatency",
          SUM(CASE WHEN d.simulated_success THEN 1 ELSE 0 END) AS "successCount"
        FROM demo_simulation_logs d
        GROUP BY d.operation_type, d.channel
        ORDER BY d.operation_type, d.channel
      `)
                .catch(() => []),
        ]);
        const result = {
            stores: storeData,
            instances: instanceData,
            aiEnhancements: aiData,
            demoSimulations: demoData,
            computedAt: new Date().toISOString(),
        };
        await this.setCache('dashboard:multi-store', result);
        return result;
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = DashboardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(audit_log_entity_js_1.AuditLog)),
    __param(1, (0, typeorm_1.InjectRepository)(dashboard_cache_entity_js_1.DashboardCache)),
    __param(2, (0, typeorm_1.InjectRepository)(sales_record_entity_js_1.SalesRecord)),
    __param(3, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map