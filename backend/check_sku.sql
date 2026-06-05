SELECT id, "customLabelSku", title,
  CASE WHEN "itemPhotoUrl" IS NULL THEN 'NULL' ELSE left("itemPhotoUrl", 100) END AS photos
FROM listing_records
WHERE id = '465db00a-e2ad-43ff-824d-cb5e74cb85f2';

SELECT id, sku, array_length(image_urls, 1) AS img_count
FROM catalog_products
WHERE sku = 'BLA-00644' OR id IN (
  SELECT id FROM catalog_products WHERE sku LIKE '%00644%'
);
