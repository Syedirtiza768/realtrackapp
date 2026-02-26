import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service.js';
import { AuditLogQueryDto, SalesQueryDto } from './dto/dashboard.dto.js';

@ApiTags('Dashboard')
@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get dashboard summary (cached)' })
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('sales')
  @ApiOperation({ summary: 'Get sales data (by day, by channel, top items)' })
  getSales(@Query() dto: SalesQueryDto) {
    return this.dashboardService.getSales(dto);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent activity from audit logs' })
  getActivity(@Query() dto: AuditLogQueryDto) {
    return this.dashboardService.getActivity(dto);
  }

  @Get('channel-health')
  @ApiOperation({ summary: 'Get channel sync health status' })
  getChannelHealth() {
    return this.dashboardService.getChannelHealth();
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Get key performance indicators' })
  getKpis() {
    return this.dashboardService.getKpis();
  }

  @Get('inventory-alerts')
  @ApiOperation({ summary: 'Get low stock and out of stock alerts' })
  getInventoryAlerts() {
    return this.dashboardService.getInventoryAlerts();
  }
}

@ApiTags('Audit Logs')
@Controller('api/audit-logs')
export class AuditLogController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Query audit logs' })
  getAuditLogs(@Query() dto: AuditLogQueryDto) {
    return this.dashboardService.getActivity(dto);
  }
}
