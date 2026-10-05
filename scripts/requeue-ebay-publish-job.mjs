#!/usr/bin/env node

/**
 * Requeue only the recoverable failures from one eBay publish job.
 *
 * Dry-run:
 *   docker compose exec backend node /app/scripts/requeue-ebay-publish-job.mjs \
 *     --job-id=JOB_UUID
 * Add --target-id=TARGET_UUID to inspect or requeue only one failed target.
 *
 * Apply (after the duplicate backend consumer has been removed):
 *   docker compose exec backend node /app/scripts/requeue-ebay-publish-job.mjs \
 *     --job-id=JOB_UUID --apply --confirm-job-id=JOB_UUID
 *
 * The exact confirmation flag is deliberate. This utility never uses a broad
 * SKU/date selector and requeues only failures covered by the current publish
 * normalizers: legacy projection, invalid source image, invalid legacy
 * fitment, missing UPC, stale offers, or stale generic Engine category failures. Policy,
 * condition, and duplicate-listing failures remain excluded.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { Client } from 'pg';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const apply = process.argv.includes('--apply');

function readArg(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

function dbOptions() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return {
    host: process.env.DB_HOST || 'postgres',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'listingpro',
  };
}

function redisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST || 'redis';
  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD
    ? `:${encodeURIComponent(process.env.REDIS_PASSWORD)}@`
    : '';
  return `redis://${password}${host}:${port}`;
}

function failureText(row) {
  return [
    row.error_payload?.message,
    ...(Array.isArray(row.error_payload?.errors) ? row.error_payload.errors : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function recoveryClass(row) {
  const message = failureText(row);
  if (
    row.has_inventory_offer &&
    /stored inventory api sku .* does not match requested sku/.test(message)
  ) {
    return 'stored-inventory-sku-alias';
  }
  if (
    row.has_inventory_offer &&
    /revisefixedpriceitem failed \(291\).*not allowed to revise ended listings/.test(
      message,
    )
  ) {
    return 'ended-inventory-offer';
  }
  if (
    message.includes('21919474') ||
    message.includes('21919233') ||
    message.includes('inventory-based listing management is not currently supported')
  ) {
    return 'inventory-managed-legacy-projection';
  }
  if (message.includes('no valid image can be downloaded')) {
    return 'eps-invalid-source-image';
  }
  if (/all compatibilities are invalid|compatibilities are invalid/.test(message)) {
    return 'legacy-invalid-fitment';
  }
  if (message.includes('25713') || message.includes('this offer is not available')) {
    return 'stale-offer';
  }
  if (
    row.has_inventory_offer &&
    (message.includes('offer entity already exists') ||
      message.includes('published without a listing id'))
  ) {
    return 'stale-offer';
  }
  if (/upc field is missing|missing.*upc|upc.*missing/.test(message)) {
    return 'missing-upc';
  }
  if (
    message.includes('25019') ||
    message.includes('miscategor') ||
    message.includes('mo_lp_miscat')
  ) {
    return 'stale-engine-category';
  }
  if (
    /eBay picture services upload failed \((408|425|429|500|502|503|504)\)/i.test(
      message,
    ) ||
    /timeout|timed out|connection reset|socket hang up|upstream/.test(message)
  ) {
    return 'eps-transient';
  }
  return null;
}

async function main() {
  const jobId = readArg('job-id');
  const targetId = readArg('target-id');
  const confirmation = readArg('confirm-job-id');
  if (!jobId) throw new Error('--job-id=JOB_UUID is required');
  if (apply && confirmation !== jobId) {
    throw new Error(
      '--apply requires --confirm-job-id with the exact same UUID as --job-id',
    );
  }

  const client = new Client(dbOptions());
  await client.connect();

  try {
    const job = await client.query(
      `SELECT id, organization_id, job_type, status, created_at
       FROM ebay_listing_jobs
       WHERE id = $1`,
      [jobId],
    );
    if (!job.rows[0]) throw new Error(`Publish job not found: ${jobId}`);
    if (job.rows[0].job_type !== 'publish') {
      throw new Error(`Job ${jobId} is not a publish job`);
    }

    const failed = await client.query(
      `SELECT
         t.id AS target_id,
         t.listing_job_id,
         t.ebay_account_id,
         t.marketplace_id,
         t.error_payload,
         cp.sku,
         s.store_name,
         EXISTS (
           SELECT 1
           FROM ebay_listing_channels ch
           WHERE ch.catalog_product_id = t.catalog_product_id
             AND ch.ebay_account_id = t.ebay_account_id
             AND ch.marketplace_id = t.marketplace_id
             AND ch.offer_id IS NOT NULL
             AND ch.ebay_inventory_sku IS NOT NULL
         ) AS has_inventory_offer
       FROM ebay_listing_job_targets t
       LEFT JOIN catalog_products cp ON cp.id = t.catalog_product_id
       LEFT JOIN connected_ebay_accounts a ON a.id = t.ebay_account_id
       LEFT JOIN stores s ON s.id = a.primary_store_id
       WHERE t.listing_job_id = $1
         AND t.status = 'failed'
         AND ($2::uuid IS NULL OR t.id = $2)
       ORDER BY t.id`,
      [jobId, targetId ?? null],
    );

    if (targetId && failed.rowCount !== 1) {
      throw new Error(`No failed target ${targetId} exists in job ${jobId}`);
    }

    const retryable = failed.rows
      .map((row) => ({ ...row, recovery_class: recoveryClass(row) }))
      .filter((row) => row.recovery_class);
    const excluded = failed.rows.filter((row) => !recoveryClass(row));
    const counts = {};
    for (const row of retryable) {
      counts[row.recovery_class] = (counts[row.recovery_class] || 0) + 1;
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply-and-requeue' : 'dry-run',
          job: job.rows[0],
          targetId: targetId ?? null,
          failedTargetCount: failed.rowCount,
          retryableTargetCount: retryable.length,
          retryableByClass: counts,
          excludedPermanentOrUnknownCount: excluded.length,
          retryableSample: retryable.slice(0, 10).map((row) => ({
            targetId: row.target_id,
            sku: row.sku,
            store: row.store_name,
            recoveryClass: row.recovery_class,
          })),
        },
        null,
        2,
      ),
    );

    if (!apply || retryable.length === 0) return;

    const targetIds = retryable.map((row) => row.target_id);
    const backup = {
      createdAt: new Date().toISOString(),
      jobId,
      job: job.rows[0],
      targets: retryable,
    };
    const backupDir = process.env.REQUEUE_BACKUP_DIR || '/app/output';
    await mkdir(backupDir, { recursive: true });
    const backupPath = `${backupDir}/ebay-publish-requeue-${jobId}-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.json`;
    await writeFile(backupPath, JSON.stringify(backup, null, 2));

    await client.query('BEGIN');
    try {
      await client.query(
        `UPDATE ebay_listing_job_targets
         SET status = 'pending', error_payload = NULL
         WHERE listing_job_id = $1
           AND id = ANY($2::uuid[])
           AND status = 'failed'`,
        [jobId, targetIds],
      );
      await client.query(
        `UPDATE ebay_listing_jobs
         SET status = 'processing'
         WHERE id = $1`,
        [jobId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const connection = new IORedis(redisUrl(), { maxRetriesPerRequest: null });
    const queue = new Queue('ebay-listing-publish', { connection });
    await queue.addBulk(
      retryable.map((row) => ({
        name: 'publish-target',
        data: { targetId: row.target_id },
        opts: {
          attempts: 4,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: 500,
          removeOnFail: 500,
        },
      })),
    );
    await queue.close();
    await connection.quit();

    console.log(
      JSON.stringify(
        {
          jobId,
          requeuedTargets: retryable.length,
          excludedPermanentOrUnknownCount: excluded.length,
          backupPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
