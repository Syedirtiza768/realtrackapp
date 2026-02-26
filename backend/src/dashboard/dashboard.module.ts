import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuditLog } from './entities/audit-log.entity.js';
import { DashboardCache } from './entities/dashboard-cache.entity.js';
import { SalesRecord } from './entities/sales-record.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardController, AuditLogController } from './dashboard.controller.js';
import { AggregationProcessor } from './processors/aggregation.processor.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, DashboardCache, SalesRecord, ListingRecord]),
    BullModule.registerQueue({ name: 'dashboard' }),
  ],
  controllers: [DashboardController, AuditLogController],
  providers: [DashboardService, AggregationProcessor],
  exports: [DashboardService],
})
export class DashboardModule {}
