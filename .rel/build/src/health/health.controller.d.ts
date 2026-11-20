import { HealthCheckService, MemoryHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { QueueHealthService } from '../common/queues/queue-health.service.js';
import { RuntimeHealthService } from '../common/observability/runtime-health.service.js';
export declare class HealthController {
    private health;
    private db;
    private memory;
    private queueHealth;
    private runtimeHealth;
    constructor(health: HealthCheckService, db: TypeOrmHealthIndicator, memory: MemoryHealthIndicator, queueHealth: QueueHealthService, runtimeHealth: RuntimeHealthService);
    check(): Promise<import("@nestjs/terminus").HealthCheckResult<import("@nestjs/terminus").HealthIndicatorResult<string, import("@nestjs/terminus").HealthIndicatorStatus, Record<string, any>> & import("@nestjs/terminus").HealthIndicatorResult<"memory_heap"> & import("@nestjs/terminus").HealthIndicatorResult<"database">, Partial<import("@nestjs/terminus").HealthIndicatorResult<string, import("@nestjs/terminus").HealthIndicatorStatus, Record<string, any>> & import("@nestjs/terminus").HealthIndicatorResult<"memory_heap"> & import("@nestjs/terminus").HealthIndicatorResult<"database">> | undefined, Partial<import("@nestjs/terminus").HealthIndicatorResult<string, import("@nestjs/terminus").HealthIndicatorStatus, Record<string, any>> & import("@nestjs/terminus").HealthIndicatorResult<"memory_heap"> & import("@nestjs/terminus").HealthIndicatorResult<"database">> | undefined>>;
    queueSnapshot(): Promise<{
        queues: import("../common/queues/queue-health.service.js").QueueHealthSnapshot;
        totals: {
            waiting: number;
            active: number;
            delayed: number;
            failed: number;
        };
        generatedAt: string;
    }>;
    runtime(): import("../common/observability/runtime-health.service.js").RuntimeHealthSnapshot;
}
