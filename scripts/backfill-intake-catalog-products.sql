-- Backfill catalog_products for warehouse-intake listing_records
-- that don't have a corresponding catalog product yet.
--
-- Run this once after deploying the fix that creates catalog products
-- for new "Add Part" submissions.

INSERT INTO catalog_products (
  sku,
  title,
  description,
  brand,
  brand_normalized,
  mpn,
  mpn_normalized,
  oem_part_number,
  part_type,
  category_name,
  condition_id,
  price,
  quantity,
  image_urls,
  source_file,
  source_row,
  "createdAt",
  "updatedAt"
)
SELECT
  lr.custom_label_sku,
  lr.title,
  lr.description,
  lr.c_brand,
  LOWER(TRIM(lr.c_brand)),
  lr.c_manufacturer_part_number,
  LOWER(REPLACE(REPLACE(lr.c_manufacturer_part_number, ' ', ''), '-', '')),
  lr.c_oe_oem_part_number,
  lr.c_type,
  lr.category_name,
  lr.condition_id,
  lr.start_price_num,
  lr.quantity_num,
  CASE
    WHEN lr.item_photo_url IS NOT NULL AND lr.item_photo_url != ''
    THEN string_to_array(lr.item_photo_url, '|')
    ELSE '{}'::text[]
  END,
  'warehouse-intake',
  lr.source_row_number,
  NOW(),
  NOW()
FROM listing_records lr
WHERE lr.source_file_name = 'warehouse-intake'
  AND lr.custom_label_sku IS NOT NULL
  AND lr.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM catalog_products cp
    WHERE cp.sku = lr.custom_label_sku
  );
