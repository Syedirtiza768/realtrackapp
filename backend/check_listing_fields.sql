SELECT id, "customLabelSku", "categoryId", "conditionId", "startPrice", quantity,
  left(title, 60) AS title
FROM listing_records
WHERE id = '465db00a-e2ad-43ff-824d-cb5e74cb85f2';

SELECT id, sku, category_id, condition_id, price, quantity
FROM catalog_products
WHERE sku = 'BLA-00644';
