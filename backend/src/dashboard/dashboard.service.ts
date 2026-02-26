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
        .addSelect('COALESCE(SUM(s.sale_price), 0)', 'revenue')
        .addSelect('COALESCE(AVG(s.sale_price), 0)', 'avgPrice')
        .where('s.sold_at >= :since', {
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        })
        .getRawOne(),
      this.salesRepo
        .createQueryBuilder('s')
        .select('s.channel', 'channel')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(s.sale_price), 0)', 'revenue')
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
        .select("DATE_TRUNC('day', s.sold_at)", 'day')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(s.sale_price), 0)', 'revenue')
        .where('s.sold_at >= :since AND s.sold_at <= :until', { since, until })
        .groupBy("DATE_TRUNC('day', s.sold_at)")
        .orderBy("DATE_TRUNC('day', s.sold_at)", 'ASC')
        .getRawMany(),

      this.salesRepo
        .createQueryBuilder('s')
        .select('s.channel', 'channel')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(s.sale_price), 0)', 'revenue')
        .where('s.sold_at >= :since AND s.sold_at <= :until', { since, until })
        .groupBy('s.channel')
        .getRawMany(),

      this.salesRepo
        .createQueryBuilder('s')
        .select('s.listing_id', 'listingId')
        .addSelect('COUNT(*)', 'salesCount')
        .addSelect('COALESCE(SUM(s.sale_price), 0)', 'totalRevenue')
        .where('s.sold_at >= :since AND s.sold_at <= :until', { since, until })
        .groupBy('s.listing_id')
        .orderBy('COALESCE(SUM(s.sale_price), 0)', 'DESC')
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
          SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (sr.sold_at - lr.updated_at)) / 86400), 0) AS "avgDays"
          FROM sales_records sr
          JOIN listing_records lr ON lr.id = sr.listing_id
          WHERE sr.sold_at >= NOW() - INTERVAL '90 days'
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
        lr.custom_label_sku AS "sku",
        il.quantity_total AS "total",
        il.quantity_reserved AS "reserved",
        (il.quantity_total - il.quantity_reserved) AS "available",
        il.low_stock_threshold AS "threshold"
      FROM inventory_ledger il
      JOIN listing_records lr ON lr.id = il.listing_id AND lr.deleted_at IS NULL
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
}
