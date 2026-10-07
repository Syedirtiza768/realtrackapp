#!/usr/bin/env node

/**
 * Recover Trading API quota failures without replaying duplicate submissions.
 * Dry run: node /app/tools/requeue-ebay-518-failures.mjs --account-id=UUID
 * Canary:  add --canary --apply --confirm-account-id=UUID --confirm-count=1
 * Full run: add --apply --confirm-account-id=UUID --confirm-count=DRY_RUN_COUNT
 * Run only after eBay Developer Analytics reports available Trading calls.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Client } from 'pg';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=')[1];
const accountId = arg('account-id');
const sinceHours = Number(arg('since-hours') ?? 24);
const canary = process.argv.includes('--canary');
const apply = process.argv.includes('--apply');
const callReserve = 100;

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
  const password = process.env.REDIS_PASSWORD
    ? `:${encodeURIComponent(process.env.REDIS_PASSWORD)}@`
    : '';
  return `redis://${password}${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || '6379'}`;
}

async function availableTradingCalls() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Native eBay application credentials are unavailable');
  const identity = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!identity.ok) throw new Error(`eBay application token failed (${identity.status})`);
  const { access_token: token } = await identity.json();
  const analytics = await fetch(
    'https://api.ebay.com/developer/analytics/v1_beta/rate_limit/?api_name=tradingapi',
    {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!analytics.ok) throw new Error(`eBay Analytics failed (${analytics.status})`);
  const body = await analytics.json();
  const rate = body.rateLimits
    ?.flatMap((api) => api.resources ?? [])
    .find((resource) => resource.name === 'AddFixedPriceItem')
    ?.rates?.[0];
  if (!Number.isFinite(rate?.remaining) || !Number.isFinite(Date.parse(rate.reset))) {
    throw new Error('eBay Analytics did not return the Trading publish allowance');
  }
  return { remaining: rate.remaining, reset: rate.reset };
}

async function eligibleTargets(client) {
  const result = await client.query(
    `WITH quota_failures AS (
       SELECT t.*, ROW_NUMBER() OVER (
         PARTITION BY t.catalog_product_id,t.ebay_account_id,t.marketplace_id
         ORDER BY t.created_at DESC,t.id DESC
       ) AS rank
       FROM ebay_listing_job_targets t
       JOIN ebay_listing_jobs j ON j.id=t.listing_job_id
       WHERE t.ebay_account_id=$1
         AND j.job_type='publish'
         AND t.status='failed'
         AND t.updated_at >= NOW() - ($2::int * interval '1 hour')
         AND t.error_payload->>'message' LIKE '%AddFixedPriceItem failed (518)%'
     )
     SELECT q.id,q.listing_job_id,q.catalog_product_id,q.ebay_account_id,
            q.marketplace_id,q.created_at,q.error_payload
     FROM quota_failures q
     WHERE q.rank=1
       AND NOT EXISTS (
         SELECT 1 FROM ebay_listing_channels ch
         WHERE ch.catalog_product_id=q.catalog_product_id
           AND ch.ebay_account_id=q.ebay_account_id
           AND ch.marketplace_id=q.marketplace_id
           AND ch.listing_status='published' AND ch.listing_id IS NOT NULL
       )
       AND NOT EXISTS (
         SELECT 1 FROM ebay_listing_job_targets other
         WHERE other.id<>q.id
           AND other.catalog_product_id=q.catalog_product_id
           AND other.ebay_account_id=q.ebay_account_id
           AND other.marketplace_id=q.marketplace_id
           AND other.status IN ('pending','processing','success')
       )
     ORDER BY q.created_at DESC,q.id DESC`,
    [accountId, sinceHours],
  );
  return result.rows;
}

async function recheckAndMarkPending(client, target) {
  await client.query('BEGIN');
  try {
    const result = await client.query(
      `SELECT * FROM ebay_listing_job_targets WHERE id=$1 FOR UPDATE`,
      [target.id],
    );
    const current = result.rows[0];
    if (
      !current ||
      current.status !== 'failed' ||
      !String(current.error_payload?.message ?? '').includes('AddFixedPriceItem failed (518)')
    ) throw new Error(`Target ${target.id} changed before retry`);
    const duplicate = await client.query(
      `SELECT 1 FROM ebay_listing_channels ch
       WHERE ch.catalog_product_id=$1 AND ch.ebay_account_id=$2 AND ch.marketplace_id=$3
         AND ch.listing_status='published' AND ch.listing_id IS NOT NULL LIMIT 1`,
      [current.catalog_product_id, current.ebay_account_id, current.marketplace_id],
    );
    if (duplicate.rowCount) throw new Error(`Product ${current.catalog_product_id} is already published`);
    const concurrent = await client.query(
      `SELECT 1 FROM ebay_listing_job_targets t
       WHERE t.id<>$1 AND t.catalog_product_id=$2 AND t.ebay_account_id=$3
         AND t.marketplace_id=$4 AND t.status IN ('pending','processing','success') LIMIT 1`,
      [current.id, current.catalog_product_id, current.ebay_account_id, current.marketplace_id],
    );
    if (concurrent.rowCount) throw new Error(`Product ${current.catalog_product_id} has another active target`);
    await client.query(
      `UPDATE ebay_listing_job_targets SET status='pending',error_payload=NULL WHERE id=$1`,
      [current.id],
    );
    await client.query(`UPDATE ebay_listing_jobs SET status='processing' WHERE id=$1`, [current.listing_job_id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  if (!/^[0-9a-f-]{36}$/i.test(accountId ?? '')) throw new Error('--account-id=UUID is required');
  if (!Number.isInteger(sinceHours) || sinceHours < 1 || sinceHours > 168) {
    throw new Error('--since-hours must be between 1 and 168');
  }
  const client = new Client(dbOptions());
  await client.connect();
  try {
    const account = await client.query(
      `SELECT connection_source FROM connected_ebay_accounts WHERE id=$1`,
      [accountId],
    );
    if (account.rows[0]?.connection_source !== 'native_oauth') {
      throw new Error('This recovery tool only supports native-OAuth eBay accounts');
    }
    const allEligible = await eligibleTargets(client);
    const selected = canary ? allEligible.slice(0, 1) : allEligible;
    const quota = await availableTradingCalls();
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run', accountId, sinceHours, canary,
      eligibleProducts: allEligible.length, selectedTargets: selected.length,
      remainingCalls: quota.remaining, reset: quota.reset,
      sample: selected.slice(0, 5).map((row) => ({ targetId: row.id, productId: row.catalog_product_id })),
    }, null, 2));
    if (!apply || !selected.length) return;
    if (arg('confirm-account-id') !== accountId || Number(arg('confirm-count')) !== selected.length) {
      throw new Error('Apply requires exact --confirm-account-id and --confirm-count values from this dry run');
    }
    if (quota.remaining < selected.length + callReserve) {
      throw new Error(`Only ${quota.remaining} Trading calls remain; at least ${selected.length + callReserve} are required`);
    }
    const backupDir = process.env.REQUEUE_BACKUP_DIR || '/app/output';
    await mkdir(backupDir, { recursive: true });
    const runId = randomUUID();
    const backupPath = `${backupDir}/ebay-518-requeue-${runId}.json`;
    await writeFile(backupPath, JSON.stringify({ accountId, sinceHours, quota, selected }, null, 2));
    const connection = new IORedis(redisUrl(), { maxRetriesPerRequest: null });
    const queue = new Queue('ebay-listing-publish', { connection });
    try {
      for (const target of selected) {
        await recheckAndMarkPending(client, target);
        await queue.add('publish-target', { targetId: target.id }, {
          jobId: `quota-518-${runId}-${target.id}`,
          attempts: 4,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: 500,
          removeOnFail: 500,
        });
        console.log(JSON.stringify({ queuedTargetId: target.id }));
      }
      console.log(JSON.stringify({ queued: selected.length, backupPath }));
    } finally {
      await queue.close();
      await connection.quit();
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
