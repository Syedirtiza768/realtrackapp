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
  lr."customLabelSku",
  lr.title,
  lr.description,
  lr."cBrand",
  LOWER(TRIM(lr."cBrand")),
  lr."cManufacturerPartNumber",
  LOWER(REPLACE(REPLACE(lr."cManufacturerPartNumber", ' ', ''), '-', '')),
  lr."cOeOemPartNumber",
  lr."cType",
  lr."categoryName",
  lr."conditionId",
  lr."startPriceNum",
  lr."quantityNum",
  CASE
    WHEN lr."itemPhotoUrl" IS NOT NULL AND lr."itemPhotoUrl" != ''
    THEN string_to_array(lr."itemPhotoUrl", '|')
    ELSE '{}'::text[]
  END,
  'warehouse-intake',
  lr."sourceRowNumber",
  NOW(),
  NOW()
FROM listing_records lr
WHERE lr."sourceFileName" = 'warehouse-intake'
  AND lr."customLabelSku" IS NOT NULL
  AND lr."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM catalog_products cp
    WHERE cp.sku = lr."customLabelSku"
  );
