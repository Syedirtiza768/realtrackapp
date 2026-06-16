import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { QueueHealthService } from '../common/queues/queue-health.service.js';
import { RuntimeHealthService } from '../common/observability/runtime-health.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private queueHealth: QueueHealthService,
    private runtimeHealth: RuntimeHealthService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300 MB
    ]);
  }

  @Get('queues')
  @RequirePermissions('users.view')
  async queueSnapshot() {
    const queues = await this.queueHealth.getSnapshot();
    const totals = Object.values(queues).reduce(
      (acc, q) => ({
        waiting: acc.waiting + q.waiting,
        active: acc.active + q.active,
        delayed: acc.delayed + q.delayed,
        failed: acc.failed + q.failed,
      }),
      { waiting: 0, active: 0, delayed: 0, failed: 0 },
    );
    return { queues, totals, generatedAt: new Date().toISOString() };
  }

  @Public()
  @Get('runtime')
  runtime() {
    return this.runtimeHealth.getSnapshot();
  }
}
