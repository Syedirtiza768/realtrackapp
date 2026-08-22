/**
 * Queue every pending catalog fitment for durable MVL validation and, when
 * validated, synchronization to its published eBay channels.
 *
 * Dry run:
 *   node dist/src/scripts/queue-pending-fitment-publish.js
 * Apply:
 *   node dist/src/scripts/queue-pending-fitment-publish.js --apply
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const apply = hasFlag('apply');
  const limit = Number(option('limit') ?? '0');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const dataSource = app.get(DataSource);
    const queue = app.get<Queue>(getQueueToken('listing-optimization'));
    const rows = (await dataSource.query(
      `
        SELECT id, sku
          FROM catalog_products
         WHERE fitment_status = 'pending'
         ORDER BY id
      `,
    )) as Array<{ id: string; sku: string | null }>;
    const targets = limit > 0 ? rows.slice(0, limit) : rows;

    console.log(
      `${apply ? 'QUEUE' : 'DRY RUN'}: ${targets.length} pending fitment product(s) ` +
        `(query returned ${rows.length})`,
    );
    if (!apply) return;

    let queued = 0;
    let existing = 0;
    for (const target of targets) {
      const jobId = `pending-fitment-publish-v1-${target.id}`;
      const found = await queue.getJob(jobId);
      if (found) {
        existing += 1;
        continue;
      }
      await queue.add(
        'optimize-and-publish-fitment',
        {
          productId: target.id,
          marketplace: 'US',
          force: true,
          publishAfterOptimization: true,
        },
        {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 1000 },
        },
      );
      queued += 1;
    }
    console.log(`Queued ${queued}; already present ${existing}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
