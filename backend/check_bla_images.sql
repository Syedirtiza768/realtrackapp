SELECT array_length(image_urls, 1) AS cnt, image_urls
FROM catalog_products
WHERE sku = 'BLA-00644';
