/**
 * Backfill listing optimization (title-guideline SEO title + MVL-expanded
 * compatibility rows) for existing warehouse-intake ("Add Part" / /listings/new)
 * catalog products that predate the automatic post-intake enqueue.
 *
 * Mirrors exactly what SingleListingFormService.createIntakePart() now does
 * for newly-created parts: enqueue a 'listing-optimization' job with
 * { productId, marketplace: 'US' } and jobId `intake-optimization-${sku}`
 * (same dedupe key, so re-running this script is safe/idempotent).
 * optimizeProduct() itself skips products already optimized against the
 * current source data hash, so running this against ALL intake products
 * (not just unoptimized ones) is safe and cheap for already-done rows.
 *
 * Usage (run inside the backend container so the DB_ and REDIS_ env vars and
 * the 'redis'/'postgres' hostnames resolve):
 *   docker compose exec backend node scripts/backfill-warehouse-intake-optimization.cjs
 *
 * Env:
 *   DRY_RUN=1   list matching products only, do not enqueue or touch the DB
 *   BATCH_MS    delay between enqueues in ms (default 50)
 */
const { Client } = require('pg');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const DRY_RUN = process.env.DRY_RUN === '1';
const BATCH_MS = Number(process.env.BATCH_MS || 50);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const pg = new Client({
    host: process.env.DB_HOST || 'postgres',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'listingpro',
  });
  await pg.connect();

  try {
    // Bring pre-existing intake listing_records in line with what
    // createIntakePart() now sets on new rows, so the optimization job's
    // category-writeback (which matches on customLabelSku + marketplace)
    // can find them.
    // Skip SKUs that already have another active 'US' row (e.g. a later
    // pipeline re-enrichment of the same part) — setting marketplace='US'
    // on the intake row too would collide with
    // idx_listing_sku_marketplace_unique_active ("customLabelSku", marketplace).
    const marketplaceBackfill = await pg.query(
      `UPDATE listing_records lr
       SET marketplace = 'US'
       WHERE lr.origin = 'add_part'
         AND lr.marketplace IS NULL
         AND lr."deletedAt" IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM listing_records lr2
           WHERE lr2."customLabelSku" = lr."customLabelSku"
             AND lr2.marketplace = 'US'
             AND lr2."deletedAt" IS NULL
             AND lr2.id <> lr.id
         )`,
    );
    console.log(
      `${DRY_RUN ? '[DRY RUN would update] ' : ''}Backfilled marketplace='US' on ${marketplaceBackfill.rowCount} intake listing_record row(s).`,
    );

    const { rows } = await pg.query(
      `SELECT id, sku FROM catalog_products WHERE source_file = 'warehouse-intake' ORDER BY id ASC`,
    );
    console.log(`Found ${rows.length} warehouse-intake catalog product(s).`);

    if (DRY_RUN || rows.length === 0) return;

    const connection = new IORedis(
      process.env.REDIS_PASSWORD
        ? {
            host: process.env.REDIS_HOST || 'redis',
            port: Number(process.env.REDIS_PORT || 6379),
            password: process.env.REDIS_PASSWORD,
            maxRetriesPerRequest: null,
          }
        : {
            host: process.env.REDIS_HOST || 'redis',
            port: Number(process.env.REDIS_PORT || 6379),
            maxRetriesPerRequest: null,
          },
    );
    const queue = new Queue('listing-optimization', { connection });

    let queued = 0;
    for (let i = 0; i < rows.length; i++) {
      const { id, sku } = rows[i];
      try {
        await queue.add(
          'optimize-product',
          { productId: id, marketplace: 'US' },
          {
            jobId: `intake-optimization-${sku}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
          },
        );
        queued += 1;
        if ((i + 1) % 50 === 0 || i === rows.length - 1) {
          console.log(`[${i + 1}/${rows.length}] queued=${queued}`);
        }
      } catch (err) {
        console.error(`Failed to enqueue product ${id} (sku=${sku}): ${err.message}`);
      }
      if (BATCH_MS > 0) await sleep(BATCH_MS);
    }

    console.log(`Done. Enqueued ${queued}/${rows.length} product(s) for optimization.`);
    await connection.quit();
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
