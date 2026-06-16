import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { APP_REDIS } from '../redis/app-redis.constants.js';
import { SchedulerLeaderService } from './scheduler-leader.service.js';

function createRedisMock(): Redis & { set: jest.Mock; eval: jest.Mock } {
  return {
    set: jest.fn(),
    eval: jest.fn(),
  } as unknown as Redis & { set: jest.Mock; eval: jest.Mock };
}

async function createService(
  redis: ReturnType<typeof createRedisMock>,
  leaderEnabled = 'true',
): Promise<SchedulerLeaderService> {
  const module = await Test.createTestingModule({
    providers: [
      SchedulerLeaderService,
      {
        provide: APP_REDIS,
        useValue: redis,
      },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => (key === 'SCHEDULER_LEADER_ENABLED' ? leaderEnabled : undefined),
        },
      },
    ],
  }).compile();
  return module.get(SchedulerLeaderService);
}

describe('SchedulerLeaderService', () => {
  it('runs fn immediately when leader election is disabled', async () => {
    const redis = createRedisMock();
    const service = await createService(redis, 'false');
    const fn = jest.fn().mockResolvedValue(undefined);

    const ran = await service.runIfLeader('test-job', 60, fn);

    expect(ran).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('runs fn when lock is acquired', async () => {
    const redis = createRedisMock();
    redis.set.mockResolvedValue('OK');
    redis.eval.mockResolvedValue(1);
    const service = await createService(redis);
    const fn = jest.fn().mockResolvedValue(undefined);

    const ran = await service.runIfLeader('test-job', 60, fn);

    expect(ran).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      'scheduler:lock:test-job',
      expect.any(String),
      'EX',
      60,
      'NX',
    );
    expect(redis.eval).toHaveBeenCalled();
  });

  it('skips fn when another instance holds the lock', async () => {
    const redis = createRedisMock();
    redis.set.mockResolvedValue(null);
    const service = await createService(redis);
    const fn = jest.fn().mockResolvedValue(undefined);

    const ran = await service.runIfLeader('test-job', 60, fn);

    expect(ran).toBe(false);
    expect(fn).not.toHaveBeenCalled();
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('releases lock after fn completes', async () => {
    const redis = createRedisMock();
    redis.set.mockResolvedValue('OK');
    redis.eval.mockResolvedValue(1);
    const service = await createService(redis);
    const fn = jest.fn().mockResolvedValue(undefined);

    await service.runIfLeader('test-job', 60, fn);

    expect(redis.eval).toHaveBeenCalledWith(expect.any(String), 1, 'scheduler:lock:test-job', expect.any(String));
  });
});
