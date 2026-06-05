SELECT * FROM catalog_products WHERE sku = 'BLA-00644';

SELECT catalog_product_id, ebay_account_id, marketplace_id, image_order_override
FROM listing_store_override
WHERE catalog_product_id IN (
  SELECT id FROM catalog_products WHERE sku = 'BLA-00644'
);
