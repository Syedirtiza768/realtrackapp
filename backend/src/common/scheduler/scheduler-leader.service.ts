import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { APP_REDIS } from '../redis/app-redis.constants.js';

const LOCK_PREFIX = 'scheduler:lock:';

/**
 * Redis-based leader election so only one backend instance runs @Cron producers
 * when horizontally scaled.
 */
@Injectable()
export class SchedulerLeaderService {
  private readonly logger = new Logger(SchedulerLeaderService.name);
  private readonly enabled: boolean;

  constructor(
    @Inject(APP_REDIS) private readonly redis: Redis,
    config: ConfigService,
  ) {
    const explicit = config.get<string>('SCHEDULER_LEADER_ENABLED');
    this.enabled =
      explicit === undefined || explicit === ''
        ? true
        : explicit === 'true' || explicit === '1';
  }

  /**
   * Run fn only if this instance acquires the distributed lock.
   * Returns true when fn ran, false when skipped (another leader or disabled path).
   */
  async runIfLeader(
    lockName: string,
    ttlSeconds: number,
    fn: () => Promise<void>,
  ): Promise<boolean> {
    if (!this.enabled) {
      await fn();
      return true;
    }

    const key = LOCK_PREFIX + lockName;
    const token = randomUUID();
    const acquired = await this.redis.set(key, token, 'EX', ttlSeconds, 'NX');
    if (acquired !== 'OK') {
      this.logger.debug(`Skipping scheduler job "${lockName}" — lock held elsewhere`);
      return false;
    }

    try {
      await fn();
      return true;
    } finally {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end`;
      await this.redis.eval(script, 1, key, token);
    }
  }
}
