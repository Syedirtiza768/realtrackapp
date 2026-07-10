import { readFileSync, writeFileSync } from 'fs';
import XLSX from 'xlsx';

const wb = XLSX.readFile('C:/Users/Irtaza Hassan/Downloads/AUDI A4 BLACK 2 ,xlsx...xlsx');
const ws = wb.Sheets['Parts List'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
const headers = data[1].map(h => String(h || '').trim().toLowerCase());
const priceIdx = headers.indexOf('price');
const skuIdx = headers.indexOf('sku');

const noPriceSkus = [];
for (let i = 2; i < data.length; i++) {
  const row = data[i];
  if (!row || !row.some(c => c != null && c !== '')) continue;
  const nonEmpty = row.filter(c => c != null && String(c).trim() !== '').length;
  if (nonEmpty <= 1) continue;
  const price = row[priceIdx];
  const hasPrice = price != null && String(price).trim() !== '' && Number(price) > 0;
  if (!hasPrice) {
    noPriceSkus.push(String(row[skuIdx] || '').trim());
  }
}

const skuList = noPriceSkus.map(s => `  '${s.replace(/'/g, "''")}'`).join(',\n');

const sql = `BEGIN;

SELECT 'catalog_products to delete' AS t, COUNT(*) AS cnt
  FROM catalog_products
 WHERE pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272'
   AND sku IN (
${skuList}
   );

CREATE TEMP TABLE _zero_price_skus AS
  SELECT sku FROM catalog_products
   WHERE pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272'
     AND sku IN (
${skuList}
     );

DELETE FROM listing_records
 WHERE pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272'
   AND custom_label_sku IN (SELECT sku FROM _zero_price_skus);

DELETE FROM catalog_products
 WHERE pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272'
   AND sku IN (SELECT sku FROM _zero_price_skus);

UPDATE pipeline_jobs
   SET total_parts = (SELECT COUNT(*) FROM catalog_products WHERE pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272'),
       enriched_count = (SELECT COUNT(*) FROM catalog_products WHERE pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272'),
       optimization_processed = (SELECT COUNT(*) FROM catalog_products WHERE pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272'),
       optimization_pass_count = (SELECT COUNT(*) FROM catalog_products WHERE pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272')
 WHERE id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272';

SELECT 'catalog_products remaining' AS t, COUNT(*) AS cnt FROM catalog_products WHERE pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272';
SELECT 'listing_records remaining' AS t, COUNT(*) AS cnt FROM listing_records WHERE pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272';

DROP TABLE IF EXISTS _zero_price_skus;
COMMIT;
`;

writeFileSync('F:/apps/realtrackapp/scripts/cleanup-zero-price-products.sql', sql);
console.log(`Written SQL with ${noPriceSkus.length} SKUs`);
