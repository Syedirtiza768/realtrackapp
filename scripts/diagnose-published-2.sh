#!/bin/bash
set -e

JOB_ID="68ec8a5b-ac0a-4a68-969d-ea14067f90af"

echo "=== Stale ebay_published_listings matching this job's SKUs ==="
docker exec realtrackapp-postgres-1 psql -U postgres -d listingpro -c "
SELECT epl.id, epl.sku, epl.listing_status, epl.title, epl.ebay_item_id
FROM ebay_published_listings epl
WHERE epl.sku IN (
  SELECT lr.\"customLabelSku\" FROM listing_records lr WHERE lr.pipeline_job_id = '${JOB_ID}'
)
AND epl.listing_status = 'active'
ORDER BY epl.sku
LIMIT 20;
"

echo ""
echo "=== Do these SKUs exist in OTHER listing_records (not this job)? ==="
docker exec realtrackapp-postgres-1 psql -U postgres -d listingpro -c "
SELECT lr.\"customLabelSku\", lr.pipeline_job_id, lr.status, lr.\"ebayListingId\"
FROM listing_records lr
WHERE lr.\"customLabelSku\" IN (
  SELECT lr2.\"customLabelSku\" FROM listing_records lr2 WHERE lr2.pipeline_job_id = '${JOB_ID}'
)
AND lr.pipeline_job_id != '${JOB_ID}'
AND lr.\"customLabelSku\" IN (
  SELECT epl.sku FROM ebay_published_listings epl WHERE epl.listing_status = 'active'
)
LIMIT 20;
"

echo ""
echo "=== Count: how many of the 80 stale entries belong to other pipeline jobs ==="
docker exec realtrackapp-postgres-1 psql -U postgres -d listingpro -c "
SELECT epl.sku, 
  (SELECT lr2.pipeline_job_id FROM listing_records lr2 WHERE lr2.\"customLabelSku\" = epl.sku LIMIT 1) AS other_job_id,
  (SELECT lr2.status FROM listing_records lr2 WHERE lr2.\"customLabelSku\" = epl.sku LIMIT 1) AS other_status
FROM ebay_published_listings epl
WHERE epl.sku IN (
  SELECT lr.\"customLabelSku\" FROM listing_records lr WHERE lr.pipeline_job_id = '${JOB_ID}'
)
AND epl.listing_status = 'active'
LIMIT 10;
"
