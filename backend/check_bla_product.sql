SELECT cp.sku, cp.title, cp.category_id, cp.condition_id, cp.price, cp.quantity,
       cp.image_urls[1] AS img1, cp.image_urls[2] AS img2
FROM catalog_products cp
WHERE cp.sku = 'BLA-00644';

SELECT lr."cBrand", lr."cManufacturerPartNumber", lr."cType", left(lr.description, 200) AS desc_sample
FROM listing_records lr
WHERE lr.id = '465db00a-e2ad-43ff-824d-cb5e74cb85f2';
