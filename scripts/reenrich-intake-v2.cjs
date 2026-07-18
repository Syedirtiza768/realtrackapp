/**
 * Bulk re-enrich warehouse-intake listings (run INSIDE the backend container).
 * Selects every intake listing that is not cleanly completed — wrong stage,
 * year-0 / missing-year / duplicated-OEM / condition-prefixed title — resets
 * its enrichment state, and enqueues a forced auto-enrich job, skipping
 * listings that already have a job waiting/active/delayed.
 */
const { Queue } = require('bullmq');
const { Client } = require('pg');

(async () => {
  const pg = new Client({
    host: process.env.DB_HOST || 'postgres',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'listingpro',
  });
  await pg.connect();

  const queue = new Queue('inventory', {
    connection: {
      host: process.env.REDIS_HOST || 'redis',
      port: Number(process.env.REDIS_PORT || 6379),
    },
  });

  const pending = await queue.getJobs(['waiting', 'active', 'delayed'], 0, 5000);
  const queuedIds = new Set(
    pending
      .filter((j) => j.name === 'auto-enrich')
      .map((j) => j.data && j.data.listingId)
      .filter(Boolean),
  );
  console.log(`Already queued: ${queuedIds.size}`);

  const { rows } = await pg.query(`
    SELECT id, "customLabelSku", "enrichmentStage", LEFT(title, 60) AS title
    FROM listing_records
    WHERE "sourceFileName" = 'warehouse-intake'
      AND "deletedAt" IS NULL
      AND (
        COALESCE("enrichmentStage", '') <> 'completed'
        OR title ~ '^\\s*0 '
        OR title ~* '^(used|new) '
        OR title !~ '^(19|20)\\d{2}'
        OR title ~* '\\moem\\M.+\\moem\\M'
      )
  `);
  console.log(`Candidates: ${rows.length}`);

  let enqueued = 0;
  let skipped = 0;
  for (const row of rows) {
    if (queuedIds.has(row.id)) {
      skipped++;
      continue;
    }
    await pg.query(
      `UPDATE listing_records
       SET "enrichmentStage" = NULL,
           "enrichmentPermanentFail" = false,
           "enrichmentRetryCount" = 0,
           "enrichmentNextRetryAt" = NULL,
           "enrichmentLastFailureReason" = NULL
       WHERE id = $1`,
      [row.id],
    );
    await queue.add(
      'auto-enrich',
      { listingId: row.id, force: true },
      { attempts: 1, removeOnComplete: 50, removeOnFail: 100 },
    );
    enqueued++;
  }

  console.log(`Enqueued: ${enqueued}, skipped (already queued): ${skipped}`);
  await queue.close();
  await pg.end();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
