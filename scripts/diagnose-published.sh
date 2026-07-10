#!/bin/bash
set -e

JOB_ID="68ec8a5b-ac0a-4a68-969d-ea14067f90af"

echo "=== Checking listing_records for this pipeline job ==="
docker exec realtrackapp-postgres-1 psql -U postgres -d listingpro -c "
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'published') AS status_published,
  COUNT(*) FILTER (WHERE \"publishedAt\" IS NOT NULL) AS has_published_at,
  COUNT(*) FILTER (WHERE \"ebayListingId\" IS NOT NULL AND \"ebayListingId\" != '') AS has_ebay_listing_id,
  COUNT(*) FILTER (WHERE \"shopifyProductId\" IS NOT NULL AND \"shopifyProductId\" != '') AS has_shopify_id
FROM listing_records
WHERE pipeline_job_id = '${JOB_ID}';
"

echo ""
echo "=== Checking listing_channel_instances ==="
docker exec realtrackapp-postgres-1 psql -U postgres -d listingpro -c "
SELECT COUNT(*) AS synced_instances
FROM listing_channel_instances lci
JOIN listing_records lr ON lr.id = lci.listing_id
WHERE lr.pipeline_job_id = '${JOB_ID}'
  AND lci.sync_status = 'synced';
"

echo ""
echo "=== Checking ebay_published_listings ==="
docker exec realtrackapp-postgres-1 psql -U postgres -d listingpro -c "
SELECT COUNT(*) AS active_published
FROM ebay_published_listings epl
JOIN listing_records lr ON lr.\"customLabelSku\" = epl.sku
WHERE lr.pipeline_job_id = '${JOB_ID}'
  AND epl.listing_status = 'active';
"

echo ""
echo "=== Sample of falsely 'published' records ==="
docker exec realtrackapp-postgres-1 psql -U postgres -d listingpro -c "
SELECT lr.id, lr.\"customLabelSku\", lr.title, lr.status, lr.\"publishedAt\", lr.\"ebayListingId\", lr.\"shopifyProductId\"
FROM listing_records lr
WHERE lr.pipeline_job_id = '${JOB_ID}'
  AND (
    lr.status = 'published'
    OR lr.\"publishedAt\" IS NOT NULL
    OR (lr.\"ebayListingId\" IS NOT NULL AND lr.\"ebayListingId\" != '')
    OR (lr.\"shopifyProductId\" IS NOT NULL AND lr.\"shopifyProductId\" != '')
  )
LIMIT 10;
"
