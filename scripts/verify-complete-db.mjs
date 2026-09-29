import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '/app/.env' });
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
const importId = '31fe3770-48c8-4667-9351-af4a1fad99ad';
const result = await pool.query(`
  select fitment_status, ebay_validation_status, count(*)::int as count
  from catalog_products where import_id=$1
  group by fitment_status, ebay_validation_status order by fitment_status, ebay_validation_status
`, [importId]);
const titles = await pool.query(`
  select count(*)::int as total,
         count(*) filter (where length(title)<=80)::int as titles_under_80,
         count(*) filter (where image_urls is not null and cardinality(image_urls)>0)::int as with_images
  from catalog_products where import_id=$1
`, [importId]);
console.log(JSON.stringify({ importId, statusCounts: result.rows, titleImageCounts: titles.rows[0] }, null, 2));
await pool.end();
