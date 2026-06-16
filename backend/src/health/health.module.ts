import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { QueueHealthModule } from '../common/queues/queue-health.module.js';
import { ObservabilityModule } from '../common/observability/observability.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, QueueHealthModule, ObservabilityModule, RbacModule],
  controllers: [HealthController],
})
export class HealthModule {}
