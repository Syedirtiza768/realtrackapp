SELECT t.id, t.status, t.catalog_product_id, t.marketplace_id,
  t.error_payload->>'message' AS err_msg,
  t.error_payload->'errors' AS errors
FROM ebay_listing_job_targets t
WHERE t.catalog_product_id IN (
  '465db00a-e2ad-43ff-824d-cb5e74cb85f2',
  'b9a984a0-3b3e-4a98-9fc2-289b10671679'
)
ORDER BY t.created_at DESC
LIMIT 10;
