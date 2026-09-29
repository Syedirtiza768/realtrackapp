#!/usr/bin/env node
/**
 * Repoint first-party catalog/listing image URLs from the retired
 * `solarrisebackupbucket.s3.amazonaws.com` hostname onto the live
 * account-qualified bucket host. Keys are preserved.
 *
 * Env:
 *   PIPELINE_JOB_ID   required unless --all-alias
 *   AWS_S3_BUCKET     live bucket (default solarrisebackupbucket-530142863136)
 *   DRY_RUN=true      preview only
 *   ALL_ALIAS=true    rewrite every alias URL, not just one job
 *
 * Usage (from repo / backend container):
 *   PIPELINE_JOB_ID=<uuid> DRY_RUN=true node scripts/repoint-s3-bucket-alias-urls.mjs
 *   PIPELINE_JOB_ID=<uuid> node scripts/repoint-s3-bucket-alias-urls.mjs
 */
import pg from 'pg';

const { Client } = pg;

const DRY_RUN = process.env.DRY_RUN === 'true';
const ALL_ALIAS = process.env.ALL_ALIAS === 'true';
const JOB_ID = process.env.PIPELINE_JOB_ID || '';
const LIVE_BUCKET =
  process.env.AWS_S3_BUCKET ||
  process.env.S3_BUCKET ||
  'solarrisebackupbucket-530142863136';
const FROM_PREFIX = 'https://solarrisebackupbucket.s3.amazonaws.com/';
const TO_PREFIX = `https://${LIVE_BUCKET}.s3.amazonaws.com/`;
const BACKUP_LISTING = 'img_repoint_backup_20260913_listing';
const BACKUP_CATALOG = 'img_repoint_backup_20260913_catalog';

if (!ALL_ALIAS && !JOB_ID) {
  console.error('Set PIPELINE_JOB_ID or ALL_ALIAS=true');
  process.exit(1);
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'listingpro',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });
  await client.connect();

  console.log(`Live bucket: ${LIVE_BUCKET}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log(`Scope: ${ALL_ALIAS ? 'all alias URLs' : `job ${JOB_ID}`}`);

  const listingSql = ALL_ALIAS
    ? `SELECT COUNT(*)::int AS n FROM listing_records WHERE "itemPhotoUrl" LIKE $1`
    : `SELECT COUNT(*)::int AS n FROM listing_records WHERE "itemPhotoUrl" LIKE $1 AND pipeline_job_id = $2`;
  const catalogSql = ALL_ALIAS
    ? `SELECT COUNT(*)::int AS n FROM catalog_products WHERE array_to_string(image_urls, '|') LIKE $1`
    : `SELECT COUNT(*)::int AS n FROM catalog_products WHERE array_to_string(image_urls, '|') LIKE $1 AND pipeline_job_id = $2`;
  const like = [`%solarrisebackupbucket.s3.amazonaws.com%`];
  const qparams = ALL_ALIAS ? like : [...like, JOB_ID];

  const listings = await client.query(listingSql, qparams);
  const catalogs = await client.query(catalogSql, qparams);
  console.log(
    `Rows with alias host: listings=${listings.rows[0].n} catalog_products=${catalogs.rows[0].n}`,
  );

  if (DRY_RUN) {
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${BACKUP_LISTING} AS
       SELECT id, "customLabelSku", "itemPhotoUrl", pipeline_job_id, NOW() AS backed_up_at
       FROM listing_records WHERE false`,
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${BACKUP_CATALOG} AS
       SELECT id, sku, image_urls, pipeline_job_id, NOW() AS backed_up_at
       FROM catalog_products WHERE false`,
    );

    if (ALL_ALIAS) {
      await client.query(
        `INSERT INTO ${BACKUP_LISTING} (id, "customLabelSku", "itemPhotoUrl", pipeline_job_id, backed_up_at)
         SELECT id, "customLabelSku", "itemPhotoUrl", pipeline_job_id, NOW()
         FROM listing_records
         WHERE "itemPhotoUrl" LIKE $1`,
        like,
      );
      await client.query(
        `INSERT INTO ${BACKUP_CATALOG} (id, sku, image_urls, pipeline_job_id, backed_up_at)
         SELECT id, sku, image_urls, pipeline_job_id, NOW()
         FROM catalog_products
         WHERE array_to_string(image_urls, '|') LIKE $1`,
        like,
      );
      const updL = await client.query(
        `UPDATE listing_records
         SET "itemPhotoUrl" = replace("itemPhotoUrl", $1, $2),
             "updatedAt" = NOW()
         WHERE "itemPhotoUrl" LIKE $3`,
        [FROM_PREFIX, TO_PREFIX, like[0]],
      );
      const updC = await client.query(
        `UPDATE catalog_products
         SET image_urls = (
           SELECT array_agg(replace(u, $1, $2) ORDER BY ordinality)
           FROM unnest(image_urls) WITH ORDINALITY AS t(u, ordinality)
         ),
             "updatedAt" = NOW()
         WHERE array_to_string(image_urls, '|') LIKE $3`,
        [FROM_PREFIX, TO_PREFIX, like[0]],
      );
      console.log(
        `Updated listings=${updL.rowCount} catalog_products=${updC.rowCount}`,
      );
    } else {
      await client.query(
        `INSERT INTO ${BACKUP_LISTING} (id, "customLabelSku", "itemPhotoUrl", pipeline_job_id, backed_up_at)
         SELECT id, "customLabelSku", "itemPhotoUrl", pipeline_job_id, NOW()
         FROM listing_records
         WHERE pipeline_job_id = $1 AND "itemPhotoUrl" LIKE $2`,
        [JOB_ID, like[0]],
      );
      await client.query(
        `INSERT INTO ${BACKUP_CATALOG} (id, sku, image_urls, pipeline_job_id, backed_up_at)
         SELECT id, sku, image_urls, pipeline_job_id, NOW()
         FROM catalog_products
         WHERE pipeline_job_id = $1 AND array_to_string(image_urls, '|') LIKE $2`,
        [JOB_ID, like[0]],
      );
      const updL = await client.query(
        `UPDATE listing_records
         SET "itemPhotoUrl" = replace("itemPhotoUrl", $1, $2),
             "updatedAt" = NOW()
         WHERE pipeline_job_id = $3 AND "itemPhotoUrl" LIKE $4`,
        [FROM_PREFIX, TO_PREFIX, JOB_ID, like[0]],
      );
      const updC = await client.query(
        `UPDATE catalog_products
         SET image_urls = (
           SELECT array_agg(replace(u, $1, $2) ORDER BY ordinality)
           FROM unnest(image_urls) WITH ORDINALITY AS t(u, ordinality)
         ),
             "updatedAt" = NOW()
         WHERE pipeline_job_id = $3 AND array_to_string(image_urls, '|') LIKE $4`,
        [FROM_PREFIX, TO_PREFIX, JOB_ID, like[0]],
      );
      console.log(
        `Updated listings=${updL.rowCount} catalog_products=${updC.rowCount}`,
      );
    }

    const leftoverL = await client.query(listingSql, qparams);
    const leftoverC = await client.query(catalogSql, qparams);
    console.log(
      `Remaining alias hosts: listings=${leftoverL.rows[0].n} catalog_products=${leftoverC.rows[0].n}`,
    );
    console.log(`Backup tables: ${BACKUP_LISTING}, ${BACKUP_CATALOG}`);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
