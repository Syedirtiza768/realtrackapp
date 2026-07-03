import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerLeaderService } from './scheduler-leader.service.js';
import { SchedulerService } from './scheduler.service.js';
import { PricingIntelligenceModule } from '../../pricing-intelligence/pricing-intelligence.module.js';
import { SellerpunditModule } from '../../integrations/sellerpundit/sellerpundit.module.js';
import { EbayIntegrationsModule } from '../../integrations/ebay/ebay-integrations.module.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';

/**
 * SchedulerModule — Centralized cron-based job scheduling.
 * 
 * Registers BullMQ queue references needed by the scheduler
 * and provides the SchedulerService which uses @Cron decorators
 * to enqueue jobs at defined intervals.
 * 
 * Phase 5: also imports PricingIntelligenceModule for the 4h competitor
 * price collection cron.
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'storage-cleanup' },
      { name: 'inventory' },
      { name: 'orders' },
      { name: 'dashboard' },
      { name: 'channels' },
    ),
    TypeOrmModule.forFeature([ConnectedEbayAccount]),
    PricingIntelligenceModule,
    SellerpunditModule,
    EbayIntegrationsModule,
  ],
  providers: [SchedulerLeaderService, SchedulerService],
  exports: [SchedulerLeaderService],
})
export class SchedulerModule {}
