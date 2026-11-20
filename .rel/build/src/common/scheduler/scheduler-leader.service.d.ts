import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
export declare class SchedulerLeaderService {
    private readonly redis;
    private readonly logger;
    private readonly enabled;
    constructor(redis: Redis, config: ConfigService);
    runIfLeader(lockName: string, ttlSeconds: number, fn: () => Promise<void>): Promise<boolean>;
}
