import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SchedulerService } from './scheduler.service.js';

/**
 * SchedulerModule — Centralized cron-based job scheduling.
 * 
 * Registers BullMQ queue references needed by the scheduler
 * and provides the SchedulerService which uses @Cron decorators
 * to enqueue jobs at defined intervals.
 * 
 * This module resolves the issue where multiple queue processors
 * existed but had no producers to enqueue jobs.
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'storage-cleanup' },
      { name: 'inventory' },
      { name: 'orders' },
      { name: 'dashboard' },
    ),
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
