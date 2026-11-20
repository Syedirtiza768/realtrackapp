import { DashboardService } from './dashboard.service.js';
import { AuditLogQueryDto, SalesQueryDto } from './dto/dashboard.dto.js';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
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
        items: import("./entities/audit-log.entity.js").AuditLog[];
        total: number;
        limit: number;
        offset: number;
    }>;
    getChannelHealth(): Promise<{
        channels: any;
    }>;
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
    getMultiStoreMetrics(): Promise<Record<string, unknown> | {
        stores: any;
        instances: any;
        aiEnhancements: any;
        demoSimulations: any;
        computedAt: string;
    }>;
}
export declare class AuditLogController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getAuditLogs(dto: AuditLogQueryDto): Promise<{
        items: import("./entities/audit-log.entity.js").AuditLog[];
        total: number;
        limit: number;
        offset: number;
    }>;
}
