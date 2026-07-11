BEGIN;

WITH updated AS (
  UPDATE listing_records
  SET "categoryId" = '9886',
      "categoryName" = 'Other Car & Truck Parts & Accessories',
      "updatedAt" = now()
  WHERE pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272'
    AND ("categoryId" IS DISTINCT FROM '9886'
         OR "categoryName" IS DISTINCT FROM 'Other Car & Truck Parts & Accessories')
  RETURNING id
)
SELECT count(*) AS listing_records_repaired FROM updated;

WITH updated AS (
  UPDATE catalog_products
  SET category_id = '9886',
      category_name = 'Other Car & Truck Parts & Accessories',
      "updatedAt" = now()
  WHERE pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272'
    AND (category_id IS DISTINCT FROM '9886'
         OR category_name IS DISTINCT FROM 'Other Car & Truck Parts & Accessories')
  RETURNING id
)
SELECT count(*) AS catalog_products_repaired FROM updated;

COMMIT;

SELECT count(*) AS listings_at_leaf
FROM listing_records
WHERE pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272'
  AND "categoryId" = '9886';
SELECT cea.account_display_name, elc.listing_status, count(*)
FROM ebay_listing_channels elc
JOIN catalog_products cp ON cp.id = elc.catalog_product_id
JOIN connected_ebay_accounts cea ON cea.id = elc.ebay_account_id
WHERE cp.pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272'
  AND cea.account_display_name IN ('BLACKLINEAUTOPARTS', 'Primemotive')
GROUP BY 1, 2
ORDER BY 1, 2;

SELECT status, count(*) FROM listing_records WHERE pipeline_job_id='1c3a0f2a-064c-4d86-8c37-c31f60ffd272' GROUP BY 1 ORDER BY 1;
SELECT count(*) AS published_recently FROM listing_records WHERE pipeline_job_id='1c3a0f2a-064c-4d86-8c37-c31f60ffd272' AND status='published' AND "publishedAt" > now() - interval '30 minutes';

SELECT id, store_name FROM stores WHERE lower(store_name) LIKE '%blackline%' OR lower(store_name) LIKE '%prime%';
SELECT s.store_name, eo.status, count(*) FROM ebay_offers eo JOIN stores s ON s.id=eo.store_id WHERE eo.updated_at > now() - interval '30 minutes' GROUP BY 1,2 ORDER BY 1,2;

SELECT s.store_name, eo.status, count(*)
FROM ebay_offers eo
JOIN stores s ON s.id = eo.store_id
JOIN listing_records lr ON lr."customLabelSku" = eo.sku
WHERE lr.pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272'
  AND s.store_name IN ('BLACKLINEAUTOPARTS', 'Primemotive')
GROUP BY 1, 2
ORDER BY 1, 2;

SELECT s.store_name, lci.sync_status, count(*)
FROM listing_channel_instances lci
JOIN listing_records lr ON lr.id = lci.listing_id
JOIN stores s ON s.id = lci.store_id
WHERE lr.pipeline_job_id = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272'
  AND s.store_name IN ('BLACKLINEAUTOPARTS', 'Primemotive')
GROUP BY 1, 2
ORDER BY 1, 2;
