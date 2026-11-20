import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity.js';
import { DashboardCache } from './entities/dashboard-cache.entity.js';
import { SalesRecord } from './entities/sales-record.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import type { AuditLogQueryDto, SalesQueryDto } from './dto/dashboard.dto.js';
export declare class DashboardService {
    private readonly auditRepo;
    private readonly cacheRepo;
    private readonly salesRepo;
    private readonly listingRepo;
    private readonly logger;
    constructor(auditRepo: Repository<AuditLog>, cacheRepo: Repository<DashboardCache>, salesRepo: Repository<SalesRecord>, listingRepo: Repository<ListingRecord>);
    private getCache;
    private setCache;
    getSummary(storeId?: string): Promise<Record<string, unknown> | {
        totalListings: number;
        activeListings: number;
        totalSales: number;
        revenue: number;
        avgPrice: number;
        channelBreakdown: any[];
        computedAt: string;
    }>;
    getSales(dto: SalesQueryDto): Promise<{
        salesByDay: any[];
        salesByChannel: any[];
        topItems: any[];
    }>;
    getActivity(dto: AuditLogQueryDto): Promise<{
        items: AuditLog[];
        total: number;
        limit: number;
        offset: number;
    }>;
    getChannelHealth(): Promise<{
        channels: any;
    }>;
    private tableExists;
    getKpis(): Promise<Record<string, unknown> | {
        catalogSize: number;
        publishedCount: number;
        soldCount: number;
        avgDaysToSell: number;
        computedAt: string;
    }>;
    getInventoryAlerts(): Promise<{
        lowStock: any;
        outOfStock: any;
    }>;
    writeAuditLog(data: {
        entityType: string;
        entityId: string;
        action: string;
        actorId?: string;
        actorType?: string;
        changes?: Record<string, {
            old: unknown;
            new: unknown;
        }>;
        metadata?: Record<string, unknown>;
        ipAddress?: string;
    }): Promise<AuditLog>;
    getMultiStoreMetrics(): Promise<Record<string, unknown> | {
        stores: any;
        instances: any;
        aiEnhancements: any;
        demoSimulations: any;
        computedAt: string;
    }>;
}
