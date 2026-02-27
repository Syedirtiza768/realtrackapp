import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity.js';
import { DashboardCache } from './entities/dashboard-cache.entity.js';
import { SalesRecord } from './entities/sales-record.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import type { AuditLogQueryDto, SalesQueryDto } from './dto/dashboard.dto.js';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(DashboardCache)
    private readonly cacheRepo: Repository<DashboardCache>,
    @InjectRepository(SalesRecord)
    private readonly salesRepo: Repository<SalesRecord>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
  ) {}

  /* ─── Cache helpers ─── */

  private async getCache<T>(key: string, maxAgeMs = 60_000): Promise<T | null> {
    const row = await this.cacheRepo.findOne({ where: { metricKey: key } });
    if (!row) return null;
    const age = Date.now() - new Date(row.computedAt).getTime();
    if (age > maxAgeMs) return null;
    return row.metricValue as T;
  }

  private async setCache(key: string, value: Record<string, unknown>): Promise<void> {
    const existing = await this.cacheRepo.findOne({ where: { metricKey: key } });
    if (existing) {
      existing.metricValue = value;
      await this.cacheRepo.save(existing);
    } else {
      const row = this.cacheRepo.create({ metricKey: key, metricValue: value });
      await this.cacheRepo.save(row);
    }
  }

  /* ─── Dashboard Summary ─── */

  async getSummary() {
    const cached = await this.getCache<Record<string, unknown>>('dashboard:summary');
    if (cached) return cached;

    const [totalListings, activeListings, salesData, channelData] = await Promise.all([
      this.listingRepo.count({ where: { deletedAt: IsNull() } }),
      this.listingRepo.count({ where: { status: 'published', deletedAt: IsNull() } }),
      this.salesRepo
        .createQueryBuilder('s')
        .select('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(s.salePrice), 0)', 'revenue')
        .addSelect('COALESCE(AVG(s.salePrice), 0)', 'avgPrice')
        .where('s.soldAt >= :since', {
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        })
        .getRawOne(),
      this.salesRepo
        .createQueryBuilder('s')
        .select('s.channel', 'channel')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(s.salePrice), 0)', 'revenue')
        .groupBy('s.channel')
        .getRawMany(),
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

    await this.setCache('dashboard:summary', result);
    return result;
  }

  /* ─── Sales ─── */

  async getSales(dto: SalesQueryDto) {
    const since = dto.since
      ? new Date(dto.since)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const until = dto.until ? new Date(dto.until) : new Date();

    const [salesByDay, salesByChannel, topItems] = await Promise.all([
      this.salesRepo
        .createQueryBuilder('s')
        .select("DATE_TRUNC('day', s.soldAt)", 'day')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(s.salePrice), 0)', 'revenue')
        .where('s.soldAt >= :since AND s.soldAt <= :until', { since, until })
        .groupBy("DATE_TRUNC('day', s.soldAt)")
        .orderBy("DATE_TRUNC('day', s.soldAt)", 'ASC')
        .getRawMany(),

      this.salesRepo
        .createQueryBuilder('s')
        .select('s.channel', 'channel')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(s.salePrice), 0)', 'revenue')
        .where('s.soldAt >= :since AND s.soldAt <= :until', { since, until })
        .groupBy('s.channel')
        .getRawMany(),

      this.salesRepo
        .createQueryBuilder('s')
        .select('s.listingId', 'listingId')
        .addSelect('COUNT(*)', 'salesCount')
        .addSelect('COALESCE(SUM(s.salePrice), 0)', 'totalRevenue')
        .where('s.soldAt >= :since AND s.soldAt <= :until', { since, until })
        .groupBy('s.listingId')
        .orderBy('COALESCE(SUM(s.salePrice), 0)', 'DESC')
        .limit(dto.topN ?? 10)
        .getRawMany(),
    ]);

    return { salesByDay, salesByChannel, topItems };
  }

  /* ─── Activity (Audit Logs) ─── */

  async getActivity(dto: AuditLogQueryDto) {
    const qb = this.auditRepo.createQueryBuilder('a');

    if (dto.entityType) qb.andWhere('a.entityType = :et', { et: dto.entityType });
    if (dto.entityId) qb.andWhere('a.entityId = :eid', { eid: dto.entityId });
    if (dto.action) qb.andWhere('a.action = :act', { act: dto.action });
    if (dto.actorId) qb.andWhere('a.actorId = :aid', { aid: dto.actorId });
    if (dto.since) qb.andWhere('a.createdAt >= :since', { since: new Date(dto.since) });

    const limit = dto.limit ?? 50;
    const offset = dto.offset ?? 0;

    const [items, total] = await qb
      .orderBy('a.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { items, total, limit, offset };
  }

  /* ─── Channel Health ─── */

  async getChannelHealth() {
    // Aggregate from channel_connections and channel_listings
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

  /* ─── KPIs ─── */

  async getKpis() {
    const cached = await this.getCache<Record<string, unknown>>('dashboard:kpis', 300_000);
    if (cached) return cached;

    const [catalogSize, publishedCount, soldCount, avgDaysToSell] = await Promise.all([
      this.listingRepo.count({ where: { deletedAt: IsNull() } }),
      this.listingRepo.count({ where: { status: 'published', deletedAt: IsNull() } }),
      this.salesRepo.count(),
      this.salesRepo.manager
        .query(`
          SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (sr."soldAt" - lr."updatedAt")) / 86400), 0) AS "avgDays"
          FROM sales_records sr
          JOIN listing_records lr ON lr.id = sr."listingId"
          WHERE sr."soldAt" >= NOW() - INTERVAL '90 days'
        `)
        .then((r: Array<{ avgDays: string }>) => Number(r[0]?.avgDays ?? 0)),
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

  /* ─── Inventory Alerts ─── */

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

    const lowStock = rows.filter(
      (r: Record<string, unknown>) =>
        Number(r.available) > 0 && Number(r.available) <= Number(r.threshold),
    );
    const outOfStock = rows.filter(
      (r: Record<string, unknown>) => Number(r.available) <= 0,
    );

    return { lowStock, outOfStock };
  }

  /* ─── Audit Log Writer (used by other modules) ─── */

  async writeAuditLog(data: {
    entityType: string;
    entityId: string;
    action: string;
    actorId?: string;
    actorType?: string;
    changes?: Record<string, { old: unknown; new: unknown }>;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<AuditLog> {
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

  /* ─── Multi-Store & AI Metrics ─── */

  async getMultiStoreMetrics() {
    const cached = await this.getCache<Record<string, unknown>>('dashboard:multi-store', 120_000);
    if (cached) return cached;

    const [storeData, instanceData, aiData, demoData] = await Promise.all([
      // Stores by channel
      this.listingRepo.manager.query(`
        SELECT
          s.channel,
          COUNT(DISTINCT s.id) AS "storeCount",
          SUM(s.listing_count) AS "totalListings",
          COUNT(DISTINCT s.connection_id) AS "connectionCount"
        FROM stores s
        WHERE s.status = 'active'
        GROUP BY s.channel
        ORDER BY s.channel
      `).catch(() => []),

      // Instance sync statuses
      this.listingRepo.manager.query(`
        SELECT
          lci.channel,
          lci.sync_status AS "syncStatus",
          COUNT(*) AS "count",
          COUNT(DISTINCT lci.listing_id) AS "uniqueListings",
          COUNT(DISTINCT lci.store_id) AS "uniqueStores"
        FROM listing_channel_instances lci
        GROUP BY lci.channel, lci.sync_status
        ORDER BY lci.channel, lci.sync_status
      `).catch(() => []),

      // AI enhancement stats
      this.listingRepo.manager.query(`
        SELECT
          ae.enhancement_type AS "type",
          ae.status,
          COUNT(*) AS "count",
          AVG(ae.confidence_score) AS "avgConfidence",
          SUM(ae.tokens_used) AS "totalTokens"
        FROM ai_enhancements ae
        GROUP BY ae.enhancement_type, ae.status
        ORDER BY ae.enhancement_type, ae.status
      `).catch(() => []),

      // Demo simulation summary
      this.listingRepo.manager.query(`
        SELECT
          d.operation_type AS "operationType",
          d.channel,
          COUNT(*) AS "count",
          AVG(d.simulated_latency_ms) AS "avgLatency",
          SUM(CASE WHEN d.simulated_success THEN 1 ELSE 0 END) AS "successCount"
        FROM demo_simulation_logs d
        GROUP BY d.operation_type, d.channel
        ORDER BY d.operation_type, d.channel
      `).catch(() => []),
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
}
