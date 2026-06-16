import { Module } from '@nestjs/common';
import { QueueHealthService } from './queue-health.service.js';

@Module({
  providers: [QueueHealthService],
  exports: [QueueHealthService],
})
export class QueueHealthModule {}
