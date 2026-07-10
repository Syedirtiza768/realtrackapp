require('dotenv').config();
const { Client } = require('pg');

const JOB_ID = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272';

const client = new Client({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'listingpro',
});

async function main() {
  await client.connect();
  console.log('Connected to database');

  // Preview catalog_products
  const previewCatalog = await client.query(`
    SELECT id, sku, title, condition_id, condition_label
      FROM catalog_products
     WHERE pipeline_job_id = $1
       AND title ~* '\\mNew\\M'
       AND (
         condition_label ~* '\\m(used|refurbished|salvage)\\M'
         OR condition_id IN ('3000','4000','5000','6000','7000','2000','2500')
         OR condition_id ~* '^(USED_|FOR_PARTS|SELLER_REFURB)'
       )
     LIMIT 20
  `, [JOB_ID]);
  console.log(`\n=== catalog_products affected (${previewCatalog.rows.length} shown) ===`);
  if (previewCatalog.rows.length > 0) console.table(previewCatalog.rows);

  // Preview listing_records
  const previewLR = await client.query(`
    SELECT id, "customLabelSku" AS sku, title, "conditionId" AS "conditionId", condition_label
      FROM listing_records
     WHERE pipeline_job_id = $1
       AND title ~* '\\mNew\\M'
       AND (
         condition_label ~* '\\m(used|refurbished|salvage)\\M'
         OR "conditionId" IN ('3000','4000','5000','6000','7000','2000','2500')
         OR "conditionId" ~* '^(USED_|FOR_PARTS|SELLER_REFURB)'
       )
     LIMIT 20
  `, [JOB_ID]);
  console.log(`\n=== listing_records affected (${previewLR.rows.length} shown) ===`);
  if (previewLR.rows.length > 0) console.table(previewLR.rows);

  // Count totals
  const countCatalog = await client.query(`
    SELECT COUNT(*) AS cnt FROM catalog_products
     WHERE pipeline_job_id = $1 AND title ~* '\\mNew\\M'
       AND (
         condition_label ~* '\\m(used|refurbished|salvage)\\M'
         OR condition_id IN ('3000','4000','5000','6000','7000','2000','2500')
         OR condition_id ~* '^(USED_|FOR_PARTS|SELLER_REFURB)'
       )
  `, [JOB_ID]);
  const countLR = await client.query(`
    SELECT COUNT(*) AS cnt FROM listing_records
     WHERE pipeline_job_id = $1 AND title ~* '\\mNew\\M'
       AND (
         condition_label ~* '\\m(used|refurbished|salvage)\\M'
         OR "conditionId" IN ('3000','4000','5000','6000','7000','2000','2500')
         OR "conditionId" ~* '^(USED_|FOR_PARTS|SELLER_REFURB)'
       )
  `, [JOB_ID]);

  console.log(`\nTotal catalog_products to fix: ${countCatalog.rows[0].cnt}`);
  console.log(`Total listing_records to fix: ${countLR.rows[0].cnt}`);

  if (Number(countCatalog.rows[0].cnt) === 0 && Number(countLR.rows[0].cnt) === 0) {
    console.log('\nNo mismatches found. Nothing to fix.');
    await client.end();
    return;
  }

  // Apply fixes
  console.log('\nApplying fixes...');

  const updateCatalog = await client.query(`
    UPDATE catalog_products
       SET title = trim(regexp_replace(regexp_replace(title, '\\mNew\\M', '', 'gi'), '\\s+', ' ', 'g')),
           updated_at = NOW()
     WHERE pipeline_job_id = $1
       AND title ~* '\\mNew\\M'
       AND (
         condition_label ~* '\\m(used|refurbished|salvage)\\M'
         OR condition_id IN ('3000','4000','5000','6000','7000','2000','2500')
         OR condition_id ~* '^(USED_|FOR_PARTS|SELLER_REFURB)'
       )
  `, [JOB_ID]);
  console.log(`catalog_products updated: ${updateCatalog.rowCount}`);

  const updateLR = await client.query(`
    UPDATE listing_records
       SET title = trim(regexp_replace(regexp_replace(title, '\\mNew\\M', '', 'gi'), '\\s+', ' ', 'g')),
           "updatedAt" = NOW()
     WHERE pipeline_job_id = $1
       AND title ~* '\\mNew\\M'
       AND (
         condition_label ~* '\\m(used|refurbished|salvage)\\M'
         OR "conditionId" IN ('3000','4000','5000','6000','7000','2000','2500')
         OR "conditionId" ~* '^(USED_|FOR_PARTS|SELLER_REFURB)'
       )
  `, [JOB_ID]);
  console.log(`listing_records updated: ${updateLR.rowCount}`);

  // Verify
  const remainingCatalog = await client.query(`
    SELECT COUNT(*) AS cnt FROM catalog_products
     WHERE pipeline_job_id = $1 AND title ~* '\\mNew\\M'
       AND (
         condition_label ~* '\\m(used|refurbished|salvage)\\M'
         OR condition_id IN ('3000','4000','5000','6000','7000','2000','2500')
       )
  `, [JOB_ID]);
  const remainingLR = await client.query(`
    SELECT COUNT(*) AS cnt FROM listing_records
     WHERE pipeline_job_id = $1 AND title ~* '\\mNew\\M'
       AND (
         condition_label ~* '\\m(used|refurbished|salvage)\\M'
         OR "conditionId" IN ('3000','4000','5000','6000','7000','2000','2500')
       )
  `, [JOB_ID]);

  console.log(`\nRemaining mismatches — catalog_products: ${remainingCatalog.rows[0].cnt}, listing_records: ${remainingLR.rows[0].cnt}`);
  console.log('Done.');

  await client.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
