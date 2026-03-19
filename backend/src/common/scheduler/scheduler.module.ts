import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SchedulerService } from './scheduler.service.js';
import { PricingIntelligenceModule } from '../../pricing-intelligence/pricing-intelligence.module.js';

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
    PricingIntelligenceModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
