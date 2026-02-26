SELECT "itemPhotoUrl" FROM listing_records 
WHERE "itemPhotoUrl" IS NOT NULL AND "itemPhotoUrl" != '' 
LIMIT 5;

SELECT COUNT(*) AS with_image FROM listing_records 
WHERE "itemPhotoUrl" IS NOT NULL AND "itemPhotoUrl" != '';

SELECT COUNT(*) AS total FROM listing_records;
