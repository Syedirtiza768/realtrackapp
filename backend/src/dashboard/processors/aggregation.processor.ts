import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { DashboardService } from '../dashboard.service.js';
import { SalesRecord } from '../entities/sales-record.entity.js';
import { DashboardCache } from '../entities/dashboard-cache.entity.js';

@Processor('dashboard', { concurrency: 1 })
export class AggregationProcessor extends WorkerHost {
  private readonly logger = new Logger(AggregationProcessor.name);

  constructor(
    private readonly dashboardService: DashboardService,
    @InjectRepository(SalesRecord)
    private readonly salesRepo: Repository<SalesRecord>,
    @InjectRepository(DashboardCache)
    private readonly cacheRepo: Repository<DashboardCache>,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'recompute-summary':
        this.logger.log('Recomputing dashboard summary...');
        await this.dashboardService.getSummary();
        await this.dashboardService.getKpis();
        this.logger.log('Dashboard summary recomputed.');
        break;

      case 'daily-sales-rollup':
        await this.handleDailySalesRollup();
        break;

      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }

  /**
   * Aggregate yesterday's sales into a cached rollup row for fast dashboard reads.
   * Summarizes: total count, revenue, avg price, by-channel breakdown.
   */
  private async handleDailySalesRollup(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const dateKey = yesterday.toISOString().slice(0, 10); // YYYY-MM-DD
    this.logger.log(`Running daily sales rollup for ${dateKey}`);

    const rawStats = await this.salesRepo
      .createQueryBuilder('s')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(s.salePrice), 0)', 'revenue')
      .addSelect('COALESCE(AVG(s.salePrice), 0)', 'avgPrice')
      .where('s.soldAt BETWEEN :start AND :end', {
        start: yesterday,
        end: endOfYesterday,
      })
      .getRawOne();

    const byChannel = await this.salesRepo
      .createQueryBuilder('s')
      .select('s.channel', 'channel')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(s.salePrice), 0)', 'revenue')
      .where('s.soldAt BETWEEN :start AND :end', {
        start: yesterday,
        end: endOfYesterday,
      })
      .groupBy('s.channel')
      .getRawMany();

    const rollup = {
      date: dateKey,
      totalSales: Number(rawStats?.count ?? 0),
      revenue: Number(rawStats?.revenue ?? 0),
      avgPrice: Number(rawStats?.avgPrice ?? 0),
      byChannel,
      computedAt: new Date().toISOString(),
    };

    // Upsert into dashboard_cache
    const cacheKey = `daily-rollup:${dateKey}`;
    const existing = await this.cacheRepo.findOne({ where: { metricKey: cacheKey } });
    if (existing) {
      existing.metricValue = rollup;
      await this.cacheRepo.save(existing);
    } else {
      await this.cacheRepo.save(this.cacheRepo.create({ metricKey: cacheKey, metricValue: rollup }));
    }

    this.logger.log(
      `Daily sales rollup for ${dateKey}: ${rollup.totalSales} sales, $${rollup.revenue.toFixed(2)} revenue`,
    );
  }
}
