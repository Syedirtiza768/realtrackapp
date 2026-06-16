import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

export const MONITORED_QUEUE_NAMES = [
  'ingestion',
  'pipeline',
  'catalog-import',
  'openai',
  'channels',
  'inventory',
  'orders',
  'dashboard',
  'storage-cleanup',
  'storage-thumbnails',
  'fitment',
  'motors-pipeline',
  'listing-optimization',
  'ebay-listing-publish',
  'ebay-order-sync',
  'ebay-inventory-sync',
] as const;

export type QueueHealthSnapshot = Record<
  string,
  {
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    completed: number;
  }
>;

@Injectable()
export class QueueHealthService implements OnModuleDestroy {
  private readonly queues: Queue[] = [];

  constructor(private readonly config: ConfigService) {
    const connection = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: Number(this.config.get<string>('REDIS_PORT', '6379')),
      password: this.config.get<string>('REDIS_PASSWORD', '') || undefined,
    };
    for (const name of MONITORED_QUEUE_NAMES) {
      this.queues.push(new Queue(name, { connection }));
    }
  }

  async getSnapshot(): Promise<QueueHealthSnapshot> {
    const snapshot: QueueHealthSnapshot = {};
    await Promise.all(
      this.queues.map(async (queue) => {
        const [waiting, active, delayed, failed, completed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getDelayedCount(),
          queue.getFailedCount(),
          queue.getCompletedCount(),
        ]);
        snapshot[queue.name] = { waiting, active, delayed, failed, completed };
      }),
    );
    return snapshot;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.queues.map((q) => q.close()));
  }
}
