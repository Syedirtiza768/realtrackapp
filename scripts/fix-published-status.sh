#!/bin/bash
set -e

JOB_ID="68ec8a5b-ac0a-4a68-969d-ea14067f90af"

echo "=== Before: active published count ==="
docker exec realtrackapp-postgres-1 psql -U postgres -d listingpro -c "
SELECT COUNT(*) AS active_published
FROM ebay_published_listings epl
JOIN listing_records lr ON lr.\"customLabelSku\" = epl.sku
WHERE lr.pipeline_job_id = '${JOB_ID}'
  AND epl.listing_status = 'active';
"

echo "=== Marking stale ebay_published_listings as ended ==="
docker exec realtrackapp-postgres-1 psql -U postgres -d listingpro -c "
UPDATE ebay_published_listings epl
   SET listing_status = 'ended'
WHERE epl.sku IN (
  SELECT lr.\"customLabelSku\" FROM listing_records lr WHERE lr.pipeline_job_id = '${JOB_ID}'
)
AND epl.listing_status = 'active';
"

echo "=== After: active published count ==="
docker exec realtrackapp-postgres-1 psql -U postgres -d listingpro -c "
SELECT COUNT(*) AS active_published
FROM ebay_published_listings epl
JOIN listing_records lr ON lr.\"customLabelSku\" = epl.sku
WHERE lr.pipeline_job_id = '${JOB_ID}'
  AND epl.listing_status = 'active';
"

echo "Done."
